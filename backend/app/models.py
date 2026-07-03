import uuid
from datetime import date, datetime

from sqlalchemy import String, Numeric, Date, DateTime, ForeignKey, Text, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Client(Base):
    __tablename__ = "clients"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_name: Mapped[str] = mapped_column(String(255), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    industry: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(50), default="Active")
    source: Mapped[str] = mapped_column(String(50), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[date] = mapped_column(Date, default=date.today)

    projects = relationship("Project", back_populates="client", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="client", cascade="all, delete-orphan")
    contracts = relationship("Contract", back_populates="client", cascade="all, delete-orphan")


class Lead(Base):
    __tablename__ = "leads"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_name: Mapped[str] = mapped_column(String(255), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    stage: Mapped[str] = mapped_column(String(50), default="New")
    source: Mapped[str] = mapped_column(String(50), default="Other")
    value: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[date] = mapped_column(Date, default=date.today)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("clients.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(50), default="Web Development")
    stack: Mapped[str] = mapped_column(String(255), default="")
    budget: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    status: Mapped[str] = mapped_column(String(50), default="Planning")
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")

    client = relationship("Client", back_populates="projects")
    invoices = relationship("Invoice", back_populates="project", cascade="all, delete-orphan")
    contracts = relationship("Contract", back_populates="project", cascade="all, delete-orphan")


class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    number: Mapped[str] = mapped_column(String(50), nullable=False)
    client_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("clients.id"), nullable=True)
    project_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("projects.id"), nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    status: Mapped[str] = mapped_column(String(50), default="Draft")
    issue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    client = relationship("Client", back_populates="invoices")
    project = relationship("Project", back_populates="invoices")


class Contract(Base):
    __tablename__ = "contracts"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(100), default="Scope of Work (SOW)")
    client_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("clients.id"), nullable=True)
    project_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("projects.id"), nullable=True)
    value: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    status: Mapped[str] = mapped_column(String(50), default="Draft")
    date: Mapped[date | None] = mapped_column(Date, nullable=True)
    terms: Mapped[str] = mapped_column(Text, default="")

    client = relationship("Client", back_populates="contracts")
    project = relationship("Project", back_populates="contracts")


# ---------- Automation ----------

class AutomationSettings(Base):
    __tablename__ = "automation_settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    automation_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_acknowledge_leads: Mapped[bool] = mapped_column(Boolean, default=True)
    auto_generate_sow_on_won: Mapped[bool] = mapped_column(Boolean, default=True)
    auto_invoice_on_project_complete: Mapped[bool] = mapped_column(Boolean, default=True)
    auto_whatsapp_invoice_reminders: Mapped[bool] = mapped_column(Boolean, default=True)


class AutomationLog(Base):
    __tablename__ = "automation_logs"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    event: Mapped[str] = mapped_column(String(100))
    entity_type: Mapped[str] = mapped_column(String(50), default="")
    entity_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    action: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(20), default="success")
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
