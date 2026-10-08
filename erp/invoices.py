"""Buyurtma uchun invoice PDF yaratish va uni hujjat sifatida (S3'ga) saqlash."""
from io import BytesIO

from django.core.files.base import ContentFile
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import Document

GOLD = colors.HexColor('#e6ac00')
INK = colors.HexColor('#0b0b0b')


def _money(value):
    return f"${value:,.2f}"


def render_invoice_pdf(order):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=18 * mm, bottomMargin=18 * mm,
                            title=f"Invoice #{order.pk}", author='Lamborghini ERP')
    styles = getSampleStyleSheet()
    brand = ParagraphStyle('brand', fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=GOLD)
    title = ParagraphStyle('title', fontName='Helvetica-Bold', fontSize=16, leading=20, alignment=TA_RIGHT)
    small = ParagraphStyle('small', fontName='Helvetica', fontSize=9, leading=12)
    small_right = ParagraphStyle('small_right', parent=small, alignment=TA_RIGHT)
    story = []

    header = Table(
        [[[Paragraph('LAMBORGHINI', brand),
           Paragraph(f'{order.branch.name}<br/>{order.branch.location}<br/>{order.branch.phone}', small)],
          [Paragraph(f'INVOICE #{order.pk:05d}', title),
           Paragraph(f'Sana: {timezone.localdate():%d.%m.%Y}<br/>'
                     f'Buyurtma sanasi: {timezone.localtime(order.created_at):%d.%m.%Y}', small_right)]]],
        colWidths=[100 * mm, 74 * mm],
    )
    header.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'),
                                ('LINEBELOW', (0, 0), (-1, 0), 2, GOLD),
                                ('BOTTOMPADDING', (0, 0), (-1, 0), 8)]))
    story += [header, Spacer(1, 8 * mm)]

    story.append(Paragraph(
        f'<b>Mijoz:</b> {order.customer_name}<br/><b>Telefon:</b> {order.customer_phone}<br/>'
        f'<b>Buyurtma turi:</b> {order.get_order_type_display()}<br/>'
        f"<b>Mas'ul:</b> {order.assigned_to.get_full_name() if order.assigned_to else '—'}",
        styles['Normal']))
    story.append(Spacer(1, 6 * mm))

    rows = [['#', 'Nomi', 'SKU / VIN', 'Soni', 'Narxi', 'Summa']]
    for i, item in enumerate(order.items.select_related('inventory_item'), start=1):
        rows.append([str(i), Paragraph(item.inventory_item.name, styles['Normal']), item.inventory_item.sku_or_vin,
                     str(item.quantity), _money(item.unit_price), _money(item.subtotal)])
    rows.append(['', '', '', '', 'JAMI', _money(order.total_price)])

    table = Table(rows, colWidths=[8 * mm, 62 * mm, 40 * mm, 12 * mm, 26 * mm, 26 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), INK),
        ('TEXTCOLOR', (0, 0), (-1, 0), GOLD),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f5f5f3')]),
        ('LINEABOVE', (0, -1), (-1, -1), 1, INK),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 11),
    ]))
    story += [table, Spacer(1, 10 * mm)]
    story.append(Paragraph(
        f'<font size=8 color="#898781">Holati: {order.get_status_display()}. '
        'Ushbu hujjat Lamborghini ERP tizimida avtomatik yaratildi.</font>', styles['Normal']))

    doc.build(story)
    return buffer.getvalue()


def create_invoice_document(order, user):
    pdf = render_invoice_pdf(order)
    document = Document(
        branch=order.branch, order=order, kind='invoice',
        title=f"Invoice #{order.pk:05d} — {order.customer_name}",
        size=len(pdf), content_type='application/pdf', uploaded_by=user,
    )
    document.file.save(f"invoice-{order.pk:05d}-{timezone.now():%Y%m%d%H%M%S}.pdf", ContentFile(pdf), save=False)
    document.save()
    return document
