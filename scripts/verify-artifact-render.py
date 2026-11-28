"""Create real test artifacts and assert complete local render coverage."""
import importlib.util, pathlib, tempfile
from PIL import Image
from pptx import Presentation
from pptx.util import Inches
from docx import Document
from openpyxl import Workbook
import fitz

p = pathlib.Path(__file__).with_name("audit-artifact.py")
spec = importlib.util.spec_from_file_location("audit_artifact", p)
audit = importlib.util.module_from_spec(spec); spec.loader.exec_module(audit)

with tempfile.TemporaryDirectory() as root:
    root=pathlib.Path(root)
    src=root/"source"; src.mkdir()
    work=root/"render"; work.mkdir()
    prs=Presentation()
    for index,label in enumerate(("VISIBLE_AUDIT_123","HIDDEN_AUDIT_456")):
        slide=prs.slides.add_slide(prs.slide_layouts[6])
        slide.shapes.add_textbox(Inches(1), Inches(1), Inches(6), Inches(1)).text=label
        if index==1: slide._element.set("show","0")
    p=src/"deck.pptx"; prs.save(p)
    pages,renderer=audit.render(p,work,None)
    assert len(pages)==2 and "VISIBLE_AUDIT_123" in pages[0][1] and "HIDDEN_AUDIT_456" in pages[1][1], [(x[1],len(x[0])) for x in pages]
    assert all(Image.open(audit.io.BytesIO(x[0])).width>500 for x in pages)
    d=Document(); d.add_paragraph("DOCX_AUDIT_123"); p=src/"doc.docx"; d.save(p)
    pages,_=audit.render(p,work,None); assert len(pages)==1 and "DOCX_AUDIT_123" in pages[0][1]
    w=Workbook(); w.active["A1"]="SHEET_VISIBLE"; w.active["C3"]="OUTSIDE_PRINT"; w.active.print_area="A1:A1"; w.active.column_dimensions["A"].width=25; w.active.column_dimensions["C"].width=25
    s=w.create_sheet("Hidden"); s["A1"]="SHEET_HIDDEN"; s.sheet_state="hidden"; s.column_dimensions["A"].width=25
    p=src/"sheets.xlsx"; w.save(p)
    pages,_=audit.render(p,work,None)
    assert len(pages)==2 and all(s in "".join(x[1] for x in pages) for s in ("SHEET_VISIBLE","OUTSIDE_PRINT","SHEET_HIDDEN")), [x[1] for x in pages]
    d=fitz.open(); d.new_page().insert_text((50,50),"PDF_AUDIT_123"); p=src/"pdf.pdf"; d.save(p); d.close()
    pages,_=audit.render(p,work,None); assert len(pages)==1 and "PDF_AUDIT_123" in pages[0][1]
    p=src/"image.png"; Image.new("RGB",(700,500),"white").save(p); pages,_=audit.render(p,work,None); assert len(pages)==1
    p=src/"page.html"; p.write_text("<html><body><p>HTML_AUDIT_123</p></body></html>",encoding="utf-8")
    pages,_=audit.render(p,work,None); assert len(pages)==2 and all("HTML_AUDIT_123" in x[1] for x in pages)
    p=src/"image.svg"; p.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="red"/><text x="20" y="50">SVG_AUDIT_123</text></svg>',encoding="utf-8")
    pages,_=audit.render(p,work,None); assert len(pages)==2 and all("SVG_AUDIT_123" in x[1] for x in pages)
    p=src/"broken.html"; p.write_text('<html><body><img src="https://example.invalid/missing.png"></body></html>',encoding="utf-8")
    try: audit.render(p,work,None)
    except ValueError: pass
    else: raise AssertionError("Unavailable assets must not silently pass")
print("real artifact render fixtures OK: PPTX hidden slide, DOCX, XLSX hidden sheet/print area, PDF, PNG, HTML, SVG")
