"""Build the Round 2 deliverables into "ui ux round/".

  python3 scripts/round2/build.py               # everything (needs .venv-ux with Playwright)
  python3 scripts/round2/build.py --no-export   # skip PDFs/PNGs (no browser needed)

Writes:
  ui ux round/01_DFD_Level_0.drawio|pdf|png   one draw.io file per diagram, plus a PDF and PNG
  ui ux round/02_DFD_Level_1.drawio|pdf|png   rendered by draw.io's own viewer. A .drawio saved
                                              from draw.io by a person is never overwritten
  ui ux round/03_Sitemap.drawio|pdf|png
  ui ux round/04_User_Flows.drawio|pdf|png
  ui ux round/05_Personas.pdf                 from scripts/round2/pages/*.html
  ui ux round/06_Style_Guide.pdf
  ui ux round/07_Wireframes.pdf
  ui ux round/08_Design_Rationale.pdf
  ui ux round/09_Clickable_Prototype.html     the only HTML deliverable
  ui ux round/icons/*.svg
  docs/ux/routeguard-architecture.drawio      all 4 diagrams in one file (working copy)
  docs/ux/figma-plugin/code.js                its DATA block
  scripts/round2/.build/*.html                the assembled document pages (for checks)
"""

from __future__ import annotations

import csv
import json
import os
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
UX = ROOT / "docs/ux"
OUT = ROOT / "ui ux round"
WEB = HERE / "web"
PAGES = HERE / "pages"
TMP = HERE / ".build"
ICONS = UX / "assets/icons"
sys.path.insert(0, str(HERE))

from diagrams import all_diagrams  # noqa: E402
from engine import to_drawio  # noqa: E402

VIEWER_JS = "https://viewer.diagrams.net/js/viewer-static.min.js"
DIAGRAM_FILES = {"l0": "01_DFD_Level_0", "l1": "02_DFD_Level_1", "sm": "03_Sitemap", "uf": "04_User_Flows"}
DOCS = {  # page file -> (title, landscape)
    "05_Personas": ("RouteGuard: User research and personas", False),
    "06_Style_Guide": ("RouteGuard: Style guide", True),
    "07_Wireframes": ("RouteGuard: Low-fidelity wireframes", True),
    "08_Design_Rationale": ("RouteGuard: Design rationale", False),
}
PROTO = "09_Clickable_Prototype"
GENERATED = 'agent="scripts/round2/build.py"'  # draw.io replaces this when someone saves the file


def icon_sprite() -> str:
    parts = []
    for f in sorted(ICONS.glob("*.svg")):
        txt = f.read_text()
        body = re.search(r"<svg[^>]*>(.*)</svg>", txt, re.S).group(1)
        title = re.search(r"<title[^>]*>(.*?)</title>", txt).group(1)
        body = re.sub(r"<title[^>]*>.*?</title>", "", body)
        parts.append(f'<symbol id="i-{f.stem}" viewBox="0 0 24 24" data-title="{title}">{body}</symbol>')
    return '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' + "".join(parts) + "</svg>"


def load_data() -> dict:
    return {
        "tokens": json.loads((UX / "data/tokens.json").read_text()),
        "live": json.loads((UX / "data/live-2026-11-10.json").read_text()),
        "replay": json.loads((UX / "data/replay-2025-08-25.json").read_text()),
        "points": json.loads((ROOT / "jobs/points.json").read_text())["points"],
        "incidents": list(csv.DictReader((ROOT / "data/incidents.csv").open())),
    }


def assemble(title: str, body: str, css: list[str], js: list[str], data: dict, body_class: str = "") -> str:
    styles = "\n".join((WEB / c).read_text() for c in css)
    script = "\n".join((WEB / j).read_text() for j in js)
    if "</script" in script:
        raise SystemExit("page scripts must not contain a closing script tag")
    blob = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    return (f'<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            f'<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>{title}</title>\n'
            f"<style>\n{styles}\n</style>\n</head>\n<body class=\"{body_class}\">\n{icon_sprite()}\n{body}\n"
            f'<script id="rg-data" type="application/json">{blob}</script>\n'
            f"<script>\n(() => {{\n  'use strict';\n{script}\n}})();\n</script>\n</body>\n</html>\n")


def build_plugin(tokens: dict, replay: dict) -> None:
    """Fill the DATA block of the Figma plugin: tokens, icon SVGs and the replay rows."""
    code = UX / "figma-plugin/code.js"
    if not code.exists():
        return
    icons = {f.stem: re.sub(r"<title[^>]*>.*?</title>", "", f.read_text()).strip() for f in sorted(ICONS.glob("*.svg"))}
    rows = [[r["zone_id"], r["horizon_hours"], r["level"], r["overall"], r["confidence"], r["reason"]] for r in replay["rows"]]
    data = {"tokens": {k: tokens[k] for k in ("color", "space", "radius", "touch_min_px", "type", "contrast_pairs")},
            "icons": icons, "replay": rows}
    block = "const DATA = " + json.dumps(data, indent=1, ensure_ascii=False) + ";"
    src = code.read_text()
    pat = re.compile(r"(/\* BUILD:data \*/\n)(.*?)(\n/\* /BUILD:data \*/)", re.S)
    if not pat.search(src):
        raise SystemExit("marker BUILD:data not found in figma-plugin/code.js")
    code.write_text(pat.sub(lambda m: m.group(1) + block + m.group(3), src))


RENDER_JS = r"""
({xml}) => {
  const doc = mxUtils.parseXml(xml);
  const model = doc.documentElement.getElementsByTagName('diagram')[0].getElementsByTagName('mxGraphModel')[0];
  const c = document.getElementById('c');
  c.innerHTML = '';
  const graph = new Graph(c);
  graph.setEnabled(false);
  new mxCodec(model.ownerDocument).decode(model, graph.getModel());
  graph.refresh();
  const b = graph.getGraphBounds();
  const pad = 24;
  graph.view.setTranslate(pad - b.x, pad - b.y);
  const w = Math.ceil(b.width + 2 * pad), h = Math.ceil(b.height + 2 * pad);
  c.style.width = w + 'px'; c.style.height = h + 'px';
  document.body.style.width = w + 'px'; document.body.style.height = h + 'px';
  return { w, h };
}
"""

FOOTER = ('<div style="font-family:Helvetica,Arial,sans-serif;font-size:8px;color:#475569;width:100%;'
          'padding:0 14mm;display:flex;justify-content:space-between"><span>RouteGuard · Team 01 · Sangam Round 2 (UI/UX)</span>'
          '<span>page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>')


def export(drawio_files: dict[str, Path], doc_html: dict[str, Path]) -> None:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        b = p.chromium.launch()
        # diagrams, rendered by draw.io's own viewer
        pg = b.new_page(device_scale_factor=2)
        pg.set_content("<!doctype html><html><body style='margin:0;background:#FDF8F0'><div id='c'></div></body></html>")
        pg.add_script_tag(url=VIEWER_JS)
        pg.wait_for_function("() => typeof Graph !== 'undefined' && typeof mxCodec !== 'undefined'", timeout=30000)
        for stem, f in drawio_files.items():
            size = pg.evaluate(RENDER_JS, {"xml": f.read_text()})
            pg.set_viewport_size({"width": size["w"], "height": size["h"]})
            pg.locator("#c").screenshot(path=str(OUT / f"{stem}.png"))
            pg.pdf(path=str(OUT / f"{stem}.pdf"), width=f"{size['w']}px", height=f"{size['h']}px",
                   print_background=True, margin={"top": "0", "bottom": "0", "left": "0", "right": "0"}, page_ranges="1")
            print(f"  {stem}.pdf / .png  {size['w']}x{size['h']}")
        pg.close()
        # documents
        dp = b.new_page()
        for stem, f in doc_html.items():
            landscape = DOCS[stem][1]
            dp.goto(f.resolve().as_uri())
            dp.wait_for_timeout(150)
            dp.pdf(path=str(OUT / f"{stem}.pdf"), format="A4", landscape=landscape, print_background=True,
                   display_header_footer=True, header_template="<div></div>", footer_template=FOOTER,
                   margin={"top": "14mm", "bottom": "16mm", "left": "14mm", "right": "14mm"})
            print(f"  {stem}.pdf")
        b.close()


def main() -> int:
    no_export = "--no-export" in sys.argv
    if not no_export:
        try:
            import playwright  # noqa: F401
        except ImportError:
            venv = ROOT / ".venv-ux"
            if (venv / "bin/python").exists() and Path(sys.prefix).resolve() != venv.resolve() and not os.environ.get("RG_REEXEC"):
                os.environ["RG_REEXEC"] = "1"
                os.execv(str(venv / "bin/python"), [str(venv / "bin/python"), *sys.argv])
            raise SystemExit("Playwright not found: create .venv-ux (see scripts/verify_round2_all.py) or pass --no-export")

    OUT.mkdir(exist_ok=True)
    TMP.mkdir(exist_ok=True)
    ds = all_diagrams()
    (UX / "routeguard-architecture.drawio").write_text(to_drawio(ds))
    drawio_files = {}
    for d in ds:
        stem = DIAGRAM_FILES[d.key]
        f = OUT / f"{stem}.drawio"
        if f.exists() and GENERATED not in f.read_text():
            # saved from draw.io by a person: keep it, and keep their own PDF/PNG export
            print(f"  kept hand-made {f.name} (and its .pdf/.png)")
            continue
        f.write_text(to_drawio([d]))
        drawio_files[stem] = f
    print(f"wrote {len(drawio_files)} generated .drawio files and docs/ux/routeguard-architecture.drawio")

    data = load_data()
    build_plugin(data["tokens"], data["replay"])
    doc_html = {}
    for stem, (title, landscape) in DOCS.items():
        body = f'<div class="doc-page{" landscape" if landscape else ""}">\n' + (PAGES / f"{stem}.html").read_text() + "\n</div>"
        html_ = assemble(title, body, ["base.css", "docs.css"], ["shared.js", "docs.js"], {"tokens": data["tokens"]}, "doc")
        f = TMP / f"{stem}.html"
        f.write_text(html_)
        doc_html[stem] = f
    proto = assemble("RouteGuard: Clickable prototype", (PAGES / f"{PROTO}.html").read_text(),
                     ["base.css", "prototype.css"], ["shared.js", "prototype.js"], data, "proto")
    (OUT / f"{PROTO}.html").write_text(proto)
    print(f"wrote {PROTO}.html")

    icon_dir = OUT / "icons"
    if icon_dir.exists():
        shutil.rmtree(icon_dir)
    shutil.copytree(ICONS, icon_dir)

    if not no_export:
        export(drawio_files, doc_html)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
