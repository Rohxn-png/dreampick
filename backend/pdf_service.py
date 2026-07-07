"""PDF generation for plans and payout statements."""
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER

PURPLE = colors.HexColor("#5B21B6")
GOLD = colors.HexColor("#D4A93A")
DARK = colors.HexColor("#1F1B2E")
INK = colors.HexColor("#2A2438")


def _styles():
    s = getSampleStyleSheet()
    return {
        "h1": ParagraphStyle("h1", parent=s["Heading1"], textColor=PURPLE, fontSize=22, spaceAfter=6),
        "h2": ParagraphStyle("h2", parent=s["Heading2"], textColor=DARK, fontSize=14, spaceBefore=12, spaceAfter=6),
        "body": ParagraphStyle("body", parent=s["BodyText"], textColor=INK, fontSize=10.5, leading=15),
        "small": ParagraphStyle("small", parent=s["BodyText"], textColor=INK, fontSize=9),
        "center": ParagraphStyle("center", parent=s["BodyText"], alignment=TA_CENTER, textColor=INK, fontSize=10),
        "tag": ParagraphStyle("tag", parent=s["BodyText"], textColor=GOLD, fontSize=9, spaceAfter=6),
    }


def generate_plan_pdf(company_name: str, gst_number: str) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=16*mm, bottomMargin=16*mm)
    st = _styles()
    elems = []

    # Header
    elems.append(Paragraph(f"<b>{company_name}</b>", st["h1"]))
    elems.append(Paragraph(f"GST: {gst_number}", st["tag"]))
    elems.append(Spacer(1, 8))
    elems.append(Paragraph("Basic EV Scooter Plan", st["h2"]))
    elems.append(Paragraph("<b>Price: ₹54,999 + GST</b>", st["body"]))
    elems.append(Spacer(1, 6))

    # Features
    elems.append(Paragraph("EV Scooty Features", st["h2"]))
    feats = ["45–50 km range", "Battery and charge converter: 1-year warranty", "Non-registered vehicle, Non-RTO"]
    for f in feats:
        elems.append(Paragraph(f"• {f}", st["body"]))

    # Terms
    elems.append(Paragraph("Terms and Conditions", st["h2"]))
    terms = [
        "First payout starts after 45 days from successful registration and confirmed order activation.",
        "Scheduled monthly payouts follow the approved payout schedule.",
        "The buyer cashback schedule ends after the 10th monthly payout.",
        "Orders, cancellations, refunds, eligibility, delivery confirmation, and payout approval are tracked by the system.",
        "Final eligibility and payout approval are subject to company policy and order verification.",
    ]
    for t in terms:
        elems.append(Paragraph(f"• {t}", st["body"]))

    # Buyer cashback table
    elems.append(Paragraph("Income Plan for Buyer (Cashback)", st["h2"]))
    tbl = [
        ["Item", "Amount"],
        ["Gross monthly cashback", "₹3,000.00"],
        ["Admin charges (10%)", "₹300.00"],
        ["Net monthly cashback", "₹2,700.00"],
        ["Cashback duration", "10 months"],
        ["First payout", "45 days after activation"],
        ["Total gross over 10 months", "₹30,000.00"],
        ["Total admin charges", "₹3,000.00"],
        ["Total net cashback", "₹27,000.00"],
    ]
    t = Table(tbl, colWidths=[95*mm, 60*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#DDD")),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#FAF7FF")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    elems.append(t)

    # Referral commission
    elems.append(Paragraph("Direct Referral Commission (per ₹54,999 successful referred purchase)", st["h2"]))
    tbl2 = [
        ["Item", "Amount"],
        ["Gross (5%)", "₹2,750.00"],
        ["Admin charges (10%)", "₹275.00"],
        ["Net direct referral commission", "₹2,475.00"],
    ]
    t2 = Table(tbl2, colWidths=[95*mm, 60*mm])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GOLD),
        ("TEXTCOLOR", (0, 0), (-1, 0), DARK),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#DDD")),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#FFFCF0")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    elems.append(t2)

    # Matching income
    elems.append(Paragraph("1:1 Matching Income (per new eligible matched pair)", st["h2"]))
    tbl3 = [
        ["Item", "Amount"],
        ["Gross matching (2.5%)", "₹1,374.00"],
        ["Admin charges (10%)", "₹137.40"],
        ["Net matching income", "₹1,236.60"],
    ]
    t3 = Table(tbl3, colWidths=[95*mm, 60*mm])
    t3.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#DDD")),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#FAF7FF")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    elems.append(t3)

    elems.append(Spacer(1, 12))
    elems.append(Paragraph(
        "All amounts shown are gross of GST unless stated. All payouts are subject to company terms, administrative deductions, order verification, and final approval. No automatic payouts are processed by any external gateway — all payouts are manually issued.",
        st["small"]
    ))
    elems.append(Spacer(1, 6))
    elems.append(Paragraph(f"© {company_name} — GST {gst_number}", st["center"]))

    doc.build(elems)
    return buf.getvalue()
