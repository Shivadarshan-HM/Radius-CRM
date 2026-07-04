from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine, SessionLocal
from .routers import auth, clients, leads, projects, invoices, contracts, analytics
from .routers import automation
from .routers import tasks, search
from .routers import public as public_router
from . import seed
from .scheduler import start_scheduler, scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---- Startup ----
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed.seed_admin(db)
        seed.seed_sample_data(db)
    finally:
        db.close()
    start_scheduler()
    yield
    # ---- Shutdown ----
    if scheduler.running:
        scheduler.shutdown(wait=False)


app = FastAPI(title="Radius Studios CRM API", version="1.0.0", lifespan=lifespan)
print("=== DEBUG CORS ORIGINS ===", settings.cors_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(clients.router)
app.include_router(leads.router)
app.include_router(projects.router)
app.include_router(invoices.router)
app.include_router(contracts.router)
app.include_router(analytics.router)
app.include_router(automation.router)
app.include_router(tasks.router)
app.include_router(search.router)
app.include_router(public_router.router)


@app.get("/health")
def health():
    return {"status": "ok"}
