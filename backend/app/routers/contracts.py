from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/contracts", tags=["contracts"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[schemas.ContractOut])
def list_contracts(db: Session = Depends(get_db)):
    return db.query(models.Contract).order_by(models.Contract.date.desc()).all()


@router.post("", response_model=schemas.ContractOut)
def create_contract(payload: schemas.ContractCreate, db: Session = Depends(get_db)):
    contract = models.Contract(**payload.model_dump())
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract


@router.patch("/{contract_id}", response_model=schemas.ContractOut)
def update_contract(contract_id: str, payload: schemas.ContractUpdate, db: Session = Depends(get_db)):
    contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(404, "Contract not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(contract, k, v)
    db.commit()
    db.refresh(contract)
    return contract


@router.delete("/{contract_id}", status_code=204)
def delete_contract(contract_id: str, db: Session = Depends(get_db)):
    contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(404, "Contract not found")
    db.delete(contract)
    db.commit()
