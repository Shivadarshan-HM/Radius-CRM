from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..services import automation

router = APIRouter(prefix="/leads", tags=["leads"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[schemas.LeadOut])
def list_leads(db: Session = Depends(get_db)):
    return db.query(models.Lead).order_by(models.Lead.created_at.desc()).all()


@router.post("", response_model=schemas.LeadOut)
def create_lead(payload: schemas.LeadCreate, db: Session = Depends(get_db)):
    lead = models.Lead(**payload.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    # Automation: fire after successful commit — never blocks the response
    automation.on_lead_created(lead, db)
    return lead


@router.patch("/{lead_id}", response_model=schemas.LeadOut)
def update_lead(lead_id: str, payload: schemas.LeadUpdate, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    old_stage = lead.stage
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(lead, k, v)
    db.commit()
    db.refresh(lead)
    new_stage = lead.stage
    # Automation: detect stage change and fire trigger
    if old_stage != new_stage:
        automation.on_lead_stage_changed(lead, old_stage, new_stage, db)
    return lead


@router.delete("/{lead_id}", status_code=204)
def delete_lead(lead_id: str, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    db.delete(lead)
    db.commit()
