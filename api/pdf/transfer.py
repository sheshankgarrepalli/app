"""Transfer manifest PDF generation."""
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from io import BytesIO

from .base import PAGE_W, PAGE_H, DEFAULT_MARGIN, draw_header, draw_footer

FONT_TITLE = "Helvetica-Bold"
FONT_BODY = "Helvetica"


def generate_transfer_pdf(
    transfer_id: str,
    source_name: str,
    destination_name: str,
    transfer_type: str,
    created_at: str,
    created_by: str,
    devices: list[dict],
    notes: str = "",
) -> BytesIO:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=DEFAULT_MARGIN, rightMargin=DEFAULT_MARGIN,
        topMargin=DEFAULT_MARGIN, bottomMargin=DEFAULT_MARGIN,
    )
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle(
        'TransferTitle', parent=styles['Heading1'],
        fontName=FONT_TITLE, fontSize=18, textColor=colors.HexColor("#e94560"),
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        'TransferSub', parent=styles['Normal'],
        fontName=FONT_BODY, fontSize=9, textColor=colors.gray,
    )
    label_style = ParagraphStyle(
        'Label', parent=styles['Normal'],
        fontName=FONT_TITLE, fontSize=9, textColor=colors.HexColor("#333333"),
    )
    value_style = ParagraphStyle(
        'Value', parent=styles['Normal'],
        fontName=FONT_BODY, fontSize=9, textColor=colors.black,
    )

    story.append(Paragraph("AMAFAH ELECTRONICS", title_style))
    story.append(Paragraph("Transfer Manifest", subtitle_style))
    story.append(Spacer(1, 12))

    # Transfer details table
    detail_data = [
        [Paragraph("<b>Transfer #:</b>", label_style), Paragraph(transfer_id, value_style)],
        [Paragraph("<b>Date:</b>", label_style), Paragraph(created_at, value_style)],
        [Paragraph("<b>From:</b>", label_style), Paragraph(source_name, value_style)],
        [Paragraph("<b>To:</b>", label_style), Paragraph(destination_name, value_style)],
        [Paragraph("<b>Type:</b>", label_style), Paragraph(transfer_type, value_style)],
        [Paragraph("<b>Prepared by:</b>", label_style), Paragraph(created_by, value_style)],
    ]
    detail_table = Table(detail_data, colWidths=[1.2 * inch, 4.5 * inch])
    detail_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
    ]))
    story.append(detail_table)

    if notes:
        story.append(Spacer(1, 10))
        story.append(Paragraph(f"<b>Notes:</b> {notes}", value_style))

    story.append(Spacer(1, 18))
    story.append(Paragraph(f"DEVICE LIST ({len(devices)} devices)", subtitle_style))
    story.append(Spacer(1, 8))

    # Device list table
    header_style = ParagraphStyle(
        'Header', parent=styles['Normal'],
        fontName=FONT_TITLE, fontSize=8, textColor=colors.white,
    )
    cell_style = ParagraphStyle(
        'Cell', parent=styles['Normal'],
        fontName=FONT_BODY, fontSize=8, textColor=colors.black,
    )

    table_data = [[
        Paragraph("IMEI", header_style),
        Paragraph("Model", header_style),
        Paragraph("Status", header_style),
    ]]
    for d in devices:
        table_data.append([
            Paragraph(d.get("imei", ""), cell_style),
            Paragraph(d.get("model_number", "") or "—", cell_style),
            Paragraph(d.get("device_status", ""), cell_style),
        ])

    col_widths = [2.2 * inch, 2.2 * inch, 1.8 * inch]
    device_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    device_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#333333")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8f8f8")]),
    ]))
    story.append(device_table)

    doc.build(story, onFirstPage=_add_header_footer, onLaterPages=_add_header_footer)
    buf.seek(0)
    return buf


def _add_header_footer(canvas, doc):
    draw_header(canvas, "AMAFAH ELECTRONICS", primary_color="#e94560", tagline="Electronics Refurbishment & Sales")
    draw_footer(canvas, terms="All devices must be verified upon receipt.", page_num=doc.page)
