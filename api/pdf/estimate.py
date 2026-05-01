"""Estimate PDF — same layout as invoice but with ESTIMATE watermark and no due date."""
from .base import (
    draw_header, draw_footer, draw_customer_box,
    draw_invoice_meta, draw_line_items_table, draw_summary_block, add_watermark,
    DEFAULT_MARGIN, PAGE_W, PAGE_H, FONT_TITLE, FONT_BODY
)
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from io import BytesIO
from typing import Dict, Any, Optional


def generate_estimate_pdf(estimate_data: Dict[str, Any], org_settings: Optional[Dict[str, Any]] = None) -> bytes:
    """Generate an estimate PDF with watermark."""
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)

    settings = org_settings or {}
    draw_header(
        c, settings.get("company_name", "AMAFAH Electronics"),
        logo_url=settings.get("logo_url"),
        primary_color=settings.get("primary_color", "#e94560"),
        tagline="Wholesale Electronics — Estimate"
    )

    add_watermark(c, "ESTIMATE")

    y = PAGE_H - DEFAULT_MARGIN - 60

    customer = estimate_data.get("customer", {})
    y = draw_customer_box(c, customer, y)

    meta = {
        "Estimate #": estimate_data.get("estimate_id", estimate_data.get("invoice_id", "—")),
        "Date": estimate_data.get("date", "—")[:10] if estimate_data.get("date") else "—",
        "Valid Until": estimate_data.get("valid_until", "—"),
    }
    draw_invoice_meta(c, meta, PAGE_H - DEFAULT_MARGIN - 60)

    lines = estimate_data.get("lines", [])
    y = draw_line_items_table(c, lines, y)

    summary = estimate_data.get("summary", {})
    y = draw_summary_block(c, summary, y)

    c.setFont(FONT_BODY, 9)
    c.drawString(DEFAULT_MARGIN, y - 10, "This is an estimate, not an invoice. Prices and availability subject to change.")

    draw_footer(c, terms=settings.get("invoice_terms", ""), page_num=1, total_pages=1)

    c.save()
    buf.seek(0)
    return buf.getvalue()
