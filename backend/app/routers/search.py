from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/search", tags=["search"], dependencies=[Depends(get_current_user)])

_LIMIT = 5


@router.get("", response_model=schemas.SearchResults)
def global_search(q: str = Query(default="", max_length=200), db: Session = Depends(get_db)):
    """
    Cross-entity full-text search.  Returns up to 5 results per category.
    Requires at least 2 characters to avoid returning the entire database.
    """
    if len(q.strip()) < 2:
        return schemas.SearchResults()

    pattern = f"%{q}%"

    # ---- Clients ----
    client_rows = (
        db.query(models.Client)
        .filter(or_(
            models.Client.company.ilike(pattern),
            models.Client.contact_name.ilike(pattern),
        ))
        .limit(_LIMIT)
        .all()
    )
    clients = [
        schemas.SearchItem(id=c.id, label=c.company, subtitle=c.contact_name or "")
        for c in client_rows
    ]

    # ---- Leads ----
    lead_rows = (
        db.query(models.Lead)
        .filter(or_(
            models.Lead.company.ilike(pattern),
            models.Lead.contact_name.ilike(pattern),
        ))
        .limit(_LIMIT)
        .all()
    )
    leads = [
        schemas.SearchItem(id=l.id, label=l.company, subtitle=l.stage)
        for l in lead_rows
    ]

    # ---- Projects ----
    project_rows = (
        db.query(models.Project, models.Client)
        .outerjoin(models.Client, models.Project.client_id == models.Client.id)
        .filter(models.Project.name.ilike(pattern))
        .limit(_LIMIT)
        .all()
    )
    projects = [
        schemas.SearchItem(
            id=p.id,
            label=p.name,
            subtitle=c.company if c else "",
        )
        for p, c in project_rows
    ]

    # ---- Invoices ----
    invoice_rows = (
        db.query(models.Invoice)
        .filter(models.Invoice.number.ilike(pattern))
        .limit(_LIMIT)
        .all()
    )
    invoices = [
        schemas.SearchItem(id=i.id, label=i.number, subtitle=i.status)
        for i in invoice_rows
    ]

    # ---- Contracts ----
    contract_rows = (
        db.query(models.Contract)
        .filter(models.Contract.title.ilike(pattern))
        .limit(_LIMIT)
        .all()
    )
    contracts = [
        schemas.SearchItem(id=c.id, label=c.title, subtitle=c.type)
        for c in contract_rows
    ]

    return schemas.SearchResults(
        clients=clients,
        leads=leads,
        projects=projects,
        invoices=invoices,
        contracts=contracts,
    )
