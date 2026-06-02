"""Email service for sending invoices, estimates, and reminders via Gmail SMTP."""
import os
import smtplib
import re
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Optional, Dict, Any


def _get_smtp_config() -> dict:
    return {
        "host": os.environ.get("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "username": os.environ.get("SMTP_USERNAME", ""),
        "password": os.environ.get("SMTP_PASSWORD", ""),
        "from_email": os.environ.get("SMTP_FROM_EMAIL", ""),
        "from_name": os.environ.get("SMTP_FROM_NAME", "AMAFAH Electronics"),
    }


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

    def replace_if(match):
        var_name = match.group(1).strip()
        content = match.group(2)
        if variables.get(var_name):
            return content
        return ""

    template = re.sub(r'\{%\s*if\s+(\w+)\s*%\}(.*?)\{%\s*endif\s*%\}', replace_if, template, flags=re.DOTALL)

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
    """Send an invoice email via Gmail SMTP with PDF attachment."""

    cfg = _get_smtp_config()
    if not cfg["username"] or not cfg["password"]:
        return {"success": False, "error": "SMTP credentials not configured (SMTP_USERNAME / SMTP_PASSWORD)"}

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

    msg = MIMEMultipart()
    msg["From"] = f"{cfg['from_name']} <{cfg['from_email']}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    if cc:
        msg["Cc"] = cc

    msg.attach(MIMEText(body, "plain", "utf-8"))

    if pdf_bytes:
        part = MIMEApplication(pdf_bytes, _subtype="pdf")
        part.add_header("Content-Disposition", "attachment", filename=f"{invoice_number}.pdf")
        msg.attach(part)

    recipients = [to_email]
    if cc:
        recipients.append(cc)
    if bcc:
        recipients.append(bcc)

    try:
        server = smtplib.SMTP(cfg["host"], cfg["port"], timeout=15)
        server.starttls()
        server.login(cfg["username"], cfg["password"])
        server.sendmail(cfg["from_email"], recipients, msg.as_string())
        server.quit()
        return {"success": True}
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
    cfg = _get_smtp_config()
    if not cfg["username"] or not cfg["password"]:
        return {"success": False, "error": "SMTP credentials not configured"}

    variables = {
        "invoice_number": invoice_number,
        "customer_name": customer_name,
        "total": f"${total:,.2f}",
        "due_date": due_date,
        "company_name": company_name,
    }

    subject = _render_template(reminder_subject or DEFAULT_REMINDER_SUBJECT, variables)
    body = _render_template(reminder_body or DEFAULT_REMINDER_BODY, variables)

    msg = MIMEMultipart()
    msg["From"] = f"{cfg['from_name']} <{cfg['from_email']}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain", "utf-8"))

    try:
        server = smtplib.SMTP(cfg["host"], cfg["port"], timeout=15)
        server.starttls()
        server.login(cfg["username"], cfg["password"])
        server.sendmail(cfg["from_email"], [to_email], msg.as_string())
        server.quit()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}
