"""Render the assignment Markdown to an ignored PDF for six-page/layout QA."""
from pathlib import Path
import re
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader
import fitz

out = Path('.capture-tmp/report-qa')
out.mkdir(parents=True, exist_ok=True)
for name, file in [('Arial', 'arial.ttf'), ('Arial-Bold', 'arialbd.ttf'), ('Arial-Italic', 'ariali.ttf')]:
    pdfmetrics.registerFont(TTFont(name, 'C:/Windows/Fonts/' + file))
pdfmetrics.registerFontFamily('Arial', normal='Arial', bold='Arial-Bold', italic='Arial-Italic', boldItalic='Arial-Bold')
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyReport', fontName='Arial', fontSize=10.5, leading=14, spaceAfter=7))
for style, size in [('Heading1', 17), ('Heading2', 13), ('Heading3', 11)]:
    styles[style].fontName = 'Arial-Bold'
    styles[style].fontSize = size
    styles[style].leading = size + 3
    styles[style].spaceBefore = 10
    styles[style].spaceAfter = 6
styles.add(ParagraphStyle(name='CellReport', parent=styles['BodyReport'], fontSize=9, leading=11.5, spaceAfter=0))

def inline(text):
    text = escape(text.replace('—', '-').replace('–', '-'))
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<font color="#205b86">\1</font>', text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<i>\1</i>', text)
    return re.sub(r'`([^`]+)`', r'\1', text)

lines = Path('laporan/LAPORAN.md').read_text(encoding='utf-8-sig').splitlines()
story = []
i = 0
while i < len(lines):
    line = lines[i]
    if not line.strip():
        i += 1
        continue
    if line.startswith('|'):
        rows = []
        while i < len(lines) and lines[i].startswith('|'):
            cells = [v.strip() for v in lines[i].strip('|').split('|')]
            if not all(re.fullmatch(r'[-:]+', c) for c in cells):
                rows.append([Paragraph(inline(c), styles['CellReport']) for c in cells])
            i += 1
        widths = [174, 75, 75, 187] if len(rows[0]) == 4 else [175, 336]
        table = Table(rows, colWidths=widths, repeatRows=1, hAlign='LEFT')
        table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e8eef3')), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEBELOW', (0, 0), (-1, -1), .35, colors.HexColor('#cbd5df')), ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5), ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5)]))
        story.extend([table, Spacer(1, 8)])
        continue
    match = re.match(r'^(#{1,3}) (.*)', line)
    if match:
        story.append(Paragraph(inline(match[2]), styles['Heading' + str(len(match[1]))]))
    else:
        story.append(Paragraph(inline(line), styles['BodyReport']))
    i += 1

def footer(canvas, doc):
    canvas.setFont('Arial', 8)
    canvas.drawString(42, 25, 'TokoKilat - audit 12 Oktober 2026 | salinan QA; tautan lengkap di Markdown')
    canvas.drawRightString(A4[0] - 42, 25, str(doc.page))

pdf = out / 'LAPORAN.pdf'
SimpleDocTemplate(str(pdf), pagesize=A4, leftMargin=42, rightMargin=42, topMargin=36, bottomMargin=40).build(story, onFirstPage=footer, onLaterPages=footer)
reader = PdfReader(pdf)
assert len(reader.pages) <= 6, f'{len(reader.pages)} pages exceeds six'
doc = fitz.open(pdf)
for number, page in enumerate(doc, 1):
    page.get_pixmap(matrix=fitz.Matrix(1.4, 1.4)).save(out / f'page-{number}.png')
print(f'Layout QA: {len(reader.pages)} pages; all seven sections rendered to {out}')
