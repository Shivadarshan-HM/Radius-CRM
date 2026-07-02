from datetime import date
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"], dependencies=[Depends(get_current_user)])

LEAD_STAGES = ["New", "Contacted", "Proposal Sent", "Won", "Lost"]
PROJECT_STATUSES = ["Planning", "In Progress", "Review", "Completed", "On Hold"]


@router.get("/summary", response_model=schemas.AnalyticsSummary)
def summary(db: Session = Depends(get_db)):
    # --- Revenue trend: paid invoices, last 6 calendar months ---
    today = date.today()
    months = []
    for i in range(5, -1, -1):
        m = today - relativedelta(months=i)
        months.append(m.strftime("%Y-%m"))

    month_expr = func.to_char(models.Invoice.issue_date, "YYYY-MM")
    rows = (
        db.query(month_expr.label("month"), func.sum(models.Invoice.amount).label("total"))
        .filter(models.Invoice.status == "Paid")
        .group_by(month_expr)
        .all()
    )
    totals_by_month = {r.month: float(r.total or 0) for r in rows}
    revenue_trend = [{"month": m, "amount": totals_by_month.get(m, 0.0)} for m in months]

    # --- Lead funnel ---
    lead_rows = db.query(models.Lead.stage, func.count(models.Lead.id)).group_by(models.Lead.stage).all()
    lead_counts = {stage: count for stage, count in lead_rows}
    lead_funnel = [{"stage": s, "count": lead_counts.get(s, 0)} for s in LEAD_STAGES]

    # --- Project status breakdown ---
    proj_rows = db.query(models.Project.status, func.count(models.Project.id)).group_by(models.Project.status).all()
    proj_counts = {status: count for status, count in proj_rows}
    project_status = [{"status": s, "count": proj_counts.get(s, 0)} for s in PROJECT_STATUSES if proj_counts.get(s, 0) > 0]
    if not project_status:
        project_status = [{"status": s, "count": 0} for s in PROJECT_STATUSES]

    return {
        "revenue_trend": revenue_trend,
        "lead_funnel": lead_funnel,
        "project_status": project_status,
    }
