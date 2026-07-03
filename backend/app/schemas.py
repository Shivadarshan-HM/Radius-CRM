import datetime as dt
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth ----------
class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORMBase):
    id: str
    email: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Client ----------
class ClientBase(BaseModel):
    company: str
    contact_name: str = ""
    email: str = ""
    phone: str = ""
    industry: str = ""
    status: str = "Active"
    source: str = ""
    notes: str = ""
    created_at: Optional[dt.date] = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    company: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    industry: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None


class ClientOut(ClientBase, ORMBase):
    id: str


# ---------- Lead ----------
class LeadBase(BaseModel):
    company: str
    contact_name: str = ""
    email: str = ""
    phone: str = ""
    stage: str = "New"
    source: str = "Other"
    value: float = 0
    notes: str = ""


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    company: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    stage: Optional[str] = None
    source: Optional[str] = None
    value: Optional[float] = None
    notes: Optional[str] = None


class LeadOut(LeadBase, ORMBase):
    id: str
    created_at: dt.date


# ---------- Project ----------
class ProjectBase(BaseModel):
    name: str
    client_id: Optional[str] = None
    type: str = "Web Development"
    stack: str = ""
    budget: float = 0
    status: str = "Planning"
    start_date: Optional[dt.date] = None
    due_date: Optional[dt.date] = None
    notes: str = ""


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_id: Optional[str] = None
    type: Optional[str] = None
    stack: Optional[str] = None
    budget: Optional[float] = None
    status: Optional[str] = None
    start_date: Optional[dt.date] = None
    due_date: Optional[dt.date] = None
    notes: Optional[str] = None


class ProjectOut(ProjectBase, ORMBase):
    id: str


# ---------- Invoice ----------
class InvoiceBase(BaseModel):
    number: str
    client_id: Optional[str] = None
    project_id: Optional[str] = None
    description: str = ""
    amount: float = 0
    status: str = "Draft"
    issue_date: Optional[dt.date] = None
    due_date: Optional[dt.date] = None


class InvoiceCreate(InvoiceBase):
    pass


class InvoiceUpdate(BaseModel):
    number: Optional[str] = None
    client_id: Optional[str] = None
    project_id: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    status: Optional[str] = None
    issue_date: Optional[dt.date] = None
    due_date: Optional[dt.date] = None


class InvoiceOut(InvoiceBase, ORMBase):
    id: str


# ---------- Contract ----------
class ContractBase(BaseModel):
    title: str
    type: str = "Scope of Work (SOW)"
    client_id: Optional[str] = None
    project_id: Optional[str] = None
    value: float = 0
    status: str = "Draft"
    date: Optional[dt.date] = None
    terms: str = ""


class ContractCreate(ContractBase):
    pass


class ContractUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    client_id: Optional[str] = None
    project_id: Optional[str] = None
    value: Optional[float] = None
    status: Optional[str] = None
    date: Optional[dt.date] = None
    terms: Optional[str] = None


class ContractOut(ContractBase, ORMBase):
    id: str


# ---------- Analytics ----------
class RevenuePoint(BaseModel):
    month: str
    amount: float


class FunnelPoint(BaseModel):
    stage: str
    count: int


class StatusPoint(BaseModel):
    status: str
    count: int


class AnalyticsSummary(BaseModel):
    revenue_trend: list[RevenuePoint]
    lead_funnel: list[FunnelPoint]
    project_status: list[StatusPoint]


# ---------- Automation ----------
class AutomationSettingsOut(ORMBase):
    id: int
    automation_enabled: bool
    auto_acknowledge_leads: bool
    auto_generate_sow_on_won: bool
    auto_invoice_on_project_complete: bool
    auto_whatsapp_invoice_reminders: bool


class AutomationSettingsUpdate(BaseModel):
    automation_enabled: Optional[bool] = None
    auto_acknowledge_leads: Optional[bool] = None
    auto_generate_sow_on_won: Optional[bool] = None
    auto_invoice_on_project_complete: Optional[bool] = None
    auto_whatsapp_invoice_reminders: Optional[bool] = None


class AutomationLogOut(ORMBase):
    id: str
    event: str
    entity_type: str
    entity_id: Optional[str]
    action: str
    status: str
    detail: str
    created_at: dt.datetime
