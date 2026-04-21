"""
wholesale_invoice_pdf.py
Generates a polished wholesale commercial invoice PDF using WeasyPrint + Jinja2.

Usage:
    from wholesale_invoice_pdf import generate_wholesale_invoice_pdf
    pdf_bytes = generate_wholesale_invoice_pdf(transaction_data)
"""

import io
import os
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

# ── Isolated font environment: only 3 DejaVu fonts, pre-cached ────────────
# This prevents weasyprint from scanning the 2000+ system Noto fonts
# which would hang for 20+ minutes on first run.
_FONT_DIR = Path(__file__).parent / "invoice_fonts"
os.environ["FONTCONFIG_FILE"] = str(_FONT_DIR / "fonts.conf")
os.environ["FONTCONFIG_PATH"] = str(_FONT_DIR)
os.environ.setdefault("DBUS_SESSION_BUS_ADDRESS", "disabled")

from jinja2 import Environment, FileSystemLoader, select_autoescape

# ── Company branding – edit as needed ───────────────────────────────────────
COMPANY = {
    "name":    "Amafah Mobile Solutions",
    "address": "1234 Commerce Blvd, Suite 5, Dallas, TX 75201",
    "email":   "sales@amafah.com",
    "phone":   "(214) 555-0198",
    "website": "www.amafah.com",
}

TEMPLATE_DIR = Path(__file__).parent / "templates"


# ── 1.  GROUPING LOGIC ───────────────────────────────────────────────────────

def _group_line_items(lines: list[dict]) -> list[dict]:
    """
    Condense individual device entries into grouped rows by model.

    Expected keys per line item in `lines`:
        imei   (str)  – 15-digit IMEI
        model  (str)  – e.g. "Apple iPhone 12 64GB"
        base_price / final_price  (float) – per-unit selling price
        discount_applied (float)
        condition (str, optional) – e.g. "Box Kitted – Unlocked"

    Returns a list of rows ready for the Jinja2 template.
    """
    groups: dict[str, dict] = defaultdict(lambda: {
        "imeis": [],
        "rate": 0.0,
        "amount": 0.0,
        "condition": None,
    })

    for item in lines:
        model_key = item.get("model", "Unknown Model")
        grp = groups[model_key]
        grp["imeis"].append(item.get("imei", "N/A"))
        grp["rate"] = item.get("final_price", item.get("base_price", 0.0))
        grp["amount"] += item.get("final_price", item.get("base_price", 0.0))
        if item.get("condition"):
            grp["condition"] = item["condition"]

    result = []
    for model_name, grp in groups.items():
        imei_html = "<br>".join(grp["imeis"])
        result.append({
            "product":   model_name,
            "imei_html": imei_html,
            "condition": grp["condition"],
            "qty":       len(grp["imeis"]),
            "rate":      grp["rate"],
            "amount":    grp["amount"],
        })

    return result


# ── 2.  TEMPLATE CONTEXT BUILDER ─────────────────────────────────────────────

def _build_context(tx: dict) -> dict:
    """Convert a raw bulk-checkout transaction payload into template context."""

    customer = tx.get("customer", {})
    fulfillment = tx.get("fulfillment", {})
    summary = tx.get("summary", {})

    inv_date = datetime.utcnow()
    due_date = inv_date + timedelta(days=30)

    line_items = _group_line_items(tx.get("lines", []))

    # Calculate totals
    raw_subtotal = sum(item["amount"] for item in line_items)
    discount_pct = tx.get("discount_pct", 0.0)          # e.g. 0.10 for 10%
    discount_amt = raw_subtotal * discount_pct
    after_discount = raw_subtotal - discount_amt
    tax_exempt = bool(customer.get("tax_exempt_id"))
    tax_pct = 0.0 if tax_exempt else tx.get("tax_pct", 8.5)
    tax_amt = after_discount * (tax_pct / 100)
    total = after_discount + tax_amt

    ship_addr = fulfillment.get("shipping_address") or customer.get("shipping_address") or ""

    return {
        "company": COMPANY,
        "invoice": {
            "invoice_number":    tx.get("invoice_id", "N/A"),
            "date":              inv_date.strftime("%B %d, %Y"),
            "due_date":          due_date.strftime("%B %d, %Y"),
            "tax_exempt_id":     customer.get("tax_exempt_id"),
            "fulfillment_method": fulfillment.get("method", "Picked Up In-Store"),
        },
        "bill_to": {
            "name":    customer.get("name", "—"),
            "company": customer.get("company_name"),
            "phone":   customer.get("phone"),
            "email":   customer.get("email"),
            "address": None,
        },
        "ship_to": {
            "name":    customer.get("name", "—"),
            "company": customer.get("company_name"),
            "phone":   customer.get("phone"),
            "address": ship_addr,
        },
        "line_items": line_items,
        "totals": {
            "subtotal":     raw_subtotal,
            "discount":     discount_amt,
            "discount_pct": int(discount_pct * 100),
            "tax_pct":      tax_pct,
            "tax":          tax_amt,
            "tax_exempt":   tax_exempt,
            "total":        total,
        },
    }


# ── 3.  PDF GENERATOR ────────────────────────────────────────────────────────

import subprocess
import json

def generate_wholesale_invoice_pdf(transaction_data: dict) -> bytes:
    """
    Generate a wholesale invoice PDF using the isolated subprocess worker.
    """
    context = _build_context(transaction_data)
    
    # Run pdf_worker.py as a subprocess with our isolated, fast fontconfig env
    worker_script = str(Path(__file__).parent / "pdf_worker.py")
    env = os.environ.copy()
    font_dir = str(Path(__file__).parent / "isolated_fonts")
    env["FONTCONFIG_FILE"] = f"{font_dir}/fonts.conf"
    env["FONTCONFIG_PATH"] = font_dir
    env["DBUS_SESSION_BUS_ADDRESS"] = "disabled"
    
    # We must explicitly call python on the worker
    process = subprocess.Popen(
        ["python3", worker_script],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )
    
    # Pass our context as a serialized JSON string length via STDIN
    context_str = json.dumps(context)
    stdout_data, stderr_data = process.communicate(input=context_str.encode("utf-8"))
    
    if process.returncode != 0:
        error_msg = stderr_data.decode("utf-8")
        raise RuntimeError(f"PDF generation failed: {error_msg}")
        
    return stdout_data

