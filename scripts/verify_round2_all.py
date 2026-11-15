#!/usr/bin/env python3
"""Audit every Round 2 UX file. Exits 0 only with 0 errors and 0 warnings.

  python3 scripts/verify_round2_all.py            # everything
  python3 scripts/verify_round2_all.py --no-browser   # skip checks that need Chromium

Checks
  1  draw.io XML and geometry (ids, ports, orthogonal paths, grid, overlaps,
     piercing, collinear overlaps, label clearance, DFD rules, L0/L1 balancing),
     then the same file rendered by draw.io's own viewer, comparing its routed
     edge points with ours.
  2  SVG icons, and the deliverables in "ui ux round/": every file there and
     non-empty, each diagram's .drawio identical to its page in the working
     copy, one-page diagram PDFs, the prototype the only HTML and offline.
  3  WCAG contrast for every token pair we use, token sync between files,
     48 px touch targets and minimum font sizes in the prototype.
  4  Figma plugin: node --check, required API calls, tokens match.
  5  Screenshots of every document page, prototype state and draw.io page to
     /tmp/round2_audit/*.png (look at them).

The browser checks need Playwright. If it is not importable, this script
re-runs itself with .venv-ux/bin/python when that exists:
  python3 -m venv .venv-ux && .venv-ux/bin/pip install playwright && .venv-ux/bin/python -m playwright install chromium
"""

from __future__ import annotations

import argparse
import html
import json
import math
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UX = ROOT / "docs/ux"
DRAWIO = UX / "routeguard-architecture.drawio"
OUT = ROOT / "ui ux round"
HTML = OUT / "09_Clickable_Prototype.html"
BUILD = ROOT / "scripts/round2/.build"
DIAGRAM_FILES = ["01_DFD_Level_0", "02_DFD_Level_1", "03_Sitemap", "04_User_Flows"]
DOC_FILES = ["05_Personas", "06_Style_Guide", "07_Wireframes", "08_Design_Rationale"]
ICONS = UX / "assets/icons"
PLUGIN = UX / "figma-plugin"
TOKENS = UX / "data/tokens.json"
SHOTS = Path("/tmp/round2_audit")
VIEWER_JS = "https://viewer.diagrams.net/js/viewer-static.min.js"

REQUIRED_ICONS = [
    "hazard-landslide", "hazard-rockfall", "hazard-flash-flood", "hazard-snow-ice",
    "decision-send", "decision-hold", "decision-rail", "decision-divert",
    "nav-map", "nav-strip", "nav-advisor", "status-offline-queue",
]
PAGES = ["1_DFD_Level_0_Context", "2_DFD_Level_1_System", "3_PWA_Sitemap", "4_User_Flows"]
VERBS = {
    "get", "gets", "send", "sends", "fetch", "fetches", "check", "checks", "compute", "computes", "calculate",
    "score", "scores", "update", "updates", "create", "creates", "read", "reads", "write", "writes", "save",
    "saves", "store", "stores", "load", "loads", "display", "displays", "show", "shows", "verify", "verifies",
    "dispatch", "dispatches", "report", "reports", "process", "processes", "submit", "submits", "request",
    "requests", "return", "returns", "push", "pushes", "pull", "pulls", "sync", "syncs", "post", "posts",
    "notify", "notifies", "generate", "generates", "validate", "validates", "assign", "assigns", "track",
    "tracks", "book", "books", "hold", "holds", "divert", "diverts", "upload", "uploads", "download",
    "downloads", "query", "queries", "queue", "queues", "cache", "caches", "alert", "alerts", "add", "adds",
    "set", "sets", "give", "gives", "enter", "enters", "receive", "receives", "provide", "provides",
}
MIN_GAP = 25  # px between unrelated vertices
LABEL_GAP = 4

errors: list[str] = []
warnings: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


# =============================================================== helpers

def parse_style(s: str) -> dict[str, str]:
    out = {}
    for part in (s or "").split(";"):
        if not part:
            continue
        if "=" in part:
            k, v = part.split("=", 1)
            out[k] = v
        else:
            out[part] = "1"
    return out


def shape_of(st: dict[str, str]) -> str:
    if "ellipse" in st or st.get("shape") == "ellipse":
        return "ellipse"
    if "rhombus" in st or st.get("shape") == "rhombus":
        return "rhombus"
    if st.get("shape") == "parallelogram":
        return "parallelogram"
    if "swimlane" in st:
        return "swimlane"
    if "text" in st:
        return "text"
    return "rect"


def strip_html(v: str) -> str:
    v = re.sub(r"<br\s*/?>", "\n", v or "")
    return html.unescape(re.sub(r"<[^>]+>", "", v))


def text_width(s: str, size: float, bold: bool = False) -> float:
    narrow, wide = set("ijlI.,:;'|!()[] "), set("mwMWOQGD@%&")
    w = 0.0
    for ch in s:
        w += 0.30 if ch in narrow else 0.86 if ch in wide else 0.68 if ch.isupper() else 0.58 if ch.isdigit() else 0.56
    return w * size * (1.07 if bold else 1.0)


def rect_gap(a, b) -> float:
    """Signed gap between two boxes (x, y, w, h); negative = overlap."""
    dx = max(b[0] - (a[0] + a[2]), a[0] - (b[0] + b[2]))
    dy = max(b[1] - (a[1] + a[3]), a[1] - (b[1] + b[3]))
    return max(dx, dy)


def box_vertex_gap(lb, vb, shape) -> float:
    """Gap between a label box and a vertex; ellipses use their real outline."""
    g = rect_gap(lb, vb)
    if shape != "ellipse" or g >= 6:
        return g
    cx, cy, rx, ry = vb[0] + vb[2] / 2, vb[1] + vb[3] / 2, vb[2] / 2, vb[3] / 2
    x0, y0, w, h = lb
    pts = [(x0 + w * i / 40, y0) for i in range(41)] + [(x0 + w * i / 40, y0 + h) for i in range(41)]
    pts += [(x0, y0 + h * i / 20) for i in range(21)] + [(x0 + w, y0 + h * i / 20) for i in range(21)]
    best = 1e9
    for x, y in pts:
        # distance to the ellipse, approximated along the ray from the centre
        dx, dy = x - cx, y - cy
        r = math.hypot(dx, dy)
        if r < 1e-9:
            return -1
        t = 1 / math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
        best = min(best, r * (1 - t))
    return best


def seg_hits_box(p, q, box, pad=0.0) -> bool:
    x, y, w, h = box[0] - pad, box[1] - pad, box[2] + 2 * pad, box[3] + 2 * pad
    if abs(p[1] - q[1]) < 0.5:  # horizontal
        yy = p[1]
        lo, hi = sorted((p[0], q[0]))
        return y < yy < y + h and lo < x + w and hi > x
    lo, hi = sorted((p[1], q[1]))
    xx = p[0]
    return x < xx < x + w and lo < y + h and hi > y


def project(shape: str, box, pt) -> tuple[float, float]:
    """draw.io perimeter projection: where the ray from the centre to pt meets the outline."""
    x, y, w, h = box
    cx, cy = x + w / 2, y + h / 2
    dx, dy = pt[0] - cx, pt[1] - cy
    if abs(dx) < 1e-9 and abs(dy) < 1e-9:
        return pt
    if shape == "ellipse":
        a, b = w / 2, h / 2
        t = 1 / math.sqrt((dx / a) ** 2 + (dy / b) ** 2)
        return cx + dx * t, cy + dy * t
    if shape == "rhombus":
        a, b = w / 2, h / 2
        t = 1 / (abs(dx) / a + abs(dy) / b)
        return cx + dx * t, cy + dy * t
    if shape == "parallelogram":
        s = 20
        poly = [(x, y + h), (x + s, y), (x + w, y), (x + w - s, y + h)]
        best = None
        for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
            ex, ey = x2 - x1, y2 - y1
            den = dx * ey - dy * ex
            if abs(den) < 1e-12:
                continue
            t = ((x1 - cx) * ey - (y1 - cy) * ex) / den
            u = ((x1 - cx) * dy - (y1 - cy) * dx) / den
            if t > 0 and -1e-9 <= u <= 1 + 1e-9 and (best is None or t < best):
                best = t
        return (cx + dx * best, cy + dy * best) if best else pt
    return pt


# =============================================================== check 1: draw.io

class Page:
    def __init__(self, name: str):
        self.name = name
        self.cells: dict[str, dict] = {}
        self.vertices: dict[str, dict] = {}
        self.edges: list[dict] = []

    def abs_box(self, vid: str):
        v = self.vertices[vid]
        x, y = v["x"], v["y"]
        p = v["parent"]
        while p in self.vertices:
            x += self.vertices[p]["x"]
            y += self.vertices[p]["y"]
            p = self.vertices[p]["parent"]
        return (x, y, v["w"], v["h"])

    def is_container(self, vid: str) -> bool:
        return self.vertices[vid]["shape"] == "swimlane"

    def ancestors(self, vid: str) -> set[str]:
        out, p = set(), self.vertices[vid]["parent"]
        while p in self.vertices:
            out.add(p)
            p = self.vertices[p]["parent"]
        return out


def load_drawio() -> list[Page]:
    if not DRAWIO.exists():
        err(f"missing {DRAWIO.relative_to(ROOT)}")
        return []
    try:
        tree = ET.parse(DRAWIO)
    except ET.ParseError as e:
        err(f"drawio: XML does not parse: {e}")
        return []
    root = tree.getroot()
    if root.tag != "mxfile":
        err("drawio: root element is not <mxfile>")
    pages = []
    all_ids: dict[str, str] = {}
    for dg in root.findall("diagram"):
        pg = Page(dg.get("name", "?"))
        model = dg.find("mxGraphModel")
        if model is None:
            err(f"{pg.name}: diagram is compressed or empty (we write uncompressed XML)")
            continue
        if model.get("gridSize") != "10" or model.get("grid") != "1":
            err(f"{pg.name}: grid must be on with gridSize=10")
        for c in model.find("root"):
            cid = c.get("id")
            if cid in all_ids:
                err(f"{pg.name}: duplicate mxCell id {cid!r} (also on {all_ids[cid]})")
            all_ids[cid] = pg.name
            st = parse_style(c.get("style", ""))
            cell = {"id": cid, "parent": c.get("parent"), "value": c.get("value", ""), "style": st}
            pg.cells[cid] = cell
            g = c.find("mxGeometry")
            if c.get("vertex") == "1":
                if g is None:
                    err(f"{pg.name}: vertex {cid} has no geometry")
                    continue
                cell.update(x=float(g.get("x", 0)), y=float(g.get("y", 0)), w=float(g.get("width", 0)),
                            h=float(g.get("height", 0)), shape=shape_of(st), label=strip_html(cell["value"]))
                pg.vertices[cid] = cell
            elif c.get("edge") == "1":
                pts = []
                if g is not None:
                    arr = g.find("Array")
                    if arr is not None:
                        pts = [(float(p.get("x", 0)), float(p.get("y", 0))) for p in arr.findall("mxPoint")]
                cell.update(source=c.get("source"), target=c.get("target"), points=pts,
                            gx=float(g.get("x", 0)) if g is not None else 0.0, label=strip_html(cell["value"]))
                pg.edges.append(cell)
        pages.append(pg)
    names = [p.name for p in pages]
    if names != PAGES:
        err(f"drawio: pages are {names}, expected {PAGES}")
    return pages


def edge_path(pg: Page, e: dict) -> list[tuple[float, float]] | None:
    st = e["style"]
    for k in ("exitX", "exitY", "entryX", "entryY"):
        if k not in st:
            err(f"{pg.name}: edge {e['id']} has no {k}")
            return None
    s, t = e["source"], e["target"]
    if s not in pg.vertices or t not in pg.vertices:
        err(f"{pg.name}: edge {e['id']} source/target {s}->{t} is not a vertex on this page")
        return None
    sb, tb = pg.abs_box(s), pg.abs_box(t)
    p0 = (sb[0] + float(st["exitX"]) * sb[2], sb[1] + float(st["exitY"]) * sb[3])
    p1 = (tb[0] + float(st["entryX"]) * tb[2], tb[1] + float(st["entryY"]) * tb[3])
    if st.get("exitPerimeter", "1") != "0":
        p0 = project(pg.vertices[s]["shape"], sb, p0)
    if st.get("entryPerimeter", "1") != "0":
        p1 = project(pg.vertices[t]["shape"], tb, p1)
    return [p0, *e["points"], p1]


DIRS = {"east": (1, 0), "west": (-1, 0), "north": (0, -1), "south": (0, 1)}


def label_box_of(label: str, lx: float, ly: float, size: float = 12):
    lines = label.split("\n")
    w = max(text_width(ln, size) for ln in lines) + 10
    h = 15 * len(lines) + 4
    return (lx - w / 2, ly - h / 2, w, h)


def point_along(path, gx):
    segs = list(zip(path, path[1:]))
    lens = [abs(a[0] - b[0]) + abs(a[1] - b[1]) for a, b in segs]
    total = sum(lens)
    dist = (gx + 1) / 2 * total
    for (a, b), L in zip(segs, lens):
        if dist <= L + 1e-9:
            f = dist / L if L else 0
            return a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f
        dist -= L
    return path[-1]


def check_page_geometry(pg: Page) -> dict[str, list]:
    paths: dict[str, list] = {}
    # grid
    for vid, v in pg.vertices.items():
        for k in ("x", "y", "w", "h"):
            if abs(v[k] % 10) > 1e-6:
                err(f"{pg.name}: vertex {vid} {k}={v[k]} is off the 10 px grid")
    for e in pg.edges:
        for x, y in e["points"]:
            if abs(x % 10) > 1e-6 or abs(y % 10) > 1e-6:
                err(f"{pg.name}: edge {e['id']} waypoint ({x}, {y}) is off the 10 px grid")
        if "edgeStyle" not in e["style"] or e["style"]["edgeStyle"] != "orthogonalEdgeStyle":
            err(f"{pg.name}: edge {e['id']} is not orthogonalEdgeStyle")
        path = edge_path(pg, e)
        if not path:
            continue
        paths[e["id"]] = path
        # orthogonal + direction
        for a, b in zip(path, path[1:]):
            if abs(a[0] - b[0]) > 0.5 and abs(a[1] - b[1]) > 0.5:
                err(f"{pg.name}: edge {e['id']} has a diagonal segment {fmt(a)} -> {fmt(b)}")
            if abs(a[0] - b[0]) < 0.01 and abs(a[1] - b[1]) < 0.01:
                err(f"{pg.name}: edge {e['id']} has a zero-length segment at {fmt(a)}")
        for which, (a, b) in (("sourcePortConstraint", (path[0], path[1])), ("targetPortConstraint", (path[-2], path[-1]))):
            dname = e["style"].get(which)
            if dname not in DIRS:
                err(f"{pg.name}: edge {e['id']} has no {which}")
                continue
            dx, dy = DIRS[dname]
            if which == "targetPortConstraint":
                dx, dy = -dx, -dy  # arriving at a west port means moving east
            mvx, mvy = b[0] - a[0], b[1] - a[1]
            if (dx and mvx * dx <= 0) or (dy and mvy * dy <= 0) or (dx and abs(mvy) > 0.5) or (dy and abs(mvx) > 0.5):
                err(f"{pg.name}: edge {e['id']} {'leaves' if which.startswith('source') else 'enters'} against its port ({dname})")
    leaves = [v for v in pg.vertices if not pg.is_container(v)]
    boxes = {v: pg.abs_box(v) for v in pg.vertices}
    # vertex spacing
    for i, a in enumerate(leaves):
        for b in leaves[i + 1:]:
            g = rect_gap(boxes[a], boxes[b])
            if g < MIN_GAP:
                err(f"{pg.name}: vertices {a} and {b} are {g:.0f} px apart (min {MIN_GAP})")
    # containers: children inside their parent, siblings may touch but not overlap
    for v in pg.vertices:
        p = pg.vertices[v]["parent"]
        if p in pg.vertices and not pg.is_container(v):
            cb, pb = boxes[v], boxes[p]
            head = float(pg.vertices[p]["style"].get("startSize", 0))
            inner = (pb[0] + head, pb[1], pb[2] - head, pb[3])
            if not (cb[0] >= inner[0] + 10 - 1e-6 and cb[1] >= inner[1] + 10 - 1e-6 and
                    cb[0] + cb[2] <= inner[0] + inner[2] - 10 + 1e-6 and cb[1] + cb[3] <= inner[1] + inner[3] - 10 + 1e-6):
                err(f"{pg.name}: {v} is not inside its container {p} with 10 px padding")
    conts = [v for v in pg.vertices if pg.is_container(v)]
    for i, a in enumerate(conts):
        for b in conts[i + 1:]:
            if a in pg.ancestors(b) or b in pg.ancestors(a):
                continue
            same_parent = pg.vertices[a]["parent"] == pg.vertices[b]["parent"]
            g = rect_gap(boxes[a], boxes[b])
            if g < (0 if same_parent and pg.vertices[a]["parent"] in pg.vertices else MIN_GAP):
                err(f"{pg.name}: containers {a} and {b} overlap or are too close ({g:.0f} px)")
    # piercing
    for e in pg.edges:
        path = paths.get(e["id"])
        if not path:
            continue
        segs = list(zip(path, path[1:]))
        for v in leaves:
            for si, (a, b) in enumerate(segs):
                if v in (e["source"], e["target"]):
                    if (v == e["source"] and si == 0) or (v == e["target"] and si == len(segs) - 1):
                        continue
                    if seg_hits_box(a, b, boxes[v], pad=-1):
                        err(f"{pg.name}: edge {e['id']} runs back through its own end {v}")
                    continue
                if seg_hits_box(a, b, boxes[v], pad=4):
                    err(f"{pg.name}: edge {e['id']} pierces unrelated vertex {v}")
    # collinear overlaps between and within edges
    allsegs = []
    for eid, path in paths.items():
        for si, (a, b) in enumerate(zip(path, path[1:])):
            allsegs.append((eid, si, a, b))
    for i in range(len(allsegs)):
        e1, s1, a1, b1 = allsegs[i]
        for j in range(i + 1, len(allsegs)):
            e2, s2, a2, b2 = allsegs[j]
            if e1 == e2 and abs(s1 - s2) <= 1:
                continue
            if abs(a1[1] - b1[1]) < 0.5 and abs(a2[1] - b2[1]) < 0.5 and abs(a1[1] - a2[1]) < 3:
                lo1, hi1 = sorted((a1[0], b1[0]))
                lo2, hi2 = sorted((a2[0], b2[0]))
                if min(hi1, hi2) - max(lo1, lo2) > 1:
                    err(f"{pg.name}: edges {e1} and {e2} run on top of each other (horizontal, y={a1[1]:.0f})")
            elif abs(a1[0] - b1[0]) < 0.5 and abs(a2[0] - b2[0]) < 0.5 and abs(a1[0] - a2[0]) < 3:
                lo1, hi1 = sorted((a1[1], b1[1]))
                lo2, hi2 = sorted((a2[1], b2[1]))
                if min(hi1, hi2) - max(lo1, lo2) > 1:
                    err(f"{pg.name}: edges {e1} and {e2} run on top of each other (vertical, x={a1[0]:.0f})")
    # edge labels: clear of vertices, other labels and other edges
    lboxes = {}
    for e in pg.edges:
        if not e["label"] or e["id"] not in paths:
            continue
        lx, ly = point_along(paths[e["id"]], e["gx"])
        lboxes[e["id"]] = label_box_of(e["label"], lx, ly, float(e["style"].get("fontSize", 12)))
    for eid, lb in lboxes.items():
        for v in leaves:
            if box_vertex_gap(lb, boxes[v], pg.vertices[v]["shape"]) < 6:
                err(f"{pg.name}: label of {eid} touches vertex {v}")
        for eid2, path in paths.items():
            if eid2 == eid:
                continue
            for a, b in zip(path, path[1:]):
                if seg_hits_box(a, b, lb, pad=2):
                    err(f"{pg.name}: edge {eid2} crosses the label of {eid}")
                    break
    ids = list(lboxes)
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            if rect_gap(lboxes[a], lboxes[b]) < LABEL_GAP:
                err(f"{pg.name}: labels of {a} and {b} overlap")
    # vertex text fits
    for vid, v in pg.vertices.items():
        if v["shape"] == "swimlane":
            size = float(v["style"].get("fontSize", 12))
            if text_width(v["label"].replace("\n", " "), size, bold=True) > v["h"] - 16:
                err(f"{pg.name}: swimlane title of {vid} is longer than the lane is tall")
            continue
        lines = [ln for ln in v["label"].split("\n") if ln]
        size = float(v["style"].get("fontSize", 12))
        lh = 17 if size >= 13 else 15
        bw, bh = v["w"], v["h"]
        if len(lines) * lh + 6 > bh:
            err(f"{pg.name}: text of {vid} is taller than its box")
        for k, ln in enumerate(lines):
            yoff = (k - (len(lines) - 1) / 2) * lh
            wavail = avail_width(v["shape"], v["style"], bw, bh, yoff)
            if text_width(ln, size, bold=(k == 0 and "<b>" in v["value"])) > wavail:
                err(f"{pg.name}: text line {ln!r} of {vid} is wider than its box")
    return paths


def avail_width(shape, st, w, h, yoff):
    if shape == "ellipse":
        f = max(0.0, 1 - ((abs(yoff) + 8) / (h / 2)) ** 2)
        return w * math.sqrt(f) - 16
    if shape == "rhombus":
        return w * (1 - (abs(yoff) + 8) / (h / 2)) - 12
    if shape == "parallelogram":
        return w - 48
    if st.get("shape") == "partialRectangle":
        return w - 24
    if shape == "text":
        return w
    return w - 16


def fmt(p):
    return f"({p[0]:.0f},{p[1]:.0f})"


def dfd_role(v: dict) -> str | None:
    lab = v["label"].strip()
    if v["style"].get("shape") == "partialRectangle":
        return "store"
    if re.match(r"^E\d", lab):
        return "entity"
    if v["shape"] == "ellipse" and re.match(r"^(P\d|0\b)", lab):
        return "process"
    return None


def check_dfd(pg: Page, level: int) -> set[tuple[str, str, str]]:
    roles = {vid: dfd_role(v) for vid, v in pg.vertices.items()}
    for vid, r in roles.items():
        if r is None:
            err(f"{pg.name}: vertex {vid} is not an entity (E#), process (P#/0) or store (D#)")
    if level == 0:
        if any(r == "store" for r in roles.values()):
            err(f"{pg.name}: a context diagram has no data stores")
        if sum(r == "process" for r in roles.values()) != 1:
            err(f"{pg.name}: a context diagram has exactly one process")
    for vid, v in pg.vertices.items():
        if roles[vid] == "store":
            st = v["style"]
            if not (st.get("top") == "1" and st.get("bottom") == "1" and st.get("left") == "1" and st.get("right") == "0"):
                err(f"{pg.name}: store {vid} must be an open-ended partialRectangle (top/bottom/left on, right off)")
    ext = set()
    ins = {v: 0 for v in pg.vertices}
    outs = {v: 0 for v in pg.vertices}
    for e in pg.edges:
        s, t = e["source"], e["target"]
        rs, rt = roles.get(s), roles.get(t)
        lab = " ".join(e["label"].split())
        if not lab:
            err(f"{pg.name}: flow {e['id']} has no label")
        else:
            first = re.sub(r"[^a-z]", "", lab.split()[0].lower())
            if first in VERBS:
                err(f"{pg.name}: flow {e['id']} label {lab!r} starts with a verb; DFD flows are data (nouns)")
        if "process" not in (rs, rt):
            err(f"{pg.name}: illegal flow {e['id']} {rs}({s}) -> {rt}({t}); every flow must touch a process")
        outs[s] += 1
        ins[t] += 1
        lab_ent = pg.vertices[s]["label"].split("\n")[0] if rs == "entity" else pg.vertices[t]["label"].split("\n")[0] if rt == "entity" else None
        if lab_ent:
            ext.add((lab_ent, "in" if rs == "entity" else "out", lab))
    for vid, r in roles.items():
        if r == "process":
            if ins[vid] == 0:
                err(f"{pg.name}: process {vid} has no input (miracle)")
            if outs[vid] == 0:
                err(f"{pg.name}: process {vid} has no output (black hole)")
        if r == "store":
            if ins[vid] == 0 or outs[vid] == 0:
                err(f"{pg.name}: store {vid} needs at least one flow in and one flow out")
        if r == "entity" and ins[vid] + outs[vid] == 0:
            err(f"{pg.name}: entity {vid} is not connected")
    return ext


def check_flows_page(pg: Page) -> None:
    shapes = {v["shape"] for v in pg.vertices.values()}
    rounded = any(v["style"].get("rounded") == "1" and v["shape"] == "rect" for v in pg.vertices.values())
    for need in ("ellipse", "rhombus", "parallelogram", "swimlane"):
        if need not in shapes:
            err(f"{pg.name}: no {need} shape")
    if not rounded:
        err(f"{pg.name}: no rounded action shapes")
    pools = [v for v, c in pg.vertices.items() if c["shape"] == "swimlane" and c["parent"] not in pg.vertices]
    if len(pools) < 3:
        err(f"{pg.name}: expected 3 swimlane pools (flows A, B, C), found {len(pools)}")
    outs: dict[str, list] = {}
    for e in pg.edges:
        outs.setdefault(e["source"], []).append(e)
    for vid, v in pg.vertices.items():
        if v["shape"] == "rhombus":
            o = outs.get(vid, [])
            if len(o) < 2:
                err(f"{pg.name}: decision {vid} has fewer than 2 exits")
            if any(not x["label"] for x in o):
                err(f"{pg.name}: decision {vid} has an unlabelled exit")
    starts = [v for v, c in pg.vertices.items() if c["shape"] == "ellipse" and c["style"].get("fillColor") == "#2B5B54"]
    if len(starts) < 3:
        err(f"{pg.name}: expected a start node for each of the 3 flows")
    ins = {e["target"] for e in pg.edges}
    o_set = {e["source"] for e in pg.edges}
    for vid, v in pg.vertices.items():
        if v["shape"] in ("swimlane", "text"):
            continue
        if vid not in ins and vid not in starts:
            err(f"{pg.name}: {vid} ({v['label'][:30]!r}) has no way in")
        if vid not in o_set and v["style"].get("fillColor") != "#1E2D3A":
            err(f"{pg.name}: {vid} ({v['label'][:30]!r}) is a dead end (not an End node)")


def check_sitemap(pg: Page) -> None:
    adj: dict[str, set] = {}
    for e in pg.edges:
        adj.setdefault(e["source"], set()).add(e["target"])
    roots = [v for v, c in pg.vertices.items() if c["label"].startswith("RouteGuard PWA")]
    if len(roots) != 1:
        err(f"{pg.name}: expected one root node starting 'RouteGuard PWA'")
        return
    seen, todo = set(roots), list(roots)
    while todo:
        for n in adj.get(todo.pop(), ()):
            if n not in seen:
                seen.add(n)
                todo.append(n)
    for v, c in pg.vertices.items():
        if c["shape"] == "text" or c["shape"] == "swimlane":
            continue
        if v not in seen:
            err(f"{pg.name}: {v} ({c['label'][:30]!r}) is not reachable from the root")
    labels = " ".join(c["label"] for c in pg.vertices.values())
    for need in ("Risk Map", "48 h Zone Strip", "Dispatch Advisor", "Shipment Board", "Report Hazard",
                 "Offline", "Explainability", "OTP", "TCU", "Desktop", "Empty", "Loading", "Error", "Queued"):
        if need.lower() not in labels.lower():
            err(f"{pg.name}: sitemap does not mention {need!r}")


def check1_drawio() -> list[Page]:
    pages = load_drawio()
    if not pages:
        return pages
    by = {p.name: p for p in pages}
    for p in pages:
        check_page_geometry(p)
    ext = {}
    for lvl, name in ((0, PAGES[0]), (1, PAGES[1])):
        if name in by:
            ext[lvl] = check_dfd(by[name], lvl)
    if 0 in ext and 1 in ext:
        for f in sorted(ext[0] - ext[1]):
            err(f"DFD balancing: Level 0 flow {f} is missing on Level 1")
        for f in sorted(ext[1] - ext[0]):
            err(f"DFD balancing: Level 1 external flow {f} is not on Level 0")
    if PAGES[2] in by:
        check_sitemap(by[PAGES[2]])
    if PAGES[3] in by:
        check_flows_page(by[PAGES[3]])
    return pages


# =============================================================== check 2: icons + inline SVG

def check2_icons() -> None:
    ns = "{http://www.w3.org/2000/svg}"
    for name in REQUIRED_ICONS:
        f = ICONS / f"{name}.svg"
        if not f.exists():
            err(f"icon missing: {f.relative_to(ROOT)}")
    for f in sorted(ICONS.glob("*.svg")):
        try:
            r = ET.parse(f).getroot()
        except ET.ParseError as e:
            err(f"icon {f.name} does not parse: {e}")
            continue
        a = r.attrib
        if a.get("viewBox") != "0 0 24 24":
            err(f"icon {f.name}: viewBox must be 0 0 24 24")
        if a.get("stroke-width") != "2" or a.get("stroke-linecap") != "round" or a.get("stroke-linejoin") != "round":
            err(f"icon {f.name}: needs stroke-width=2 and round caps/joins on the root")
        if a.get("fill") != "none" or a.get("stroke") != "currentColor":
            err(f"icon {f.name}: needs fill=none and stroke=currentColor")
        shapes = [el for el in r.iter() if el.tag in (ns + "path", ns + "circle", ns + "rect", ns + "line", ns + "polyline")]
        if not shapes:
            err(f"icon {f.name}: no vector shapes")
        if r.find(ns + "title") is None:
            err(f"icon {f.name}: no <title> for screen readers")
        for el in r.iter(ns + "path"):
            d = el.get("d", "")
            if not d or not re.fullmatch(r"[MmLlHhVvCcSsQqTtAaZz0-9.,\s\-]+", d) or d.strip()[0] not in "Mm":
                err(f"icon {f.name}: bad path data {d[:30]!r}")
            for num in re.findall(r"-?\d*\.?\d+", d):
                if abs(float(num)) > 24:
                    err(f"icon {f.name}: path value {num} is outside the 24 px box")
        for el in r.iter():
            for k in ("cx", "cy", "x", "y"):
                if k in el.attrib and not (0 <= float(el.get(k)) <= 24):
                    err(f"icon {f.name}: {k}={el.get(k)} is outside the 24 px box")


def pdf_pages(f: Path) -> int:
    return len(re.findall(rb"/Type\s*/Page[^s]", f.read_bytes()))


def model_xml(diagram) -> str:
    """The page's model, with the per-file layer ids (p1-0, p2-1, ...) made neutral."""
    return re.sub(r'"p\d+-([01])"', r'"layer-\1"', ET.tostring(diagram.find("mxGraphModel")).decode())


def check2_deliverables(pages: list[Page]) -> None:
    if not OUT.is_dir():
        err(f"missing folder {OUT.relative_to(ROOT)}/ (run scripts/round2/build.py)")
        return
    rel = lambda f: f.relative_to(ROOT)  # noqa: E731
    want = [OUT / f"{d}.{ext}" for d in DIAGRAM_FILES for ext in ("drawio", "pdf", "png")]
    want += [OUT / f"{d}.pdf" for d in DOC_FILES] + [HTML]
    want += [OUT / "icons" / f"{n}.svg" for n in REQUIRED_ICONS]
    for f in want:
        if not f.exists():
            err(f"missing deliverable {rel(f)}")
        elif f.stat().st_size < (100 if f.suffix == ".svg" else 500):
            err(f"deliverable {rel(f)} is only {f.stat().st_size} bytes")
    allowed = {f.name for f in want} | {"icons"}
    for f in OUT.iterdir():
        if f.name.startswith("."):
            continue
        if f.name not in allowed:
            warn(f"unexpected file in the deliverables folder: {rel(f)}")
    for f in OUT.glob("*.html"):
        if f != HTML:
            err(f"{rel(f)}: only the clickable prototype may be HTML")
    # each diagram file holds exactly its page of the working copy
    try:
        work = {d.get("name"): model_xml(d) for d in ET.parse(DRAWIO).getroot().iter("diagram")}
    except ET.ParseError as e:
        err(f"{rel(DRAWIO)} does not parse: {e}")
        work = {}
    for stem, name in zip(DIAGRAM_FILES, PAGES):
        f = OUT / f"{stem}.drawio"
        if not f.exists():
            continue
        try:
            ds = list(ET.parse(f).getroot().iter("diagram"))
        except ET.ParseError as e:
            err(f"{rel(f)} does not parse: {e}")
            continue
        if 'agent="scripts/round2/build.py"' not in f.read_text():
            # redrawn by hand in draw.io: the geometry checks above are for the generated
            # working copy, so here we only check it opens and has its exports
            print(f"note  {rel(f)} was saved from draw.io by hand; not compared with the working copy")
            if not ds:
                err(f"{rel(f)} has no diagram page")
        elif len(ds) != 1:
            err(f"{rel(f)} should hold 1 diagram page, has {len(ds)}")
        elif ds[0].get("name") != name:
            err(f"{rel(f)}: page is named {ds[0].get('name')!r}, expected {name!r}")
        elif work.get(name) != model_xml(ds[0]):
            err(f"{rel(f)} differs from page {name} of {rel(DRAWIO)}; rebuild")
        for ext, n in (("pdf", 1),):
            p = OUT / f"{stem}.{ext}"
            if p.exists() and pdf_pages(p) != n:
                err(f"{rel(p)} has {pdf_pages(p)} pages, expected {n}")
        png = OUT / f"{stem}.png"
        if png.exists() and png.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
            err(f"{rel(png)} is not a PNG")
    for d in DOC_FILES:
        p = OUT / f"{d}.pdf"
        if p.exists():
            n = pdf_pages(p)
            if not 1 <= n <= 12:
                err(f"{rel(p)} has {n} pages")
            if p.read_bytes()[:5] != b"%PDF-":
                err(f"{rel(p)} is not a PDF")
    if HTML.exists():
        text = HTML.read_text()
        ext = re.findall(r'(?:src|href)=["\'](https?:[^"\']+)', text)
        if ext:
            err(f"{rel(HTML)} loads external files, so it will not work offline: {ext[:3]}")
        if "<title>" not in text:
            err(f"{rel(HTML)} has no <title>")
    old = UX / "routeguard-round2-master.html"
    if old.exists():
        err(f"{rel(old)} is the old all-in-one page; delete it")


# =============================================================== check 3: WCAG + tokens

def lum(hexc: str) -> float:
    h = hexc.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a: str, b: str) -> float:
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def check3_tokens() -> dict:
    tok = json.loads(TOKENS.read_text())
    col = tok["color"]
    for p in tok["contrast_pairs"]:
        if p["fg"] not in col or p["bg"] not in col:
            err(f"tokens: pair {p} uses an unknown token")
            continue
        r = contrast(col[p["fg"]], col[p["bg"]])
        need = max(p["min"], 7.0 if p.get("decision") else 0)
        if r + 1e-9 < need:
            err(f"WCAG: {p['fg']} on {p['bg']} ({p['use']}) is {r:.2f}:1, needs {need}:1")
    for p in tok["rejected_pairs"]:
        r = contrast(col[p["fg"]], col[p["bg"]])
        if r >= 4.5:
            warn(f"tokens: rejected pair {p['fg']} on {p['bg']} is actually {r:.2f}:1; un-reject it")
    if HTML.exists():
        css = HTML.read_text()
        for name, v in col.items():
            var = "--" + name.replace(".", "-")
            m = re.search(rf"{re.escape(var)}:\s*(#[0-9A-Fa-f]{{6}})", css)
            if not m:
                err(f"HTML: CSS variable {var} for token {name} is missing")
            elif m.group(1).upper() != v.upper():
                err(f"HTML: {var} is {m.group(1)} but tokens.json says {v}")
    return tok


# =============================================================== check 4: Figma plugin

def check4_plugin(tok: dict) -> None:
    code = PLUGIN / "code.js"
    man = PLUGIN / "manifest.json"
    for f in (code, man, PLUGIN / "README-FIGMA.md"):
        if not f.exists():
            err(f"missing {f.relative_to(ROOT)}")
    if not code.exists() or not man.exists():
        return
    r = subprocess.run(["node", "--check", str(code)], capture_output=True, text=True)
    if r.returncode != 0:
        err(f"figma code.js syntax: {r.stderr.strip()[:300]}")
    try:
        m = json.loads(man.read_text())
        for k in ("name", "id", "api", "main", "editorType"):
            if k not in m:
                err(f"figma manifest.json has no {k!r}")
        if m.get("main") != "code.js":
            err("figma manifest main must be code.js")
        if m.get("documentAccess") != "dynamic-page":
            err("figma manifest should set documentAccess: dynamic-page (current Figma requirement)")
    except json.JSONDecodeError as e:
        err(f"figma manifest.json does not parse: {e}")
    src = code.read_text()
    for api in ("figma.variables.createVariableCollection", "figma.variables.createVariable", "figma.combineAsVariants",
                "layoutMode", "itemSpacing", "layoutSizingHorizontal", "reactions", "setReactionsAsync",
                "figma.createTextStyle", "figma.createPage", "setBoundVariable", "figma.loadFontAsync",
                "ON_CLICK", "NAVIGATE", "OVERLAY", "figma.closePlugin"):
        if api not in src:
            err(f"figma code.js does not use {api}")
    for page in ("01_Style_Guide_&_Variables", "02_Components_&_Variants", "03_Low_Fi_Wireframes",
                 "04_High_Fi_Prototype_Mobile_&_Desktop"):
        if page not in src:
            err(f"figma code.js does not create page {page}")
    for cs in ("Decision Banner", "Zone Risk Card", "Connectivity & Sync Banner", "Hazard Report Pill", "Bottom Nav Bar"):
        if cs not in src:
            err(f"figma code.js does not build component set {cs!r}")
    for name, v in tok["color"].items():
        if f'"{name}"' not in src or v.upper() not in src.upper():
            err(f"figma code.js token {name} ({v}) is missing or differs from tokens.json")
    for w, h in ((390, 844), (1440, 900)):
        if f"{w}" not in src or f"{h}" not in src:
            err(f"figma code.js has no {w}x{h} frame")


# =============================================================== check 5 + browser parts of 2/3 and 1

def browser_checks(pages: list[Page]) -> None:
    from playwright.sync_api import sync_playwright

    SHOTS.mkdir(parents=True, exist_ok=True)
    for old in SHOTS.glob("*.png"):
        old.unlink()
    url = HTML.resolve().as_uri()
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
        page = ctx.new_page()
        console_errors = []
        page.on("pageerror", lambda e: console_errors.append(str(e)))
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        # document pages, as printed (these become the PDFs)
        for f in sorted(BUILD.glob("0*.html")):
            page.emulate_media(media="print")
            page.goto(f.resolve().as_uri())
            page.wait_for_timeout(200)
            empty = page.evaluate("""() => ['#swatches', '#pairs', '#components', '#wireframes']
                .filter(s => document.querySelector(s) && !document.querySelector(s).children.length)""")
            for sel in empty:
                err(f"{f.name}: {sel} rendered nothing")
            page.set_viewport_size({"width": 1060 if f.stem in ("06_Style_Guide", "07_Wireframes") else 760, "height": 1000})
            page.screenshot(path=str(SHOTS / f"doc_{f.stem}.png"), full_page=True)
            page.set_viewport_size({"width": 1440, "height": 1000})
        page.emulate_media(media="screen")
        if not list(BUILD.glob("0*.html")):
            err(f"no document pages in {BUILD.relative_to(ROOT)} (run scripts/round2/build.py)")
        page.goto(url)
        page.wait_for_timeout(300)
        # prototype: every state, touch targets, font sizes
        states = page.evaluate("() => window.RG && window.RG.auditStates ? window.RG.auditStates() : null")
        if not states:
            err("prototype: window.RG.auditStates() is missing")
        else:
            for st in states:
                page.evaluate("s => window.RG.applyState(s)", st)
                page.wait_for_timeout(120)
                probs = page.evaluate(TOUCH_AUDIT_JS)
                for m in probs:
                    err(f"prototype [{st['name']}]: {m}")
                frame = page.query_selector("#phone") or page.query_selector(".proto-stage")
                if frame:
                    frame.screenshot(path=str(SHOTS / f"proto_{st['name']}.png"))
            page.evaluate("() => window.RG.applyState({name:'reset'})")
        # end-to-end click path: advisor -> commit -> board shows the truck
        e2e = page.evaluate("() => window.RG && window.RG.selfTest ? window.RG.selfTest() : ['selfTest missing']")
        for m in e2e:
            err(f"prototype self-test: {m}")
        # desktop control room
        page.set_viewport_size({"width": 1440, "height": 1600})  # whole control room in one shot
        page.evaluate("() => { window.RG.applyState({name:'desktop', device:'desktop'}); window.scrollTo(0, 0); }")
        page.wait_for_timeout(200)
        el = page.query_selector(".proto-stage")
        if el:
            el.screenshot(path=str(SHOTS / "proto_desktop_control_room.png"))
        page.evaluate("() => window.RG.applyState({name:'reset'})")
        page.set_viewport_size({"width": 1440, "height": 1000})
        # the prototype page on a 390 px phone
        m = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        mp = m.new_page()
        mp.goto(url)
        mp.wait_for_timeout(200)
        overflow = mp.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
        if overflow > 1:
            err(f"prototype at 390 px wide scrolls sideways by {overflow} px")
        mp.screenshot(path=str(SHOTS / "proto_page_mobile_390.png"), full_page=True)
        m.close()
        page.screenshot(path=str(SHOTS / "proto_page_desktop.png"), full_page=True)
        for c in console_errors:
            err(f"console error: {c[:200]}")
        # draw.io: render with draw.io's own viewer and compare routed edges
        drawio_viewer_check(b, pages)
        b.close()


TOUCH_AUDIT_JS = r"""
() => {
  const out = [];
  const root = document.querySelector('#phone') || document.querySelector('.proto-stage');
  if (!root) return ['no prototype frame'];
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]'); };
  root.querySelectorAll('button, a[href], input, select, textarea, [role=button], [role=tab], [role=switch], label.chip').forEach(el => {
    if (!vis(el) || el.type === 'hidden') return;
    if (el.closest('[aria-hidden=true]')) return;
    const r = el.getBoundingClientRect();
    if (el.type === 'radio' || el.type === 'checkbox') return; // their <label> is the target
    if (r.height < 47.5 || r.width < 47.5) out.push(`touch target ${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || el.name || '').trim().slice(0, 30)}" is ${r.width.toFixed(0)}x${r.height.toFixed(0)} px`);
  });
  root.querySelectorAll('input, select, textarea').forEach(el => {
    if (!vis(el) || el.type === 'radio' || el.type === 'checkbox' || el.type === 'range') return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 16) out.push(`form field ${el.name || el.id} font-size ${fs}px < 16px`);
  });
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode; if (!t.textContent.trim()) continue;
    const el = t.parentElement; if (!el || seen.has(el) || !vis(el) || el.closest('svg')) continue; seen.add(el);
    const cs = getComputedStyle(el); const fs = parseFloat(cs.fontSize);
    const upper = cs.textTransform === 'uppercase';
    if (fs < 12 || (fs < 14 && !upper && !el.closest('.small-ok'))) out.push(`text "${t.textContent.trim().slice(0, 30)}" is ${fs}px`);
  }
  // nothing may stick out of the phone frame sideways
  const fr = root.getBoundingClientRect();
  root.querySelectorAll('*').forEach(el => { if (!vis(el) || el.closest('svg')) return; const r = el.getBoundingClientRect();
    if (r.right > fr.right + 1 || r.left < fr.left - 1) { if (!el.closest('.scroll-x')) out.push(`${el.tagName.toLowerCase()}.${el.className} sticks out of the frame`); } });
  return [...new Set(out)].slice(0, 40);
}
"""


def drawio_viewer_check(browser, pages: list[Page]) -> None:
    xml = DRAWIO.read_text()
    vp = browser.new_page(viewport={"width": 2000, "height": 1400})
    try:
        vp.set_content("<!doctype html><html><body style='margin:0;background:#fff'><div id='c'></div></body></html>")
        vp.add_script_tag(url=VIEWER_JS)
        vp.wait_for_function("() => typeof Graph !== 'undefined' && typeof mxCodec !== 'undefined'", timeout=30000)
    except Exception as e:  # noqa: BLE001
        err(f"draw.io viewer could not load from {VIEWER_JS}: {str(e)[:120]}")
        vp.close()
        return
    for i, pg in enumerate(pages):
        res = vp.evaluate(VIEWER_JS_RENDER, {"xml": xml, "index": i})
        if "error" in res:
            err(f"draw.io viewer, {pg.name}: {res['error']}")
            continue
        for eid, pts in res["edges"].items():
            e = next((x for x in pg.edges if x["id"] == eid), None)
            if not e:
                continue
            ours = edge_path(pg, e)
            theirs = [tuple(p) for p in pts]
            # draw.io drops collinear points; compare corner sets
            a, b = simplify(ours), simplify(theirs)
            if len(a) != len(b) or any(abs(p[0] - q[0]) > 1.5 or abs(p[1] - q[1]) > 1.5 for p, q in zip(a, b)):
                err(f"draw.io viewer, {pg.name}: edge {eid} is routed as {[fmt(p) for p in simplify(theirs)]}, "
                    f"we expected {[fmt(p) for p in simplify(ours)]}")
        vp.screenshot(path=str(SHOTS / f"drawio_{pg.name}.png"), full_page=True)
    vp.close()


def simplify(pts):
    r = [(round(p[0], 1), round(p[1], 1)) for p in pts]
    out = [r[0]]
    for p in r[1:]:
        if abs(p[0] - out[-1][0]) <= 1 and abs(p[1] - out[-1][1]) <= 1:
            continue
        out.append(p)
    i = 1
    while i < len(out) - 1:
        a, b, c = out[i - 1], out[i], out[i + 1]
        if (abs(a[0] - b[0]) <= 1 and abs(b[0] - c[0]) <= 1) or (abs(a[1] - b[1]) <= 1 and abs(b[1] - c[1]) <= 1):
            out.pop(i)
        else:
            i += 1
    return out


VIEWER_JS_RENDER = r"""
({xml, index}) => {
  try {
    const doc = mxUtils.parseXml(xml);
    const dg = doc.documentElement.getElementsByTagName('diagram')[index];
    const model = dg.getElementsByTagName('mxGraphModel')[0];
    const c = document.getElementById('c');
    c.innerHTML = '';
    c.style.width = (+model.getAttribute('pageWidth') + 40) + 'px';
    c.style.height = (+model.getAttribute('pageHeight') + 40) + 'px';
    const graph = new Graph(c);
    graph.setEnabled(false);
    const codec = new mxCodec(model.ownerDocument);
    codec.decode(model, graph.getModel());
    graph.view.setTranslate(20, 20);
    graph.refresh();
    const edges = {};
    const cells = graph.getModel().cells;
    for (const id in cells) {
      const cell = cells[id];
      if (!cell.edge) continue;
      const st = graph.view.getState(cell);
      if (!st || !st.absolutePoints) continue;
      edges[id] = st.absolutePoints.map(p => [p.x - 20, p.y - 20]);
    }
    return { edges };
  } catch (e) { return { error: String(e) }; }
}
"""


# =============================================================== main

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-browser", action="store_true")
    ap.add_argument("--only", choices=["drawio", "icons", "tokens", "figma", "browser"])
    args = ap.parse_args()

    need_browser = not args.no_browser and args.only in (None, "browser")
    if need_browser:
        try:
            import playwright  # noqa: F401
        except ImportError:
            venv = ROOT / ".venv-ux/bin/python"
            if venv.exists() and Path(sys.prefix).resolve() != (ROOT / ".venv-ux").resolve() and not os.environ.get("RG_REEXEC"):
                os.environ["RG_REEXEC"] = "1"
                os.execv(str(venv), [str(venv), *sys.argv])
            err("Playwright is not installed (see the docstring at the top of this file)")
            need_browser = False

    pages = check1_drawio() if args.only in (None, "drawio", "browser") else load_drawio()
    if args.only in (None, "icons"):
        check2_icons()
    if args.only in (None, "drawio", "browser"):
        check2_deliverables(pages)
    tok = check3_tokens() if args.only in (None, "tokens", "figma", "browser") else {}
    if args.only in (None, "figma"):
        check4_plugin(tok)
    if need_browser:
        browser_checks(pages)

    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    print(f"\n{len(errors)} errors, {len(warnings)} warnings")
    if need_browser:
        shots = sorted(SHOTS.glob("*.png"))
        print(f"{len(shots)} screenshots in {SHOTS} (look at them):")
        for s in shots:
            print(f"  {s}")
    return 0 if not errors and not warnings else 1


if __name__ == "__main__":
    raise SystemExit(main())
