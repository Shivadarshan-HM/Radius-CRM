import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..services import automation

router = APIRouter(prefix="/invoices", tags=["invoices"], dependencies=[Depends(get_current_user)])


def _encode_line_items(data: dict) -> dict:
    """Convert line_items list to JSON string for DB storage and
    recompute amount from line_items + tax_percent if present."""
    d = dict(data)
    items = d.pop("line_items", None)
    tax = d.get("tax_percent", None)

    if items is not None:
        d["line_items"] = json.dumps(items) if items else None
        # Recompute amount from line items
        if items:
            subtotal = sum(float(it.get("rate", 0)) * int(it.get("qty", 1)) for it in items)
            tp = float(tax if tax is not None else 0)
            d["amount"] = round(subtotal * (1 + tp / 100))
    elif tax is not None and "amount" not in d:
        # tax changed but no line_items in this request — skip recompute
        pass

    return d


def _decode_line_items(invoice) -> dict:
    """Build an InvoiceOut-compatible dict with line_items decoded from JSON."""
    d = {c.key: getattr(invoice, c.key) for c in invoice.__table__.columns}
    if d.get("line_items"):
        try:
            d["line_items"] = json.loads(d["line_items"])
        except (json.JSONDecodeError, TypeError):
            d["line_items"] = None
    else:
        d["line_items"] = None
    d["tax_percent"] = float(d.get("tax_percent", 0) or 0)
    return d


@router.get("", response_model=list[schemas.InvoiceOut])
def list_invoices(db: Session = Depends(get_db)):
    invoices = db.query(models.Invoice).order_by(models.Invoice.issue_date.desc()).all()
    return [_decode_line_items(i) for i in invoices]


@router.post("", response_model=schemas.InvoiceOut)
def create_invoice(payload: schemas.InvoiceCreate, db: Session = Depends(get_db)):
    data = _encode_line_items(payload.model_dump())
    invoice = models.Invoice(**data)
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    # Automation: fetch client and fire trigger
    client = (
        db.query(models.Client).filter(models.Client.id == invoice.client_id).first()
        if invoice.client_id else None
    )
    automation.on_invoice_created(invoice, client, db)
    return _decode_line_items(invoice)


@router.patch("/{invoice_id}", response_model=schemas.InvoiceOut)
def update_invoice(invoice_id: str, payload: schemas.InvoiceUpdate, db: Session = Depends(get_db)):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    data = _encode_line_items(payload.model_dump(exclude_unset=True))
    for k, v in data.items():
        setattr(invoice, k, v)
    db.commit()
    db.refresh(invoice)
    return _decode_line_items(invoice)


@router.delete("/{invoice_id}", status_code=204)
def delete_invoice(invoice_id: str, db: Session = Depends(get_db)):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    db.delete(invoice)
    db.commit()
