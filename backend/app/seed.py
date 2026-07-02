from datetime import date

from sqlalchemy.orm import Session

from . import models
from .config import settings
from .security import hash_password

d = date.fromisoformat


def seed_admin(db: Session):
    if db.query(models.User).count() > 0:
        return
    if settings.admin_email and settings.admin_password:
        user = models.User(
            email=settings.admin_email.lower(),
            hashed_password=hash_password(settings.admin_password),
        )
        db.add(user)
        db.commit()


def seed_sample_data(db: Session):
    if db.query(models.Client).count() > 0:
        return

    gof = models.Client(
        company="Game of Fitness",
        industry="Fitness & Gym",
        status="Active",
        source="Instagram",
        created_at=d("2026-06-15"),
        notes=(
            "Gym business client. Website + admin management system project. "
            "Full contract suite issued (SOW, Software Development Agreement, advance invoice GOF-001)."
        ),
    )
    mahaveer = models.Client(
        company="Mahaveer Electronics & Furniture",
        industry="Electronics & Furniture Retail",
        status="Active",
        source="Referral",
        created_at=d("2026-03-10"),
        notes=(
            "HD Kote, Karnataka. Production site live on Vercel. Google Search Console + "
            "sitemap/robots configured. Google Business Profile access requested."
        ),
    )
    db.add_all([gof, mahaveer])
    db.flush()

    gof_project = models.Project(
        name="Gym Website & Admin Management System",
        client_id=gof.id,
        type="Web App Development",
        stack="FastAPI",
        budget=20000,
        status="In Progress",
        start_date=d("2026-06-20"),
        notes="50% advance invoiced (GOF-001). Public gym website plus an admin management dashboard.",
    )
    mahaveer_project = models.Project(
        name="Mahaveer Electronics & Furniture — Website",
        client_id=mahaveer.id,
        type="Web Design",
        stack="Next.js 15, GSAP, Tailwind CSS, React Three Fiber, Vercel",
        budget=0,
        status="Completed",
        start_date=d("2026-03-15"),
        due_date=d("2026-05-20"),
        notes="Deployed to production on Vercel. SEO: Search Console, sitemap.xml, robots.txt configured.",
    )
    db.add_all([gof_project, mahaveer_project])
    db.flush()

    invoice = models.Invoice(
        number="GOF-001",
        client_id=gof.id,
        project_id=gof_project.id,
        description="Advance payment (50%) — Gym Website & Admin Management System",
        amount=10000,
        status="Sent",
        issue_date=d("2026-06-25"),
        due_date=d("2026-07-05"),
    )
    contract1 = models.Contract(
        title="Scope of Work — Gym Website & Admin Management System",
        type="Scope of Work (SOW)",
        client_id=gof.id,
        project_id=gof_project.id,
        value=20000,
        status="Signed",
        date=d("2026-06-18"),
        terms=(
            "Design and development of a public gym website plus an admin management dashboard "
            "for Game of Fitness, built with FastAPI. Payment: 50% advance, 50% on delivery. "
            "Two rounds of revisions included."
        ),
    )
    contract2 = models.Contract(
        title="Software Development Agreement — Game of Fitness",
        type="Software Development Agreement",
        client_id=gof.id,
        project_id=gof_project.id,
        value=20000,
        status="Signed",
        date=d("2026-06-18"),
        terms=(
            "Governing agreement covering IP ownership, delivery timeline, support terms, "
            "and payment schedule for the Game of Fitness website and admin system build."
        ),
    )
    db.add_all([invoice, contract1, contract2])
    db.commit()
