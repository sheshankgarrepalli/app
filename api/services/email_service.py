"""Email service for sending invoices, estimates, and reminders."""
import os
from typing import Optional, Dict, Any
from datetime import datetime
import requests


RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_API_URL = "https://api.resend.com/emails"

DEFAULT_SUBJECT = "Invoice {{invoice_number}} from {{company_name}}"
DEFAULT_BODY = """Dear {{customer_name}},

Please find your invoice {{invoice_number}} attached.

Amount Due: {{total}}
Due Date: {{due_date}}

{% if message %}{{message}}{% endif %}

Thank you for your business.

{{company_name}}"""

DEFAULT_REMINDER_SUBJECT = "Reminder: Invoice {{invoice_number}} is due"
DEFAULT_REMINDER_BODY = """Dear {{customer_name}},

This is a friendly reminder that invoice {{invoice_number}} for {{total}} is due on {{due_date}}.

Please remit payment at your earliest convenience.

{{company_name}}"""


def _render_template(template: str, variables: Dict[str, Any]) -> str:
    """Simple variable interpolation: replaces {{var}} and {% if var %}...{% endif %}."""
    import re

    # Handle basic if blocks
    def replace_if(match):
        var_name = match.group(1).strip()
        content = match.group(2)
        if variables.get(var_name):
            return content
        return ""

    template = re.sub(r'\{%\s*if\s+(\w+)\s*%\}(.*?)\{%\s*endif\s*%\}', replace_if, template, flags=re.DOTALL)

    # Replace {{var}}
    for key, value in variables.items():
        template = template.replace(f"{{{{{key}}}}}", str(value) if value is not None else "")

    return template


def send_invoice_email(
    to_email: str,
    invoice_number: str,
    customer_name: str,
    total: float,
    due_date: str,
    pdf_bytes: Optional[bytes] = None,
    cc: Optional[str] = None,
    bcc: Optional[str] = None,
    message: Optional[str] = None,
    subject_template: Optional[str] = None,
    body_template: Optional[str] = None,
    company_name: str = "AMAFAH Electronics",
) -> Dict[str, Any]:
    """Send an invoice email via Resend API."""

    variables = {
        "invoice_number": invoice_number,
        "customer_name": customer_name,
        "total": f"${total:,.2f}",
        "due_date": due_date,
        "message": message or "",
        "company_name": company_name,
    }

    subject = _render_template(subject_template or DEFAULT_SUBJECT, variables)
    body = _render_template(body_template or DEFAULT_BODY, variables)

    if not RESEND_API_KEY:
        return {
            "success": False,
            "error": "RESEND_API_KEY not configured",
            "subject": subject,
            "body": body,
        }

    payload = {
        "from": f"{company_name} <invoices@amafahelectronics.com>",
        "to": [to_email],
        "subject": subject,
        "text": body,
    }

    if cc:
        payload["cc"] = [cc]
    if bcc:
        payload["bcc"] = [bcc]

    if pdf_bytes:
        import base64
        payload["attachments"] = [{
            "filename": f"{invoice_number}.pdf",
            "content": base64.b64encode(pdf_bytes).decode("utf-8"),
            "type": "application/pdf",
        }]

    try:
        resp = requests.post(
            RESEND_API_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        if resp.status_code in (200, 201):
            return {"success": True, "message_id": resp.json().get("id")}
        return {"success": False, "error": resp.text}
    except Exception as e:
        return {"success": False, "error": str(e)}


def send_payment_reminder(
    to_email: str,
    invoice_number: str,
    customer_name: str,
    total: float,
    due_date: str,
    company_name: str = "AMAFAH Electronics",
    reminder_subject: Optional[str] = None,
    reminder_body: Optional[str] = None,
) -> Dict[str, Any]:
    """Send a payment reminder email."""
    variables = {
        "invoice_number": invoice_number,
        "customer_name": customer_name,
        "total": f"${total:,.2f}",
        "due_date": due_date,
        "company_name": company_name,
    }

    subject = _render_template(reminder_subject or DEFAULT_REMINDER_SUBJECT, variables)
    body = _render_template(reminder_body or DEFAULT_REMINDER_BODY, variables)

    if not RESEND_API_KEY:
        return {"success": False, "error": "RESEND_API_KEY not configured"}

    try:
        resp = requests.post(
            RESEND_API_URL,
            json={
                "from": f"{company_name} <invoices@amafahelectronics.com>",
                "to": [to_email],
                "subject": subject,
                "text": body,
            },
            headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
            timeout=15,
        )
        return {"success": resp.status_code in (200, 201)}
    except Exception as e:
        return {"success": False, "error": str(e)}
