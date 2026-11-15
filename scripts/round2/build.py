"""Build the Round 2 UX pack from source.

  python3 scripts/round2/build.py

Writes:
  docs/ux/routeguard-architecture.drawio      4-page draw.io file (from diagrams.py)
  docs/ux/assets/diagrams/*.svg               the same diagrams as standalone SVG
  docs/ux/routeguard-round2-master.html       fills the <!-- BUILD:... --> blocks:
      diagrams, icons, tokens, prototype data, prototype JS (prototype.js)
      and the judge defense guide
"""

from __future__ import annotations

import csv
import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
UX = ROOT / "docs/ux"
sys.path.insert(0, str(HERE))

from diagrams import all_diagrams  # noqa: E402
from engine import to_drawio, to_svg  # noqa: E402

HTML = UX / "routeguard-round2-master.html"
BIBLE = UX / "judge-defense-bible.md"
ICONS = UX / "assets/icons"


def md_to_html(md: str) -> str:
    """Small Markdown subset: #/##/### headings, paragraphs, - lists, **bold**, `code`, tables."""
    out: list[str] = []
    lines = md.splitlines()
    i = 0
    in_list = False

    def inline(s: str) -> str:
        s = html.escape(s)
        s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
        s = re.sub(r"`(.+?)`", r"<code>\1</code>", s)
        return s

    while i < len(lines):
        ln = lines[i].rstrip()
        if ln.startswith("- "):
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{inline(ln[2:])}</li>")
            i += 1
            continue
        if in_list:
            out.append("</ul>")
            in_list = False
        if not ln:
            i += 1
            continue
        m = re.match(r"^(#{1,4}) (.*)", ln)
        if m:
            lvl = len(m.group(1)) + 1
            txt = m.group(2)
            anchor = re.sub(r"[^a-z0-9]+", "-", txt.lower()).strip("-")
            cls = ' class="qa-q"' if lvl == 4 else ""
            out.append(f'<h{lvl} id="jd-{anchor}"{cls}>{inline(txt)}</h{lvl}>')
            i += 1
            continue
        if ln.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            head, body = rows[0], [r for r in rows[2:]]
            t = ["<table><thead><tr>", *[f"<th>{inline(c)}</th>" for c in head], "</tr></thead><tbody>"]
            for r in body:
                t += ["<tr>", *[f"<td>{inline(c)}</td>" for c in r], "</tr>"]
            t.append("</tbody></table>")
            out.append("".join(t))
            continue
        para = [ln]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r"^(#|- |\|)", lines[i]):
            para.append(lines[i].strip())
            i += 1
        out.append(f"<p>{inline(' '.join(para))}</p>")
    if in_list:
        out.append("</ul>")
    return "\n".join(out)


def icon_sprites() -> str:
    parts = []
    for f in sorted(ICONS.glob("*.svg")):
        txt = f.read_text()
        body = re.search(r"<svg[^>]*>(.*)</svg>", txt, re.S).group(1)
        body = re.sub(r"<title[^>]*>.*?</title>", "", body)
        title = re.search(r"<title[^>]*>(.*?)</title>", txt).group(1)
        parts.append(f'<symbol id="i-{f.stem}" viewBox="0 0 24 24" data-title="{html.escape(title)}">{body}</symbol>')
    return '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' + "".join(parts) + "</svg>"


def replace_block(text: str, name: str, content: str) -> str:
    pat = re.compile(rf"(<!-- BUILD:{name} -->)(.*?)(<!-- /BUILD:{name} -->)", re.S)
    if not pat.search(text):
        raise SystemExit(f"marker BUILD:{name} not found in {HTML.name}")
    return pat.sub(lambda m: m.group(1) + "\n" + content + "\n" + m.group(3), text)


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
    print(f"updated {code.relative_to(ROOT)}")


def main() -> int:
    ds = all_diagrams()
    (UX / "routeguard-architecture.drawio").write_text(to_drawio(ds))
    out_dir = UX / "assets/diagrams"
    out_dir.mkdir(parents=True, exist_ok=True)
    svgs = {}
    for d in ds:
        svg = to_svg(d)
        svgs[d.key] = svg
        (out_dir / f"{d.name}.svg").write_text(svg.replace('class="dg"', 'class="dg" xmlns:xlink="http://www.w3.org/1999/xlink"', 1)
                                               .replace("<svg ", '<svg font-family="Helvetica, Arial, sans-serif" ', 1))
    print(f"wrote routeguard-architecture.drawio ({len(ds)} pages) and {len(ds)} SVGs")
    if not HTML.exists():
        print("no master HTML yet, skipping")
        return 0
    text = HTML.read_text()
    for d in ds:
        if f"BUILD:dg-{d.key}" in text:
            text = replace_block(text, f"dg-{d.key}", svgs[d.key])
    text = replace_block(text, "icons", icon_sprites())
    tokens = json.loads((UX / "data/tokens.json").read_text())
    data = {
        "tokens": tokens,
        "live": json.loads((UX / "data/live-2026-11-10.json").read_text()),
        "replay": json.loads((UX / "data/replay-2025-08-25.json").read_text()),
        "points": json.loads((ROOT / "jobs/points.json").read_text())["points"],
        "exposure": json.loads((ROOT / "lib/risk/config.json").read_text())["exposure"],
        "incidents": list(csv.DictReader((ROOT / "data/incidents.csv").open())),
    }
    text = replace_block(text, "data", f'<script id="rg-data" type="application/json">{json.dumps(data, separators=(",", ":")).replace("</", "<\\/")}</script>')
    js = (HERE / "prototype.js").read_text()
    if "</script" in js:
        raise SystemExit("prototype.js must not contain a closing script tag")
    text = replace_block(text, "app", f"<script>\n{js}</script>")
    if BIBLE.exists():
        text = replace_block(text, "bible", md_to_html(BIBLE.read_text()))
    HTML.write_text(text)
    print(f"updated {HTML.relative_to(ROOT)}")
    build_plugin(tokens, data["replay"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
