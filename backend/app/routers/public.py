"""
Public (unauthenticated) router — currently exposes only the lead-capture endpoint.

Spam defences implemented:
  1. Honeypot field: if `website` is non-empty the request silently returns 200 without
     creating anything, so bots can't detect they were caught.
  2. In-memory per-IP rate limit (max 5 requests per IP per hour).
     NOTE: this dict resets on every server restart and is NOT shared across multiple
     instances / workers. It's an intentional stopgap for a single-process deploy — not a
     substitute for a proper Redis-backed rate limiter.
"""

import time
from collections import defaultdict
from typing import Dict, List

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services import automation

router = APIRouter(prefix="/public", tags=["public"])

# ---- In-memory per-IP rate limit store ----
# Structure: { ip_address: [unix_timestamp, ...] }
_rate_store: Dict[str, List[float]] = defaultdict(list)
_RATE_LIMIT = 5        # max requests
_RATE_WINDOW = 3600    # per second window (1 hour)


def _rate_limit_exceeded(ip: str) -> bool:
    now = time.time()
    window_start = now - _RATE_WINDOW
    # Drop timestamps older than the window
    _rate_store[ip] = [t for t in _rate_store[ip] if t > window_start]
    if len(_rate_store[ip]) >= _RATE_LIMIT:
        return True
    _rate_store[ip].append(now)
    return False


@router.post("/leads")
def public_create_lead(
    payload: schemas.PublicLeadCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Public lead-capture endpoint — called from the /apply page and the
    embeddable form on radiusstudios.in.

    Always returns a generic success shape regardless of whether the
    submission was actually accepted, so bots cannot fingerprint the
    honeypot or rate-limit checks.
    """
    _SUCCESS = {"message": "Thank you! We'll be in touch soon."}

    # 1. Honeypot check — real browsers never populate this field
    if payload.website:
        return _SUCCESS

    # 2. Rate limit by client IP
    client_ip = request.client.host if request.client else "unknown"
    if _rate_limit_exceeded(client_ip):
        return _SUCCESS

    # 3. Create the lead
    lead = models.Lead(
        company=payload.company,
        contact_name=payload.contact_name,
        email=payload.email,
        phone=payload.phone,
        stage="New",
        source="Website",
        notes=payload.message,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)

    # 4. Fire automation hook (safe — never raises)
    try:
        automation.on_lead_created(lead, db)
    except Exception:
        pass  # automation failures must never block the public response

    return _SUCCESS
