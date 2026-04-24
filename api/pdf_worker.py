import sys
import json
from pathlib import Path
import os
from jinja2 import Environment, FileSystemLoader, select_autoescape

# Ensure that the weasyprint module is imported AFTER the ENV vars are set
try:
    import weasyprint
except ImportError:
    weasyprint = None
    print("Warning: weasyprint not installed. PDF generation will be disabled.")

TEMPLATE_DIR = Path(__file__).parent / "templates"

def generate_pdf():
    # Read context JSON from standard input
    input_data = sys.stdin.read()
    if not input_data:
        print("Error: No data provided", file=sys.stderr)
        sys.exit(1)
        
    try:
        context = json.loads(input_data)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        # Load the Jinja2 environment and template
        env = Environment(
            loader=FileSystemLoader(str(TEMPLATE_DIR)),
            autoescape=select_autoescape(["html"]),
        )
        template = env.get_template("wholesale_invoice.html")
        html_string = template.render(**context)

        # Convert HTML -> PDF using WeasyPrint
        pdf_bytes = weasyprint.HTML(string=html_string).write_pdf()

        # Write PDF bytes directly to standard output
        sys.stdout.buffer.write(pdf_bytes)
        
    except Exception as e:
        print(f"Error generating PDF: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    generate_pdf()
