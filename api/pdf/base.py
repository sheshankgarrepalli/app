"""Shared PDF layout utilities — header, footer, table rendering."""
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from typing import Optional, List, Dict, Any
from io import BytesIO
import requests

PAGE_W, PAGE_H = letter
DEFAULT_MARGIN = 50
FONT_TITLE = "Helvetica-Bold"
FONT_BODY = "Helvetica"
FONT_SMALL = "Helvetica"


def draw_header(c: canvas.Canvas, company_name: str, logo_url: Optional[str] = None,
                primary_color: str = "#e94560", tagline: str = ""):
    """Draw the company header with optional logo."""
    y = PAGE_H - DEFAULT_MARGIN

    if logo_url:
        try:
            resp = requests.get(logo_url, timeout=5)
            if resp.status_code == 200:
                from reportlab.lib.utils import ImageReader
                logo_img = ImageReader(BytesIO(resp.content))
                c.drawImage(logo_img, DEFAULT_MARGIN, y - 40, width=120, height=40, preserveAspectRatio=True, mask='auto')
        except Exception:
            pass

    c.setFillColor(colors.HexColor(primary_color))
    c.setFont(FONT_TITLE, 20)
    c.drawString(DEFAULT_MARGIN if not logo_url else DEFAULT_MARGIN + 130, y - 10, company_name)

    if tagline:
        c.setFillColor(colors.gray)
        c.setFont(FONT_SMALL, 8)
        c.drawString(DEFAULT_MARGIN if not logo_url else DEFAULT_MARGIN + 130, y - 25, tagline)

    c.setStrokeColor(colors.HexColor(primary_color))
    c.setLineWidth(1.5)
    c.line(DEFAULT_MARGIN, y - 45, PAGE_W - DEFAULT_MARGIN, y - 45)


def draw_footer(c: canvas.Canvas, terms: str = "", page_num: int = 1, total_pages: int = 1):
    """Draw footer with invoice terms and page number."""
    c.setStrokeColor(colors.lightgrey)
    c.setLineWidth(0.5)
    c.line(DEFAULT_MARGIN, 50, PAGE_W - DEFAULT_MARGIN, 50)

    c.setFillColor(colors.gray)
    c.setFont(FONT_SMALL, 8)
    if terms:
        c.drawString(DEFAULT_MARGIN, 35, f"Terms: {terms}")

    c.drawRightString(PAGE_W - DEFAULT_MARGIN, 35, f"Page {page_num} / {total_pages}")


def draw_customer_box(c: canvas.Canvas, customer: Dict[str, Any], y_start: float) -> float:
    """Draw bill-to box and return new Y position."""
    y = y_start - 20
    c.setFillColor(colors.black)
    c.setFont(FONT_TITLE, 10)
    c.drawString(DEFAULT_MARGIN, y, "Bill To:")

    y -= 16
    c.setFont(FONT_BODY, 10)
    name = customer.get("name", "Unknown")
    c.drawString(DEFAULT_MARGIN, y, name)

    if customer.get("email"):
        y -= 14
        c.setFont(FONT_SMALL, 9)
        c.drawString(DEFAULT_MARGIN, y, customer["email"])

    if customer.get("phone"):
        y -= 14
        c.drawString(DEFAULT_MARGIN, y, customer["phone"])

    if customer.get("shipping_address"):
        y -= 14
        c.drawString(DEFAULT_MARGIN, y, customer["shipping_address"])

    return y - 10


def draw_invoice_meta(c: canvas.Canvas, meta: Dict[str, Any], y_start: float) -> float:
    """Draw invoice #, date, due date on the right side."""
    y = y_start
    c.setFont(FONT_BODY, 9)
    x_right = PAGE_W - DEFAULT_MARGIN - 150

    for label, value in meta.items():
        c.drawString(x_right, y, f"{label}: {value}")
        y -= 14

    return y


def draw_line_items_table(c: canvas.Canvas, lines: List[Dict[str, Any]], y_start: float,
                          show_qty: bool = True, show_rate: bool = True) -> float:
    """Draw the line items table. Returns new Y position."""
    y = y_start - 20

    col_positions = {
        "description": DEFAULT_MARGIN,
        "qty": DEFAULT_MARGIN + 280,
        "rate": DEFAULT_MARGIN + 330,
        "amount": DEFAULT_MARGIN + 410,
    }

    c.setFillColor(colors.HexColor("#f3f4f6"))
    c.rect(DEFAULT_MARGIN, y - 5, PAGE_W - 2 * DEFAULT_MARGIN, 20, fill=True, stroke=False)

    c.setFillColor(colors.black)
    c.setFont(FONT_TITLE, 9)
    c.drawString(col_positions["description"], y, "Description")
    if show_qty:
        c.drawString(col_positions["qty"], y, "Qty")
    if show_rate:
        c.drawRightString(col_positions["rate"] + 50, y, "Rate")
    c.drawRightString(col_positions["amount"] + 50, y, "Amount")

    y -= 25

    c.setFont(FONT_BODY, 9)
    for line in lines:
        if y < 100:
            c.showPage()
            y = PAGE_H - DEFAULT_MARGIN

        desc = line.get("model_number", line.get("model", line.get("description", "")))
        imei = line.get("imei", "")
        if imei:
            desc = f"{desc} (IMEI: {imei})"

        c.drawString(col_positions["description"], y, str(desc)[:45])
        if show_qty:
            c.drawString(col_positions["qty"], y, str(line.get("qty", 1)))
        if show_rate:
            c.drawRightString(col_positions["rate"] + 50, y, f"${line.get('rate', line.get('unit_price', 0)):.2f}")
        c.drawRightString(col_positions["amount"] + 50, y,
                          f"${line.get('amount', line.get('rate', line.get('unit_price', 0)) * line.get('qty', 1)):.2f}")

        y -= 16

    return y - 10


def draw_summary_block(c: canvas.Canvas, summary: Dict[str, Any], y_start: float) -> float:
    """Draw subtotal, discount, tax, total on right side."""
    y = y_start - 5
    x_label = PAGE_W - DEFAULT_MARGIN - 180
    x_value = PAGE_W - DEFAULT_MARGIN

    c.setStrokeColor(colors.lightgrey)
    c.setLineWidth(0.5)
    c.line(x_label - 20, y + 8, x_value, y + 8)

    rows = []
    rows.append(("Subtotal", f"${summary.get('subtotal', 0):.2f}"))

    if summary.get("discount_amount", 0) > 0:
        rows.append((f"Discount ({summary.get('discount_percent', 0):.1f}%)",
                     f"-${summary.get('discount_amount', 0):.2f}"))

    rows.append(("Tax", f"${summary.get('tax_amount', 0):.2f}"))
    rows.append(("", ""))

    for label, value in rows[:-1]:
        c.setFont(FONT_BODY, 9)
        c.drawString(x_label, y, label)
        c.drawRightString(x_value, y, value)
        y -= 14

    c.setStrokeColor(colors.HexColor("#e94560"))
    c.setLineWidth(1)
    c.line(x_label - 20, y + 2, x_value, y + 2)
    y -= 5

    c.setFont(FONT_TITLE, 12)
    total_label = "TOTAL DUE"
    total_value = f"${summary.get('total_due', summary.get('total', 0)):.2f}"
    c.drawString(x_label, y - 8, total_label)
    c.drawRightString(x_value, y - 8, total_value)

    if summary.get("balance_due") is not None:
        y -= 16
        c.setFont(FONT_BODY, 9)
        c.drawString(x_label, y - 8, "Balance Due")
        c.drawRightString(x_value, y - 8, f"${summary['balance_due']:.2f}")

    return y - 20


def add_watermark(c: canvas.Canvas, text: str = "ESTIMATE"):
    """Add a diagonal watermark across the page."""
    c.saveState()
    c.setFillColor(colors.Color(0.9, 0.9, 0.9, alpha=0.3))
    c.setFont(FONT_TITLE, 60)
    c.translate(PAGE_W / 2, PAGE_H / 2)
    c.rotate(45)
    c.drawCentredString(0, 0, text)
    c.restoreState()
