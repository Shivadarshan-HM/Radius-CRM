from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..services import automation

router = APIRouter(prefix="/invoices", tags=["invoices"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[schemas.InvoiceOut])
def list_invoices(db: Session = Depends(get_db)):
    return db.query(models.Invoice).order_by(models.Invoice.issue_date.desc()).all()


@router.post("", response_model=schemas.InvoiceOut)
def create_invoice(payload: schemas.InvoiceCreate, db: Session = Depends(get_db)):
    invoice = models.Invoice(**payload.model_dump())
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    # Automation: fetch client and fire trigger
    client = (
        db.query(models.Client).filter(models.Client.id == invoice.client_id).first()
        if invoice.client_id else None
    )
    automation.on_invoice_created(invoice, client, db)
    return invoice


@router.patch("/{invoice_id}", response_model=schemas.InvoiceOut)
def update_invoice(invoice_id: str, payload: schemas.InvoiceUpdate, db: Session = Depends(get_db)):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(invoice, k, v)
    db.commit()
    db.refresh(invoice)
    return invoice


@router.delete("/{invoice_id}", status_code=204)
def delete_invoice(invoice_id: str, db: Session = Depends(get_db)):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    db.delete(invoice)
    db.commit()
