import json
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..config import settings
from ..templates.nda import NDA_TEMPLATE
from ..services.whatsapp import build_whatsapp_link, documents_ready_message

router = APIRouter(prefix="/clients", tags=["clients"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[schemas.ClientOut])
def list_clients(db: Session = Depends(get_db)):
    return db.query(models.Client).order_by(models.Client.created_at.desc()).all()


@router.post("", response_model=schemas.ClientOut)
def create_client(payload: schemas.ClientCreate, db: Session = Depends(get_db)):
    client = models.Client(**payload.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.patch("/{client_id}", response_model=schemas.ClientOut)
def update_client(client_id: str, payload: schemas.ClientUpdate, db: Session = Depends(get_db)):
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(client, k, v)
    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=204)
def delete_client(client_id: str, db: Session = Depends(get_db)):
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")
    db.delete(client)
    db.commit()


# ---------- Generate NDA & Invoice ----------

def _next_invoice_number(db: Session) -> str:
    """Generate the next invoice number in RS-NNN format."""
    count = db.query(models.Invoice).count()
    return f"RS-{str(count + 1).zfill(3)}"


def _decode_invoice(invoice) -> dict:
    """Build an InvoiceOut-compatible dict with line_items decoded."""
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


@router.post("/{client_id}/generate-documents")
def generate_documents(
    client_id: str,
    payload: schemas.GenerateDocumentsRequest,
    db: Session = Depends(get_db),
):
    """
    Generate an NDA contract + itemized invoice for a client.
    Returns created records plus PDF and WhatsApp links.
    """
    # ---- Resolve client ----
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")

    # ---- Resolve project ----
    projects = (
        db.query(models.Project)
        .filter(models.Project.client_id == client_id)
        .all()
    )
    if len(projects) == 0:
        raise HTTPException(400, "This client has no projects. Add a project first.")

    project = None
    if payload.project_id:
        project = next((p for p in projects if p.id == payload.project_id), None)
        if not project:
            raise HTTPException(400, "Project not found for this client.")
    elif len(projects) == 1:
        project = projects[0]
    else:
        raise HTTPException(
            400,
            "This client has multiple projects — please specify a project_id.",
        )

    # ---- Duplicate guard ----
    if not payload.force:
        existing_nda = (
            db.query(models.Contract)
            .filter(
                models.Contract.client_id == client_id,
                models.Contract.project_id == project.id,
                models.Contract.type == "NDA",
                models.Contract.status == "Draft",
            )
            .first()
        )
        if existing_nda:
            return {
                "duplicate_warning": (
                    f"A Draft NDA already exists for this client + project "
                    f"(created {existing_nda.date}). "
                    f"Set force=true to create another one."
                ),
                "existing_nda_id": existing_nda.id,
            }

    # ---- Line items ----
    line_items = payload.line_items
    if not line_items:
        line_items = [
            {
                "description": project.name,
                "rate": float(project.budget or 0),
                "qty": 1,
            }
        ]

    tax_percent = payload.tax_percent
    subtotal = sum(
        float(it.get("rate", 0)) * int(it.get("qty", 1)) for it in line_items
    )
    amount = round(subtotal * (1 + tax_percent / 100))

    # ---- Create Invoice ----
    invoice_number = _next_invoice_number(db)
    today = date.today()
    invoice = models.Invoice(
        number=invoice_number,
        client_id=client.id,
        project_id=project.id,
        description=f"Invoice for {project.name}",
        amount=amount,
        tax_percent=tax_percent,
        line_items=json.dumps(line_items),
        status="Draft",
        issue_date=today,
        due_date=today + timedelta(days=30),
    )
    db.add(invoice)

    # ---- Create NDA Contract ----
    nda_terms = NDA_TEMPLATE.format(
        date=today.strftime("%d %b %Y"),
        client_company=client.company,
    )
    contract = models.Contract(
        title=f"NDA — {client.company}",
        type="NDA",
        client_id=client.id,
        project_id=project.id,
        value=0,
        status="Draft",
        date=today,
        terms=nda_terms,
    )
    db.add(contract)
    db.commit()
    db.refresh(invoice)
    db.refresh(contract)

    # ---- Build URLs ----
    invoice_pdf_url = f"/automation/invoices/{invoice.id}/pdf"
    contract_pdf_url = f"/automation/contracts/{contract.id}/pdf"

    # ---- WhatsApp links ----
    invoice_wa_url = None
    contract_wa_url = None
    phone = client.phone or ""
    if phone:
        msg = documents_ready_message(invoice, contract, client)
        invoice_wa_url = build_whatsapp_link(phone, msg)
        contract_wa_url = invoice_wa_url  # same message covers both docs

    return {
        "invoice": _decode_invoice(invoice),
        "contract": {
            c.key: getattr(contract, c.key) for c in contract.__table__.columns
        },
        "invoice_pdf_url": invoice_pdf_url,
        "contract_pdf_url": contract_pdf_url,
        "invoice_whatsapp_url": invoice_wa_url,
        "contract_whatsapp_url": contract_wa_url,
        "duplicate_warning": None,
        "existing_nda_id": None,
    }
