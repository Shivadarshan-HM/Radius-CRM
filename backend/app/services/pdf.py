"""
PDF generation service for Radius Studios CRM.
Generates branded invoice and contract PDFs using reportlab.
"""
import io
import json
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

from ..config import settings

# ---------- Brand colours ----------
GOLD = colors.HexColor("#CBA135")
GOLD_HEX = "#CBA135"
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
    return f"Rs. {n:,.0f}"


def _fmt_date(d) -> str:
    if not d:
        return "—"
    if isinstance(d, str):
        try:
            d = date.fromisoformat(d)
        except ValueError:
            return d
    return d.strftime("%d %b %Y")


def _parse_line_items(invoice):
    """Parse line_items from the invoice — handles JSON string or list."""
    raw = getattr(invoice, "line_items", None)
    if not raw:
        return None
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            items = json.loads(raw)
            return items if isinstance(items, list) and len(items) > 0 else None
        except (json.JSONDecodeError, TypeError):
            return None
    return None


def generate_invoice_pdf(invoice, client, project) -> bytes:
    """Generate a branded invoice PDF matching the clean reference layout.
    Returns raw PDF bytes."""
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

    usable_w = PAGE_W - 2 * MARGIN

    # ---- Helper paragraph styles ----
    ps_right = ParagraphStyle("right", parent=styles["Normal"], alignment=TA_RIGHT)
    ps_label = ParagraphStyle("label", parent=styles["Normal"], fontSize=9,
                              textColor=colors.HexColor(GOLD_HEX), fontName="Helvetica-Bold")
    ps_label_right = ParagraphStyle("labelR", parent=ps_label, alignment=TA_RIGHT)

    # ---- Header: INVOICE (left) + R monogram + RADIUS STUDIOS (right) ----
    # Build the monogram as a paragraph with styled circle-like rendering
    monogram_html = (
        f'<font size="11" color="{GOLD_HEX}"><b>⊙</b></font>'
        f'&nbsp;&nbsp;<font size="16" color="{GOLD_HEX}"><b>RADIUS STUDIOS</b></font><br/>'
        f'<font size="9" color="#9B9894">{AGENCY_TAGLINE}</font>'
    )
    header_data = [[
        Paragraph(
            '<font size="26" color="#333333"><b>INVOICE</b></font>',
            styles["Normal"],
        ),
        Paragraph(monogram_html, ps_right),
    ]]
    header_tbl = Table(header_data, colWidths=[usable_w * 0.45, usable_w * 0.55])
    header_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(header_tbl)
    story.append(Spacer(1, 6 * mm))

    # ---- ISSUED TO + INVOICE NO/DATE/DUE DATE ----
    client_name = ""
    client_company = ""
    client_address = ""
    if client:
        client_name = getattr(client, "contact_name", "") or ""
        client_company = getattr(client, "company", "") or ""
        client_address = getattr(client, "address", "") or ""

    # Build left block: ISSUED TO
    issued_lines = f'<font size="9" color="{GOLD_HEX}"><b>ISSUED TO:</b></font><br/>'
    if client_name:
        issued_lines += f'<font size="12" color="#222222"><b>{client_name}</b></font><br/>'
        if client_company and client_company != client_name:
            issued_lines += f'<font size="10" color="#555555">{client_company}</font><br/>'
    elif client_company:
        issued_lines += f'<font size="12" color="#222222"><b>{client_company}</b></font><br/>'
    if client_address:
        issued_lines += f'<font size="9" color="#777777">{client_address}</font>'

    # Build right block: INVOICE NO, DATE, DUE DATE
    inv_number = getattr(invoice, "number", "") or ""
    issue_date_str = _fmt_date(getattr(invoice, "issue_date", None))
    due_date_str = _fmt_date(getattr(invoice, "due_date", None))

    meta_right = (
        f'<font size="9" color="{GOLD_HEX}"><b>INVOICE NO:</b></font>'
        f'&nbsp;&nbsp;<font size="11" color="#222222"><b>{inv_number}</b></font><br/>'
        f'<font size="9" color="{GOLD_HEX}"><b>DATE:</b></font>'
        f'&nbsp;&nbsp;<font size="10" color="#444444">{issue_date_str}</font><br/>'
        f'<font size="9" color="{GOLD_HEX}"><b>DUE DATE:</b></font>'
        f'&nbsp;&nbsp;<font size="10" color="#444444">{due_date_str}</font>'
    )

    meta_data = [[
        Paragraph(issued_lines, styles["Normal"]),
        Paragraph(meta_right, ps_right),
    ]]
    meta_tbl = Table(meta_data, colWidths=[usable_w * 0.55, usable_w * 0.45])
    meta_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 6 * mm))

    # ---- Line items table ----
    line_items = _parse_line_items(invoice)
    tax_percent = float(getattr(invoice, "tax_percent", 0) or 0)

    if line_items:
        # Itemized line items
        rows = []
        subtotal = 0
        for item in line_items:
            desc = item.get("description", "")
            rate = float(item.get("rate", 0))
            qty = int(item.get("qty", 1))
            total = rate * qty
            subtotal += total
            rows.append([desc, _fmt_inr(rate), str(qty), _fmt_inr(total)])
    else:
        # Fallback: single row using description/amount
        desc = getattr(invoice, "description", "") or "Professional services"
        amount = float(getattr(invoice, "amount", 0) or 0)
        subtotal = amount
        rows = [[desc, _fmt_inr(amount), "1", _fmt_inr(amount)]]

    # Header row
    header_row = [
        Paragraph(f'<font color="{GOLD_HEX}"><b>DESCRIPTION</b></font>', styles["Normal"]),
        Paragraph(f'<font color="{GOLD_HEX}"><b>RATE</b></font>', ps_right),
        Paragraph(f'<font color="{GOLD_HEX}"><b>QTY</b></font>', ps_right),
        Paragraph(f'<font color="{GOLD_HEX}"><b>TOTAL</b></font>', ps_right),
    ]

    # Data rows as paragraphs
    table_rows = [header_row]
    for row in rows:
        table_rows.append([
            Paragraph(f'<font size="10" color="#333333">{row[0]}</font>', styles["Normal"]),
            Paragraph(f'<font size="10" color="#333333">{row[1]}</font>', ps_right),
            Paragraph(f'<font size="10" color="#333333">{row[2]}</font>', ps_right),
            Paragraph(f'<font size="10" color="#333333">{row[3]}</font>', ps_right),
        ])

    col_widths = [usable_w * 0.46, usable_w * 0.18, usable_w * 0.12, usable_w * 0.24]
    items_tbl = Table(table_rows, colWidths=col_widths)

    # Styling: light background, thin grey rules
    tbl_style = [
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, 0), 1.2, colors.HexColor("#B8912E")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    # Add thin grey line below each data row
    for i in range(1, len(table_rows)):
        tbl_style.append(("LINEBELOW", (0, i), (-1, i), 0.5, colors.HexColor("#DDDDDD")))

    items_tbl.setStyle(TableStyle(tbl_style))
    story.append(items_tbl)
    story.append(Spacer(1, 4 * mm))

    # ---- SUBTOTAL / TAX / TOTAL block ----
    tax_amount = subtotal * (tax_percent / 100)
    total = round(subtotal + tax_amount)

    summary_rows = []
    summary_rows.append([
        "",
        Paragraph(f'<font size="10" color="{GOLD_HEX}"><b>SUBTOTAL</b></font>', ps_right),
        Paragraph(f'<font size="10" color="#333333">{_fmt_inr(subtotal)}</font>', ps_right),
    ])
    if tax_percent > 0:
        summary_rows.append([
            "",
            Paragraph(f'<font size="10" color="{GOLD_HEX}"><b>Tax</b></font>', ps_right),
            Paragraph(f'<font size="10" color="#333333">{tax_percent:g}%</font>', ps_right),
        ])
    summary_rows.append([
        "",
        Paragraph(f'<font size="12" color="{GOLD_HEX}"><b>TOTAL</b></font>', ps_right),
        Paragraph(f'<font size="12" color="{GOLD_HEX}"><b>{_fmt_inr(total)}</b></font>', ps_right),
    ])

    summary_tbl = Table(summary_rows, colWidths=[usable_w * 0.46, usable_w * 0.30, usable_w * 0.24])
    summary_tbl.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LINEABOVE", (1, -1), (-1, -1), 1, GOLD),
    ]))
    story.append(summary_tbl)
    story.append(Spacer(1, 10 * mm))

    # ---- PAYMENT INFO (only if bank details are configured) ----
    bank_name = settings.bank_name.strip()
    bank_acct_name = settings.bank_account_name.strip()
    bank_acct_num = settings.bank_account_number.strip()

    if bank_name or bank_acct_name or bank_acct_num:
        payment_left_lines = f'<font size="9" color="{GOLD_HEX}"><b>PAYMENT INFO:</b></font><br/>'
        if bank_name:
            payment_left_lines += f'<font size="10" color="#333333">{bank_name}</font><br/>'
        if bank_acct_name:
            payment_left_lines += f'<font size="10" color="#333333">Account Name: {bank_acct_name}</font><br/>'
        if bank_acct_num:
            payment_left_lines += f'<font size="10" color="#333333">Account No.: {bank_acct_num}</font>'

        # Right side: italic agency signature
        signature_html = (
            f'<font size="14" color="#555555"><i>{AGENCY_NAME}</i></font>'
        )
        ps_sig = ParagraphStyle("sig", parent=ps_right, fontName="Times-Italic")

        payment_data = [[
            Paragraph(payment_left_lines, styles["Normal"]),
            Paragraph(signature_html, ps_sig),
        ]]
        payment_tbl = Table(payment_data, colWidths=[usable_w * 0.55, usable_w * 0.45])
        payment_tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CCCCCC"), spaceAfter=8))
        story.append(payment_tbl)
        story.append(Spacer(1, 8 * mm))

    # ---- Footer ----
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
