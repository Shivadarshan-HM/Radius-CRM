"""
Automation router — settings, audit logs, on-demand WhatsApp links, and PDF downloads.

All routes require the standard JWT auth dependency.

WhatsApp link and PDF endpoints are manual tools — they work regardless of
the automation_enabled master switch.

Route structure:
  /automation/settings          GET + PATCH
  /automation/logs              GET
  /automation/leads/{id}/whatsapp-link    GET
  /automation/invoices/{id}/whatsapp-link GET
  /automation/invoices/{id}/pdf           GET
  /automation/contracts/{id}/pdf          GET
"""
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..services.automation import get_or_create_settings
from ..services.whatsapp import (
    build_whatsapp_link,
    lead_acknowledgement_message,
    invoice_reminder_message,
    sow_ready_message,
)
from ..services.pdf import generate_invoice_pdf, generate_contract_pdf

router = APIRouter(
    prefix="/automation",
    tags=["automation"],
    dependencies=[Depends(get_current_user)],
)


# ---------- Settings ----------

@router.get("/settings", response_model=schemas.AutomationSettingsOut)
def get_automation_settings(db: Session = Depends(get_db)):
    """Return current automation settings (auto-creates defaults on first call)."""
    return get_or_create_settings(db)


@router.patch("/settings", response_model=schemas.AutomationSettingsOut)
def update_automation_settings(
    payload: schemas.AutomationSettingsUpdate,
    db: Session = Depends(get_db),
):
    """Update any subset of the automation flags."""
    settings = get_or_create_settings(db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, key, value)
    db.commit()
    db.refresh(settings)
    return settings


# ---------- Audit logs ----------

@router.get("/logs", response_model=list[schemas.AutomationLogOut])
def get_automation_logs(
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Return the most recent automation log entries, newest first."""
    return (
        db.query(models.AutomationLog)
        .order_by(models.AutomationLog.created_at.desc())
        .limit(limit)
        .all()
    )


# ---------- On-demand WhatsApp links ----------

@router.get("/leads/{lead_id}/whatsapp-link")
def lead_whatsapp_link(lead_id: str, db: Session = Depends(get_db)):
    """
    Build an on-demand WhatsApp acknowledgement link for any lead.
    Works regardless of the automation master switch.
    """
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if not lead.phone:
        raise HTTPException(status_code=422, detail="Lead has no phone number")
    msg = lead_acknowledgement_message(lead)
    link = build_whatsapp_link(lead.phone, msg)
    if not link:
        raise HTTPException(status_code=422, detail="Could not build WhatsApp link — check the phone number format")
    return {"url": link}


@router.get("/invoices/{invoice_id}/whatsapp-link")
def invoice_whatsapp_link(invoice_id: str, db: Session = Depends(get_db)):
    """
    Build an on-demand WhatsApp reminder link for an invoice.
    Works regardless of the automation master switch.
    The message tone adjusts automatically for Overdue invoices.
    """
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    client = (
        db.query(models.Client).filter(models.Client.id == invoice.client_id).first()
        if invoice.client_id else None
    )
    phone = (client.phone if client else "") or ""
    if not phone:
        raise HTTPException(status_code=422, detail="No phone number on record for this invoice's client")
    overdue = invoice.status == "Overdue"
    msg = invoice_reminder_message(invoice, client, overdue=overdue)
    link = build_whatsapp_link(phone, msg)
    if not link:
        raise HTTPException(status_code=422, detail="Could not build WhatsApp link — check the phone number format")
    return {"url": link}


# ---------- PDF downloads ----------

@router.get("/invoices/{invoice_id}/pdf")
def download_invoice_pdf(invoice_id: str, db: Session = Depends(get_db)):
    """Generate and stream a branded invoice PDF."""
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    client = (
        db.query(models.Client).filter(models.Client.id == invoice.client_id).first()
        if invoice.client_id else None
    )
    project = (
        db.query(models.Project).filter(models.Project.id == invoice.project_id).first()
        if invoice.project_id else None
    )
    pdf_bytes = generate_invoice_pdf(invoice, client, project)
    safe_number = (invoice.number or invoice_id[:8]).replace("/", "-")
    filename = f"invoice-{safe_number}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/contracts/{contract_id}/pdf")
def download_contract_pdf(contract_id: str, db: Session = Depends(get_db)):
    """Generate and stream a branded contract / SOW PDF."""
    contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    client = (
        db.query(models.Client).filter(models.Client.id == contract.client_id).first()
        if contract.client_id else None
    )
    project = (
        db.query(models.Project).filter(models.Project.id == contract.project_id).first()
        if contract.project_id else None
    )
    pdf_bytes = generate_contract_pdf(contract, client, project)
    safe_title = (contract.title or "contract").replace(" ", "-").replace("/", "-")[:50]
    filename = f"{safe_title}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
