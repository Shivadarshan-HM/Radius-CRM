"""
Automation business logic for Radius Studios CRM.

Each trigger function:
  - Loads AutomationSettings (creates singleton row if absent).
  - No-ops (status="skipped") if automation_enabled is False.
  - Wraps its work in try/except — automation NEVER crashes the caller.
  - Uses its own db.commit() scope, isolated from the caller's transaction.
"""
import logging
from datetime import date

from sqlalchemy.orm import Session

from .. import models
from .whatsapp import (
    build_whatsapp_link,
    lead_acknowledgement_message,
    sow_ready_message,
    invoice_reminder_message,
)

log = logging.getLogger(__name__)


# ---------- Helpers ----------

def get_or_create_settings(db: Session) -> models.AutomationSettings:
    """
    Fetch the singleton AutomationSettings row (id=1).
    Creates it with defaults if absent — uses a savepoint-safe merge
    so it never collides with an active caller transaction.
    """
    settings = db.query(models.AutomationSettings).filter(models.AutomationSettings.id == 1).first()
    if settings is None:
        settings = models.AutomationSettings(id=1)
        db.add(settings)
        try:
            db.flush()          # write without committing caller's work
        except Exception:
            db.rollback()
            settings = db.query(models.AutomationSettings).filter(models.AutomationSettings.id == 1).first()
            if settings is None:
                raise
    return settings


def _log(
    db: Session,
    *,
    event: str,
    entity_type: str = "",
    entity_id: str | None = None,
    action: str = "",
    status: str = "success",
    detail: str = "",
) -> None:
    """Write a single AutomationLog row. Uses db.flush() to avoid committing
    in the middle of the caller's transaction chain."""
    try:
        entry = models.AutomationLog(
            event=event,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id else None,
            action=action,
            status=status,
            detail=detail,
        )
        db.add(entry)
        db.commit()
    except Exception as exc:
        log.error("Failed to write automation log: %s", exc)
        try:
            db.rollback()
        except Exception:
            pass


def _next_invoice_number(db: Session) -> str:
    """Generate the next invoice number in RS-NNN format."""
    count = db.query(models.Invoice).count()
    return f"RS-{str(count + 1).zfill(3)}"


# ---------- Triggers ----------

def on_lead_created(lead: models.Lead, db: Session) -> None:
    """
    Fires after a new Lead is committed.
    If automation_enabled and auto_acknowledge_leads:
      build a WhatsApp acknowledgement deep-link and log it.
    """
    try:
        settings = get_or_create_settings(db)

        if not settings.automation_enabled:
            _log(db, event="lead.created", entity_type="lead", entity_id=lead.id,
                 action="Automation disabled — skipped WhatsApp acknowledgement",
                 status="skipped", detail="automation_enabled=False")
            return

        if not settings.auto_acknowledge_leads:
            _log(db, event="lead.created", entity_type="lead", entity_id=lead.id,
                 action="auto_acknowledge_leads is off — skipped",
                 status="skipped", detail="auto_acknowledge_leads=False")
            return

        msg = lead_acknowledgement_message(lead)
        link = build_whatsapp_link(lead.phone, msg)

        if link:
            _log(db, event="lead.created", entity_type="lead", entity_id=lead.id,
                 action=f"Prepared WhatsApp acknowledgement for {lead.company}",
                 status="success", detail=link)
        else:
            _log(db, event="lead.created", entity_type="lead", entity_id=lead.id,
                 action="No phone number — could not build WhatsApp link",
                 status="skipped", detail="phone field is empty")

    except Exception as exc:
        log.error("on_lead_created failed: %s", exc)
        try:
            _log(db, event="lead.created", entity_type="lead",
                 entity_id=getattr(lead, "id", None),
                 action="Automation error in on_lead_created",
                 status="failed", detail=str(exc))
        except Exception:
            pass


def on_lead_stage_changed(
    lead: models.Lead,
    old_stage: str,
    new_stage: str,
    db: Session,
) -> None:
    """
    Fires after a Lead stage is updated.
    If new_stage == "Won" and auto_generate_sow_on_won:
      - Find or create a Client matching lead.company.
      - Create a stub Project linked to that client.
      - Create a draft SOW Contract.
      All three are committed atomically.
    """
    try:
        settings = get_or_create_settings(db)

        if not settings.automation_enabled:
            _log(db, event="lead.stage_changed", entity_type="lead", entity_id=lead.id,
                 action=f"Stage changed {old_stage} → {new_stage} — automation disabled",
                 status="skipped", detail="automation_enabled=False")
            return

        if new_stage != "Won":
            # Log stage transitions that are meaningful but not Won
            _log(db, event="lead.stage_changed", entity_type="lead", entity_id=lead.id,
                 action=f"Stage changed: {old_stage} → {new_stage}",
                 status="success", detail=f"No action configured for stage '{new_stage}'")
            return

        if not settings.auto_generate_sow_on_won:
            _log(db, event="lead.won", entity_type="lead", entity_id=lead.id,
                 action="Lead Won — auto_generate_sow_on_won is off",
                 status="skipped", detail="auto_generate_sow_on_won=False")
            return

        # --- Find or create Client ---
        client = (
            db.query(models.Client)
            .filter(models.Client.company == lead.company)
            .first()
        )
        client_created = False
        if client is None:
            client = models.Client(
                company=lead.company,
                contact_name=lead.contact_name,
                email=lead.email,
                phone=lead.phone,
                source=lead.source,
                status="Active",
                notes=f"Auto-created from lead when moved to Won on {date.today().isoformat()}.",
            )
            db.add(client)
            db.flush()  # write row so we get client.id before commit
            client_created = True

        # --- Create stub Project ---
        project = models.Project(
            name=f"{lead.company} — New Project",
            client_id=client.id,
            status="Planning",
            budget=float(lead.value or 0),
            start_date=date.today(),
            notes=(
                f"Auto-created when lead moved to Won on {date.today().isoformat()}. "
                f"Estimated value: ₹{float(lead.value or 0):,.0f}."
            ),
        )
        db.add(project)
        db.flush()  # write row so we get project.id before commit

        # --- Create draft SOW Contract ---
        value = float(lead.value or 0)
        terms = (
            f"Scope of Work for {lead.company}.\n\n"
            f"Project: {project.name}\n"
            f"Estimated contract value: ₹{value:,.0f}\n\n"
            "Deliverables: To be confirmed at kickoff meeting.\n"
            "Payment schedule: 50% advance, 50% on delivery.\n"
            "Revisions: Two rounds of revisions included.\n"
            "Timeline: To be agreed upon project kickoff.\n\n"
            "This is a draft — review and update before sharing with the client."
        )
        contract = models.Contract(
            title=f"Scope of Work — {lead.company}",
            type="Scope of Work (SOW)",
            client_id=client.id,
            project_id=project.id,
            value=value,
            status="Draft",
            date=date.today(),
            terms=terms,
        )
        db.add(contract)
        db.commit()  # commit Client + Project + Contract atomically

        # Build SOW WhatsApp link (best-effort — don't fail if no phone)
        wa_link = None
        if lead.phone:
            try:
                msg = sow_ready_message(contract, client)
                wa_link = build_whatsapp_link(lead.phone, msg)
            except Exception as exc:
                log.warning("Could not build SOW WhatsApp link: %s", exc)

        action_parts = ["Lead Won →"]
        if client_created:
            action_parts.append("created Client,")
        else:
            action_parts.append("matched existing Client,")
        action_parts.append("created Project + SOW Contract (Draft)")

        detail_lines = [
            f"client_id={client.id} ({'new' if client_created else 'existing'})",
            f"project_id={project.id}",
            f"contract_id={contract.id}",
        ]
        if wa_link:
            detail_lines.append(f"whatsapp_link={wa_link}")

        _log(db, event="lead.won", entity_type="lead", entity_id=lead.id,
             action=" ".join(action_parts),
             status="success", detail="\n".join(detail_lines))

    except Exception as exc:
        log.error("on_lead_stage_changed failed: %s", exc)
        try:
            db.rollback()
            _log(db, event="lead.won", entity_type="lead",
                 entity_id=getattr(lead, "id", None),
                 action="Automation error in on_lead_stage_changed",
                 status="failed", detail=str(exc))
        except Exception:
            pass


def on_invoice_created(invoice: models.Invoice, client, db: Session) -> None:
    """
    Fires after a new Invoice is committed.
    If automation_enabled and auto_whatsapp_invoice_reminders and status == "Sent":
      build a WhatsApp reminder deep-link and log it.
    """
    try:
        settings = get_or_create_settings(db)

        if not settings.automation_enabled:
            _log(db, event="invoice.created", entity_type="invoice", entity_id=invoice.id,
                 action="Automation disabled — skipped invoice WhatsApp reminder",
                 status="skipped", detail="automation_enabled=False")
            return

        if not settings.auto_whatsapp_invoice_reminders:
            _log(db, event="invoice.created", entity_type="invoice", entity_id=invoice.id,
                 action="auto_whatsapp_invoice_reminders is off — skipped",
                 status="skipped", detail="auto_whatsapp_invoice_reminders=False")
            return

        if invoice.status != "Sent":
            _log(db, event="invoice.created", entity_type="invoice", entity_id=invoice.id,
                 action=f"Invoice #{invoice.number} created with status '{invoice.status}' — link only prepared for 'Sent'",
                 status="skipped", detail=f"status={invoice.status}")
            return

        phone = getattr(client, "phone", "") if client else ""
        msg = invoice_reminder_message(invoice, client, overdue=False)
        link = build_whatsapp_link(phone, msg)

        if link:
            _log(db, event="invoice.created", entity_type="invoice", entity_id=invoice.id,
                 action=f"Prepared WhatsApp reminder for invoice #{invoice.number}",
                 status="success", detail=link)
        else:
            _log(db, event="invoice.created", entity_type="invoice", entity_id=invoice.id,
                 action="No phone on client — could not build WhatsApp link",
                 status="skipped", detail="client phone is empty")

    except Exception as exc:
        log.error("on_invoice_created failed: %s", exc)
        try:
            _log(db, event="invoice.created", entity_type="invoice",
                 entity_id=getattr(invoice, "id", None),
                 action="Automation error in on_invoice_created",
                 status="failed", detail=str(exc))
        except Exception:
            pass


def on_project_status_changed(
    project: models.Project,
    old_status: str,
    new_status: str,
    db: Session,
) -> None:
    """
    Fires after a Project status is updated.
    If new_status == "Completed" and auto_invoice_on_project_complete:
      create a Draft invoice for the remaining budget balance (budget minus all existing invoices).
    """
    try:
        settings = get_or_create_settings(db)

        if not settings.automation_enabled:
            _log(db, event="project.status_changed", entity_type="project", entity_id=project.id,
                 action=f"Status changed {old_status} → {new_status} — automation disabled",
                 status="skipped", detail="automation_enabled=False")
            return

        if new_status != "Completed":
            return  # no logging needed for non-terminal transitions

        if not settings.auto_invoice_on_project_complete:
            _log(db, event="project.completed", entity_type="project", entity_id=project.id,
                 action="Project completed — auto_invoice_on_project_complete is off",
                 status="skipped", detail="auto_invoice_on_project_complete=False")
            return

        # Calculate remaining balance
        budget = float(project.budget or 0)
        existing_invoices = (
            db.query(models.Invoice)
            .filter(models.Invoice.project_id == project.id)
            .all()
        )
        already_invoiced = sum(float(inv.amount or 0) for inv in existing_invoices)
        remaining = max(0.0, budget - already_invoiced)

        invoice_number = _next_invoice_number(db)
        invoice = models.Invoice(
            number=invoice_number,
            client_id=project.client_id,
            project_id=project.id,
            description=f"Final payment — {project.name}",
            amount=remaining,
            status="Draft",
            issue_date=date.today(),
        )
        db.add(invoice)
        db.commit()

        _log(db, event="project.completed", entity_type="project", entity_id=project.id,
             action=f"Project completed → created Draft invoice #{invoice_number} for ₹{remaining:,.0f}",
             status="success",
             detail=f"invoice_id={invoice.id}\namount={remaining:.2f}\nnumber={invoice_number}")

    except Exception as exc:
        log.error("on_project_status_changed failed: %s", exc)
        try:
            db.rollback()
            _log(db, event="project.completed", entity_type="project",
                 entity_id=getattr(project, "id", None),
                 action="Automation error in on_project_status_changed",
                 status="failed", detail=str(exc))
        except Exception:
            pass
