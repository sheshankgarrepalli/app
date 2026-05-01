"""Retail and wholesale invoice PDF generation."""
from .base import (
    draw_header, draw_footer, draw_customer_box,
    draw_invoice_meta, draw_line_items_table, draw_summary_block,
    DEFAULT_MARGIN, PAGE_W, PAGE_H, FONT_TITLE, FONT_BODY
)
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from io import BytesIO
from typing import Dict, Any, Optional


def generate_invoice_pdf(invoice_data: Dict[str, Any], org_settings: Optional[Dict[str, Any]] = None) -> bytes:
    """Generate a retail/wholesale invoice PDF."""
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)

    settings = org_settings or {}
    company_name = settings.get("company_name", "AMAFAH Electronics")
    draw_header(
        c, company_name,
        logo_url=settings.get("logo_url"),
        primary_color=settings.get("primary_color", "#e94560"),
        tagline=settings.get("tagline", "Wholesale Electronics — Inventory & POS")
    )

    y = PAGE_H - DEFAULT_MARGIN - 60

    customer = invoice_data.get("customer", {})
    y = draw_customer_box(c, customer, y)

    due_date = invoice_data.get("due_date", "—")
    meta = {
        "Invoice #": invoice_data.get("invoice_id", "—"),
        "Date": invoice_data.get("date", "—")[:10] if invoice_data.get("date") else "—",
        "Due Date": due_date[:10] if isinstance(due_date, str) and len(due_date) > 10 else str(due_date),
    }
    draw_invoice_meta(c, meta, PAGE_H - DEFAULT_MARGIN - 60)

    lines = invoice_data.get("lines", [])
    y = draw_line_items_table(c, lines, y)

    summary = invoice_data.get("summary", {})
    summary["balance_due"] = summary.get("total_due", summary.get("total", 0))
    y = draw_summary_block(c, summary, y)

    if invoice_data.get("message_on_invoice"):
        y -= 10
        c.setFont(FONT_BODY, 9)
        c.drawString(DEFAULT_MARGIN, y, invoice_data["message_on_invoice"])

    terms = settings.get("invoice_terms", "All sales are final.")
    draw_footer(c, terms=terms, page_num=1, total_pages=1)

    c.save()
    buf.seek(0)
    return buf.getvalue()
