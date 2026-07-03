"""
APScheduler background scheduler for Radius Studios CRM.

Runs a daily job at 09:00 IST that:
  1. Finds Sent invoices due within the next 3 days → prepares WhatsApp reminder links.
  2. Finds Sent invoices past their due date → marks them Overdue + prepares reminder links.

The scheduler is started from app/main.py. The running-guard prevents double-init
when uvicorn --reload fires the startup event twice.
"""
import logging
from datetime import date, timedelta

from apscheduler.schedulers.background import BackgroundScheduler

from .database import SessionLocal
from . import models
from .services.whatsapp import build_whatsapp_link, invoice_reminder_message
from .services.automation import get_or_create_settings, _log

log = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="Asia/Kolkata")


def _process_upcoming(db, today: date, soon: date) -> None:
    """Prepare WhatsApp reminder links for invoices due within 3 days."""
    upcoming = (
        db.query(models.Invoice)
        .filter(
            models.Invoice.status == "Sent",
            models.Invoice.due_date >= today,
            models.Invoice.due_date <= soon,
        )
        .all()
    )
    for invoice in upcoming:
        try:
            client = (
                db.query(models.Client).filter(models.Client.id == invoice.client_id).first()
                if invoice.client_id else None
            )
            phone = getattr(client, "phone", "") if client else ""
            msg = invoice_reminder_message(invoice, client, overdue=False)
            link = build_whatsapp_link(phone, msg)
            _log(
                db,
                event="invoice.due_soon",
                entity_type="invoice",
                entity_id=invoice.id,
                action=f"Invoice #{invoice.number} due on {invoice.due_date} — reminder prepared",
                status="success" if link else "skipped",
                detail=link or "no phone number on client",
            )
        except Exception as exc:
            log.error("Scheduler: upcoming reminder failed for invoice %s: %s", invoice.id, exc)


def _process_overdue(db, today: date) -> None:
    """Mark past-due Sent invoices as Overdue and prepare reminder links."""
    overdue_invoices = (
        db.query(models.Invoice)
        .filter(
            models.Invoice.status == "Sent",
            models.Invoice.due_date < today,
        )
        .all()
    )
    for invoice in overdue_invoices:
        try:
            invoice.status = "Overdue"
            db.flush()
            client = (
                db.query(models.Client).filter(models.Client.id == invoice.client_id).first()
                if invoice.client_id else None
            )
            phone = getattr(client, "phone", "") if client else ""
            msg = invoice_reminder_message(invoice, client, overdue=True)
            link = build_whatsapp_link(phone, msg)
            _log(
                db,
                event="invoice.overdue",
                entity_type="invoice",
                entity_id=invoice.id,
                action=f"Invoice #{invoice.number} marked Overdue (was due {invoice.due_date}) — reminder prepared",
                status="success" if link else "skipped",
                detail=link or "no phone number on client",
            )
        except Exception as exc:
            log.error("Scheduler: overdue handling failed for invoice %s: %s", invoice.id, exc)
            try:
                db.rollback()
            except Exception:
                pass


def _run_invoice_reminders() -> None:
    """Daily scheduled job — invoice due-soon + overdue sweep."""
    db = SessionLocal()
    try:
        settings = get_or_create_settings(db)
        if not settings.automation_enabled or not settings.auto_whatsapp_invoice_reminders:
            log.debug("Scheduler: invoice reminders skipped (automation off or flag off).")
            return

        today = date.today()
        soon = today + timedelta(days=3)

        _process_upcoming(db, today, soon)
        _process_overdue(db, today)

        db.commit()
        log.info("Scheduler: invoice reminder sweep complete for %s.", today.isoformat())

    except Exception as exc:
        log.error("Scheduler: _run_invoice_reminders crashed: %s", exc)
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        db.close()


def start_scheduler() -> None:
    """Start the background scheduler if not already running."""
    if not scheduler.running:
        scheduler.add_job(
            _run_invoice_reminders,
            trigger="cron",
            hour=9,
            minute=0,
            id="daily_invoice_reminders",
            replace_existing=True,
        )
        scheduler.start()
        log.info("Automation scheduler started — daily invoice sweep at 09:00 IST.")


def run_now() -> None:
    """Trigger the invoice reminder job immediately (for manual testing)."""
    _run_invoice_reminders()
