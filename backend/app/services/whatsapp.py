"""
WhatsApp link builder and message templates for Radius Studios CRM.

All outreach is manual — these functions produce wa.me deep-links that
pre-fill a message in WhatsApp. Nothing is sent automatically.
"""
import re
from urllib.parse import quote


def build_whatsapp_link(phone: str, message: str) -> str | None:
    """
    Build a wa.me deep-link that pre-fills `message` for `phone`.

    Rules:
    - Strip all non-digit characters from phone.
    - If the cleaned number has ≤ 10 digits, prefix with "91" (India).
    - URL-encode the message text.
    - Return f"https://wa.me/{cleaned}?text={encoded}" or None if no usable number.
    """
    if not phone:
        return None

    digits = re.sub(r"\D", "", phone)
    if not digits:
        return None

    # Prefix with India country code if no country code present
    if len(digits) <= 10:
        digits = "91" + digits

    encoded = quote(message, safe="")
    return f"https://wa.me/{digits}?text={encoded}"


# ---------- Message templates ----------
# Tone: confident, warm, design-studio voice — never corporate or salesy.

def lead_acknowledgement_message(lead) -> str:
    """Acknowledgement message for a newly captured lead."""
    name = getattr(lead, "contact_name", "") or getattr(lead, "company", "there")
    first = name.split()[0] if name else "there"
    company = getattr(lead, "company", "") or ""

    lines = [
        f"Hey {first} 👋",
        "",
        f"Thanks for reaching out to Radius Studios{f' about {company}' if company and company != first else ''}! "
        "We've got your details and someone from our team will be in touch shortly.",
        "",
        "In the meantime, feel free to check out our work at radiusstudios.in",
        "",
        "— Radius Studios",
    ]
    return "\n".join(lines)


def sow_ready_message(contract, client) -> str:
    """Message to send when a Scope of Work is ready for a client."""
    client_name = ""
    if client:
        client_name = getattr(client, "contact_name", "") or getattr(client, "company", "")
    first = client_name.split()[0] if client_name else "there"

    contract_title = getattr(contract, "title", "your Scope of Work") or "your Scope of Work"

    lines = [
        f"Hey {first} 👋",
        "",
        f"Your Scope of Work is ready — *{contract_title}*.",
        "",
        "It covers the full project scope, deliverables, timeline and payment terms. "
        "Please review it and let us know if you have any questions before we get started.",
        "",
        "Looking forward to building this together!",
        "",
        "— Radius Studios",
    ]
    return "\n".join(lines)


def invoice_reminder_message(invoice, client, overdue: bool = False) -> str:
    """Polite invoice reminder. Tone shifts slightly for overdue vs. upcoming."""
    client_name = ""
    if client:
        client_name = getattr(client, "contact_name", "") or getattr(client, "company", "")
    first = client_name.split()[0] if client_name else "there"

    number = getattr(invoice, "number", "") or ""
    amount = getattr(invoice, "amount", 0) or 0
    try:
        amount_str = f"₹{float(amount):,.0f}"
    except (TypeError, ValueError):
        amount_str = str(amount)

    due_date = getattr(invoice, "due_date", None)
    due_str = ""
    if due_date:
        if hasattr(due_date, "strftime"):
            due_str = due_date.strftime("%d %b %Y")
        else:
            due_str = str(due_date)

    if overdue:
        lines = [
            f"Hey {first},",
            "",
            f"Just a gentle nudge — invoice *{number}* for *{amount_str}* was due on {due_str} "
            "and is showing as unpaid on our end.",
            "",
            "Could you let us know when to expect the transfer? "
            "Happy to help if there's anything blocking it.",
            "",
            "— Radius Studios",
        ]
    else:
        lines = [
            f"Hey {first} 👋",
            "",
            f"Quick heads-up that invoice *{number}* for *{amount_str}* is due on {due_str}.",
            "",
            "Let us know once the payment is done — and as always, feel free to reach out if you need anything.",
            "",
            "— Radius Studios",
        ]
    return "\n".join(lines)


def documents_ready_message(invoice, contract, client) -> str:
    """Message when NDA + Invoice have been generated for a client."""
    client_name = ""
    if client:
        client_name = getattr(client, "contact_name", "") or getattr(client, "company", "")
    first = client_name.split()[0] if client_name else "there"

    inv_number = getattr(invoice, "number", "") or ""
    amount = getattr(invoice, "amount", 0) or 0
    try:
        amount_str = f"₹{float(amount):,.0f}"
    except (TypeError, ValueError):
        amount_str = str(amount)

    lines = [
        f"Hey {first} 👋",
        "",
        f"We've put together the NDA and invoice *{inv_number}* ({amount_str}) for our upcoming engagement.",
        "",
        "Please review the NDA and let us know if you have any questions. "
        "Once everything looks good, we can get started right away!",
        "",
        "— Radius Studios",
    ]
    return "\n".join(lines)
