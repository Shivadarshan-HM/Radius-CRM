"""
PDF generation service for Radius Studios CRM.
Generates branded invoice and contract PDFs using reportlab.
"""
import io
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

# ---------- Brand colours ----------
GOLD = colors.HexColor("#CBA135")
DARK = colors.HexColor("#0A0A0C")
SURFACE = colors.HexColor("#141417")
TEXT = colors.HexColor("#F1EFEA")
TEXT_DIM = colors.HexColor("#9B9894")
WHITE = colors.white
BLACK = colors.black

AGENCY_NAME = "Radius Studios"
AGENCY_DOMAIN = "radiusstudios.in"
AGENCY_EMAIL = "radiusstudio.co@gmail.com"
AGENCY_TAGLINE = "Web Design & Development Studio"

PAGE_W, PAGE_H = A4
MARGIN = 20 * mm


def _base_styles():
    styles = getSampleStyleSheet()
    return styles


def _fmt_inr(amount) -> str:
    try:
        n = float(amount or 0)
    except (TypeError, ValueError):
        n = 0
    return f"₹{n:,.0f}"


def _fmt_date(d) -> str:
    if not d:
        return "—"
    if isinstance(d, str):
        try:
            d = date.fromisoformat(d)
        except ValueError:
            return d
    return d.strftime("%d %b %Y")


def generate_invoice_pdf(invoice, client, project) -> bytes:
    """Generate a branded invoice PDF. Returns raw PDF bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
    )

    styles = _base_styles()
    story = []

    # ---- Header ----
    header_data = [
        [
            Paragraph(
                f'<font size="18" color="#CBA135"><b>{AGENCY_NAME}</b></font><br/>'
                f'<font size="9" color="#9B9894">{AGENCY_TAGLINE}</font>',
                styles["Normal"],
            ),
            Paragraph(
                f'<font size="9" color="#9B9894">{AGENCY_DOMAIN}<br/>{AGENCY_EMAIL}</font>',
                ParagraphStyle("right", parent=styles["Normal"], alignment=TA_RIGHT),
            ),
        ]
    ]
    header_tbl = Table(header_data, colWidths=[(PAGE_W - 2 * MARGIN) * 0.6, (PAGE_W - 2 * MARGIN) * 0.4])
    header_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(header_tbl)
    story.append(HRFlowable(width="100%", thickness=1.5, color=GOLD, spaceAfter=10))

    # ---- Invoice title ----
    story.append(Paragraph(
        f'<font size="22" color="#F1EFEA"><b>INVOICE</b></font>&nbsp;&nbsp;'
        f'<font size="13" color="#CBA135"><b>#{getattr(invoice, "number", "")}</b></font>',
        styles["Normal"],
    ))
    story.append(Spacer(1, 6 * mm))

    # ---- Meta grid ----
    client_name = getattr(client, "company", "—") if client else "—"
    project_name = getattr(project, "name", "—") if project else "—"
    meta_data = [
        ["Bill To", "Project", "Issue Date", "Due Date"],
        [
            client_name,
            project_name,
            _fmt_date(getattr(invoice, "issue_date", None)),
            _fmt_date(getattr(invoice, "due_date", None)),
        ],
    ]
    meta_tbl = Table(meta_data, colWidths=[(PAGE_W - 2 * MARGIN) / 4] * 4)
    meta_tbl.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("TEXTCOLOR", (0, 0), (-1, 0), TEXT_DIM),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica"),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, 1), 11),
        ("TEXTCOLOR", (0, 1), (-1, 1), BLACK),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F7F5F0")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 8 * mm))

    # ---- Line item table ----
    description = getattr(invoice, "description", "") or "Professional services"
    amount = float(getattr(invoice, "amount", 0) or 0)
    items_data = [
        ["Description", "Amount"],
        [description, _fmt_inr(amount)],
        ["", ""],
        [Paragraph("<b>Total Due</b>", styles["Normal"]), Paragraph(f"<b>{_fmt_inr(amount)}</b>", styles["Normal"])],
    ]
    col_w = PAGE_W - 2 * MARGIN
    items_tbl = Table(items_data, colWidths=[col_w * 0.72, col_w * 0.28])
    items_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#CBA135")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1A1408")),
        ("FONTSIZE", (0, 1), (-1, -1), 11),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 3), (-1, 3), colors.HexColor("#F0EDE4")),
        ("LINEABOVE", (0, 3), (-1, 3), 1, GOLD),
        ("LINEBELOW", (0, 1), (-1, 1), 0.5, colors.HexColor("#DDDDDD")),
    ]))
    story.append(items_tbl)
    story.append(Spacer(1, 10 * mm))

    # ---- Payment note ----
    story.append(Paragraph(
        '<font size="9" color="#555555">Please transfer to our account or pay via UPI. '
        f'Reference: <b>{getattr(invoice, "number", "")}</b>. Thank you for choosing {AGENCY_NAME}!</font>',
        styles["Normal"],
    ))
    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CCCCCC"), spaceAfter=6))
    story.append(Paragraph(
        f'<font size="8" color="#999999">{AGENCY_NAME} · {AGENCY_DOMAIN} · {AGENCY_EMAIL}</font>',
        ParagraphStyle("footer", parent=styles["Normal"], alignment=TA_CENTER),
    ))

    doc.build(story)
    return buf.getvalue()


def generate_contract_pdf(contract, client, project) -> bytes:
    """Generate a branded contract/SOW PDF. Returns raw PDF bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
    )

    styles = _base_styles()
    story = []

    # ---- Header ----
    header_data = [
        [
            Paragraph(
                f'<font size="18" color="#CBA135"><b>{AGENCY_NAME}</b></font><br/>'
                f'<font size="9" color="#9B9894">{AGENCY_TAGLINE}</font>',
                styles["Normal"],
            ),
            Paragraph(
                f'<font size="9" color="#9B9894">{AGENCY_DOMAIN}<br/>{AGENCY_EMAIL}</font>',
                ParagraphStyle("right", parent=styles["Normal"], alignment=TA_RIGHT),
            ),
        ]
    ]
    header_tbl = Table(header_data, colWidths=[(PAGE_W - 2 * MARGIN) * 0.6, (PAGE_W - 2 * MARGIN) * 0.4])
    header_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(header_tbl)
    story.append(HRFlowable(width="100%", thickness=1.5, color=GOLD, spaceAfter=10))

    # ---- Document type & title ----
    doc_type = getattr(contract, "type", "Contract") or "Contract"
    title = getattr(contract, "title", "Untitled") or "Untitled"
    story.append(Paragraph(
        f'<font size="9" color="#9B9894">{doc_type.upper()}</font>',
        styles["Normal"],
    ))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        f'<font size="20" color="#0A0A0C"><b>{title}</b></font>',
        styles["Normal"],
    ))
    story.append(Spacer(1, 6 * mm))

    # ---- Meta grid ----
    client_name = getattr(client, "company", "—") if client else "—"
    project_name = getattr(project, "name", "—") if project else "—"
    contract_value = _fmt_inr(getattr(contract, "value", 0))
    contract_date = _fmt_date(getattr(contract, "date", None))
    contract_status = getattr(contract, "status", "Draft") or "Draft"

    meta_data = [
        ["Client", "Project", "Contract Value", "Date", "Status"],
        [client_name, project_name, contract_value, contract_date, contract_status],
    ]
    col_w = (PAGE_W - 2 * MARGIN) / 5
    meta_tbl = Table(meta_data, colWidths=[col_w] * 5)
    meta_tbl.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("TEXTCOLOR", (0, 0), (-1, 0), TEXT_DIM),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, 1), 10),
        ("TEXTCOLOR", (0, 1), (-1, 1), BLACK),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F7F5F0")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 8 * mm))

    # ---- Scope & Terms section ----
    story.append(Paragraph(
        '<font size="10" color="#333333"><b>SCOPE &amp; TERMS</b></font>',
        styles["Normal"],
    ))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GOLD, spaceAfter=6))

    terms = getattr(contract, "terms", "") or "No terms specified."
    for para_text in terms.split("\n"):
        if para_text.strip():
            story.append(Paragraph(
                f'<font size="11" color="#222222">{para_text}</font>',
                ParagraphStyle(
                    "terms",
                    parent=styles["Normal"],
                    spaceAfter=4,
                    leading=16,
                ),
            ))
    story.append(Spacer(1, 14 * mm))

    # ---- Signature block ----
    sig_data = [
        [
            Paragraph(f"Authorised for <b>{AGENCY_NAME}</b>", styles["Normal"]),
            Paragraph(f"Accepted by <b>{client_name}</b>", styles["Normal"]),
        ],
        [
            Paragraph(
                '<font size="8" color="#999999">__________________________________<br/>Signature &amp; Date</font>',
                styles["Normal"],
            ),
            Paragraph(
                '<font size="8" color="#999999">__________________________________<br/>Signature &amp; Date</font>',
                styles["Normal"],
            ),
        ],
    ]
    sig_tbl = Table(sig_data, colWidths=[(PAGE_W - 2 * MARGIN) / 2] * 2)
    sig_tbl.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
    ]))
    story.append(sig_tbl)
    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CCCCCC"), spaceAfter=6))
    story.append(Paragraph(
        f'<font size="8" color="#999999">{AGENCY_NAME} · {AGENCY_DOMAIN} · {AGENCY_EMAIL}</font>',
        ParagraphStyle("footer", parent=styles["Normal"], alignment=TA_CENTER),
    ))

    doc.build(story)
    return buf.getvalue()
