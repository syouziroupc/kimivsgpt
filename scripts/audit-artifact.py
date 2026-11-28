#!/usr/bin/env python3
"""Render local trusted artifacts and send only page images + selected evidence.
Dependencies: LibreOffice (Office), PyMuPDF (PDF), Pillow (images),
Playwright + Chromium (HTML/SVG). No cloud storage or external renderer.
"""
import argparse, base64, hashlib, io, json, os, pathlib, shutil, subprocess, tempfile
import urllib.request, urllib.error, zipfile, xml.etree.ElementTree as ET

ENDPOINT = "https://kimivsgpt.syouziroupc.workers.dev/visual"
MAX_BYTES = 2 * 1024 * 1024
OFFICE = {".pptx", ".docx", ".xlsx", ".odp", ".odt", ".ods"}
IMAGES = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"}
def sha(data): return hashlib.sha256(data).hexdigest()
def digest(path): return sha(path.read_bytes())
def normalize(data):
    from PIL import Image
    with Image.open(io.BytesIO(data)) as im:
        if getattr(im, "n_frames", 1) != 1:
            raise ValueError("animated/multipage images require explicit frame rendering")
        if im.width * im.height > 16_000_000:
            raise ValueError("image exceeds pixel limit; render in sections")
        im = im.convert("RGB")
        out = io.BytesIO(); im.save(out, "PNG", optimize=True)
        if len(out.getvalue()) <= MAX_BYTES: return out.getvalue()
        for q in (95, 90, 85):
            out = io.BytesIO(); im.save(out, "JPEG", quality=q, subsampling=0)
            if len(out.getvalue()) <= MAX_BYTES: return out.getvalue()
        raise ValueError("image too large; render in sections, do not silently shrink")
def pdf_pages(path):
    import fitz
    pages = []
    with fitz.open(path) as doc:
        if doc.needs_pass or len(doc)==0: raise ValueError("encrypted or empty PDF")
        for page in doc:
            if page.rect.width*page.rect.height*(160/72)**2 > 16_000_000: raise ValueError("rendered page exceeds pixel budget; supply explicit section render manifest")
            # Never clip the page; modest 160 DPI gives readable normal text.
            pix = page.get_pixmap(matrix=fitz.Matrix(160/72,160/72), alpha=False)
            findings=[]
            # A visible page is authoritative; text extraction alone is not a pass.
            text=page.get_text("text")
            for b in page.get_text("blocks"):
                if b[6]==0 and (b[0]<-1 or b[1]<-1 or b[2]>page.rect.width+1 or b[3]>page.rect.height+1):
                    findings.append("Text block outside rendered page boundary")
            pages.append((normalize(pix.tobytes("png")),text[:12000],findings[:30]))
    return pages
def render_office(path, tmp):
    exe=shutil.which("soffice") or shutil.which("libreoffice")
    if not exe: raise RuntimeError("LibreOffice not installed or not on PATH")
    profile=(tmp/"lo-profile").as_uri()
    ext=path.suffix.lower()
    options={"UseLosslessCompression":{"type":"boolean","value":"true"}}
    if ext in {".pptx",".odp"}:
        filt="impress_pdf_Export"
        options["ExportHiddenSlides"]={"type":"boolean","value":"true"}
    elif ext in {".xlsx",".ods"}:
        filt="calc_pdf_Export"
        options["SinglePageSheets"]={"type":"boolean","value":"true"}
    else: filt="writer_pdf_Export"
    target="pdf:"+filt+":"+json.dumps(options,separators=(",",":"))
    subprocess.run([exe,"-env:UserInstallation="+profile,"--headless","--convert-to",target,"--outdir",str(tmp),str(path)],check=True,timeout=120,capture_output=True)
    pdf=tmp/(path.stem+".pdf")
    if not pdf.is_file(): raise RuntimeError("Office conversion did not produce a PDF")
    pages=pdf_pages(pdf)
    if path.suffix.lower()==".pptx":
        with zipfile.ZipFile(path) as z:
            root=ET.fromstring(z.read("ppt/presentation.xml"))
            ids=root.findall(".//{http://schemas.openxmlformats.org/presentationml/2006/main}sldId")
            if len(ids)!=len(pages): raise RuntimeError("PPTX slide count differs from rendered pages (including hidden slides)")
    if ext==".xlsx":
        with zipfile.ZipFile(path) as z:
            root=ET.fromstring(z.read("xl/workbook.xml"))
            count=len(root.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet"))
            if count!=len(pages): raise RuntimeError("XLSX sheet count differs from whole-sheet rendering")
    if ext==".ods":
        with zipfile.ZipFile(path) as z:
            root=ET.fromstring(z.read("content.xml"))
            count=len(root.findall(".//{urn:oasis:names:tc:opendocument:xmlns:office:1.0}spreadsheet/{urn:oasis:names:tc:opendocument:xmlns:table:1.0}table"))
            if count!=len(pages): raise RuntimeError("ODS sheet count differs from whole-sheet rendering")
    return pages
def web_pages(path):
    from playwright.sync_api import sync_playwright
    pages=[]
    with sync_playwright() as p:
        browser=p.chromium.launch()
        try:
            for width,height in ((1440,900),(390,844)):
                context=browser.new_context(viewport={"width":width,"height":height},device_scale_factor=1,service_workers="block")
                context.route("**/*",lambda route: route.continue_() if route.request.url.startswith(("file:","data:","blob:")) else route.abort())
                page=context.new_page()
                page.goto(path.as_uri(),wait_until="load",timeout=15000)
                page.evaluate("document.fonts.ready")
                h=page.evaluate("Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight||0)")
                if h>10000: raise ValueError("long web page: provide viewport/section screenshots in manifest")
                overflow=page.evaluate("document.documentElement.scrollWidth > innerWidth+1")
                shot=page.screenshot(full_page=True,animations="disabled")
                pages.append((normalize(shot),page.locator("body").inner_text()[:12000],["Horizontal viewport overflow"] if overflow else []))
                context.close()
        finally: browser.close()
    return pages
def render(path,tmp,manifest):
    ext=path.suffix.lower()
    if manifest:
        data=json.loads(manifest.read_text(encoding="utf-8"))
        if data.get("artifact_sha256")!=digest(path): raise ValueError("manifest does not match original artifact")
        entries=data["pages"]
        if not entries or data.get("page_count")!=len(entries): raise ValueError("incomplete render manifest")
        pages=[]
        for i,item in enumerate(entries,1):
            if item["page"]!=i: raise ValueError("manifest page order invalid")
            image=(manifest.parent/item["image"]).resolve()
            if not image.is_relative_to(manifest.parent.resolve()): raise ValueError("manifest path escapes directory")
            raw=image.read_bytes()
            if item.get("image_sha256")!=sha(raw): raise ValueError("manifest image hash mismatch")
            pages.append((normalize(raw),item.get("extracted_text","")[:12000],item.get("structural_findings",[])[:30]))
        if ext==".pptx":
            with zipfile.ZipFile(path) as z:
                count=len(ET.fromstring(z.read("ppt/presentation.xml")).findall(".//{http://schemas.openxmlformats.org/presentationml/2006/main}sldId"))
                if count!=len(pages):raise ValueError("manifest does not cover all PPTX slides")
        return pages,"provided-render-manifest"
    if ext in OFFICE:return render_office(path,tmp),"LibreOffice+PyMuPDF"
    if ext==".pdf":return pdf_pages(path),"PyMuPDF"
    if ext in {".html",".htm",".svg"}:return web_pages(path),"Playwright Chromium offline"
    if ext in IMAGES:return [(normalize(path.read_bytes()),"",[])],"Pillow original image"
    raise ValueError("unsupported type; supply explicit render manifest")
def request(payload,token):
    req=urllib.request.Request(ENDPOINT,data=json.dumps(payload,ensure_ascii=False).encode(),headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"},method="POST")
    try:
        with urllib.request.urlopen(req,timeout=35) as res: return json.load(res)
    except (urllib.error.URLError,TimeoutError,ValueError):
        return {"verdict":"verify","error":"transport_or_response_failure"}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("artifact",type=pathlib.Path)
    p.add_argument("--requirements",required=True)
    p.add_argument("--manifest",type=pathlib.Path,help="Verified producer render manifest for exact/large/unsupported layouts")
    p.add_argument("--output",required=True,type=pathlib.Path)
    p.add_argument("--max-pages",type=int,default=100)
    args=p.parse_args()
    path=args.artifact.resolve()
    artifact_hash=digest(path)
    token=os.environ.get("AUDITOR_ACCESS_TOKEN")
    if not token: p.error("Set a valid KIMI OAuth access token or owner API bearer in AUDITOR_ACCESS_TOKEN; never use OWNER_AUTH_SECRET")
    if not 1<=args.max_pages<=500 or not 1<=len(args.requirements)<=3000:p.error("invalid page cap or requirements length")
    try:
        with tempfile.TemporaryDirectory() as d: pages,renderer=render(path,pathlib.Path(d),args.manifest.resolve() if args.manifest else None)
        if not pages or len(pages)>args.max_pages:raise ValueError("page count exceeds configured cap")
        reviews=[]
        for i,(img,text,findings) in enumerate(pages,1):
            payload={"artifact_sha256":artifact_hash,"page":i,"page_count":len(pages),"requirements":args.requirements,"renderer":renderer,"extracted_text":text,"structural_findings":findings,"image_base64":base64.b64encode(img).decode()}
            result=request(payload,token)
            verified=(result.get("artifact_sha256")==artifact_hash and result.get("image_sha256")==sha(img) and result.get("page")==i and result.get("page_count")==len(pages) and result.get("coverage",{}).get("complete") is True)
            if not verified:result["verdict"]="verify" if result.get("verdict")!="revise" else "revise"
            reviews.append(result)
        unchanged=digest(path)==artifact_hash
        verdict="revise" if any(r.get("verdict")=="revise" for r in reviews) else "proceed" if unchanged and all(r.get("verdict")=="proceed" for r in reviews) else "verify"
        report={"verdict":verdict,"artifact_sha256":artifact_hash,"renderer":renderer,"page_count":len(pages),"artifact_unchanged":unchanged,"pages":reviews}
    except Exception as e:
        report={"verdict":"verify","artifact_sha256":artifact_hash,"error":str(e)[:500],"pages":[]}
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(report["verdict"])
    return 0 if report["verdict"]=="proceed" else 2
if __name__=="__main__":raise SystemExit(main())
