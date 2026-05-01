"""Client statement PDF with aging buckets."""
from .base import (
    draw_header, draw_footer, draw_customer_box,
    DEFAULT_MARGIN, PAGE_W, PAGE_H, FONT_TITLE, FONT_BODY, FONT_SMALL
)
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from io import BytesIO
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta


def _bucket_age(days: int) -> str:
    if days <= 30:
        return "Current (1-30)"
    elif days <= 60:
        return "31-60 days"
    elif days <= 90:
        return "61-90 days"
    else:
        return "90+ days"


def generate_statement_pdf(statement_data: Dict[str, Any],
                           org_settings: Optional[Dict[str, Any]] = None) -> bytes:
    """Generate client statement PDF with aging columns."""
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)

    settings = org_settings or {}
    draw_header(
        c, settings.get("company_name", "AMAFAH Electronics"),
        logo_url=settings.get("logo_url"),
        primary_color=settings.get("primary_color", "#e94560"),
        tagline="Client Statement"
    )

    y = PAGE_H - DEFAULT_MARGIN - 60

    customer = statement_data.get("customer", {})
    y = draw_customer_box(c, customer, y)

    period = statement_data.get("period", {})
    c.setFont(FONT_BODY, 9)
    c.drawString(PAGE_W - DEFAULT_MARGIN - 200, PAGE_H - DEFAULT_MARGIN - 60,
                 f"Period: {period.get('start', 'N/A')} — {period.get('end', 'N/A')}")

    y -= 15

    # Column layout
    cols = {
        "date": DEFAULT_MARGIN,
        "number": DEFAULT_MARGIN + 60,
        "description": DEFAULT_MARGIN + 140,
        "amount": DEFAULT_MARGIN + 320,
        "paid": DEFAULT_MARGIN + 390,
        "balance": PAGE_W - DEFAULT_MARGIN - 80,
    }

    c.setFillColor(colors.HexColor("#f3f4f6"))
    c.rect(DEFAULT_MARGIN, y - 5, PAGE_W - 2 * DEFAULT_MARGIN, 20, fill=True, stroke=False)
    c.setFillColor(colors.black)
    c.setFont(FONT_TITLE, 9)
    c.drawString(cols["date"], y, "Date")
    c.drawString(cols["number"], y, "Invoice #")
    c.drawString(cols["description"], y, "Description")
    c.drawRightString(cols["amount"] + 50, y, "Total")
    c.drawRightString(cols["paid"] + 50, y, "Paid")
    c.drawRightString(cols["balance"] + 60, y, "Balance Due")
    y -= 25

    now = datetime.utcnow()
    invoices = statement_data.get("invoices", [])
    c.setFont(FONT_BODY, 8)

    for inv in invoices:
        if y < 100:
            c.showPage()
            y = PAGE_H - DEFAULT_MARGIN

        inv_date = inv.get("date", "")
        if isinstance(inv_date, str) and len(inv_date) >= 10:
            inv_date = inv_date[:10]

        c.drawString(cols["date"], y, str(inv_date))
        c.drawString(cols["number"], y, str(inv.get("number", inv.get("invoice_number", "")))[:12])
        c.drawString(cols["description"], y, str(inv.get("status", ""))[:20])
        c.drawRightString(cols["amount"] + 50, y, f"${inv.get('total', 0):.2f}")
        c.drawRightString(cols["paid"] + 50, y, f"${inv.get('paid', 0):.2f}")
        c.drawRightString(cols["balance"] + 60, y, f"${inv.get('balance', 0):.2f}")
        y -= 14

    y -= 15
    c.setStrokeColor(colors.HexColor("#e94560"))
    c.setLineWidth(1)
    c.line(DEFAULT_MARGIN + 280, y + 5, PAGE_W - DEFAULT_MARGIN, y + 5)

    y -= 5
    c.setFont(FONT_TITLE, 11)
    c.drawRightString(cols["balance"] + 60, y - 8,
                      f"Outstanding: ${statement_data.get('outstanding_balance', 0):.2f}")

    draw_footer(c, terms=settings.get("invoice_terms", ""), page_num=1, total_pages=1)
    c.save()
    buf.seek(0)
    return buf.getvalue()
