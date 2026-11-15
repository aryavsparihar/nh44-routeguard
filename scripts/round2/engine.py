"""Tiny diagram engine: one set of coordinates -> draw.io XML and inline SVG.

Every node sits on a 10 px grid. Every edge is orthogonal: it leaves its
source through an explicit port (exitX/exitY), bends only at the waypoints we
give, and enters its target through an explicit port (entryX/entryY). The same
polyline is written to draw.io and drawn in the SVG, so the two always match.
"""

from __future__ import annotations

import html
import math
from dataclasses import dataclass, field

GRID = 10
FONT_NODE = 13
FONT_EDGE = 12
LINE_H_NODE = 17
LINE_H_EDGE = 15

INK = "#1E2D3A"
CANVAS = "#FDF8F0"
SURFACE = "#F5EDE0"
TEAL = "#2B5B54"
NAVY = "#28557A"
TERRA = "#A9481F"
OCHRE_INK = "#7A5A12"
MUTED = "#475569"
WHITE = "#FFFFFF"

# Approximate advance widths (in em) for Helvetica / Inter. Used to check that
# text fits its box; the browser check in verify_round2_all.py measures the real thing.
_NARROW = set("ijlI.,:;'|!()[] ")
_WIDE = set("mwMWOQGD@%&")


def text_width(s: str, size: float, bold: bool = False) -> float:
    w = 0.0
    for ch in s:
        if ch in _NARROW:
            w += 0.30
        elif ch in _WIDE:
            w += 0.86
        elif ch.isupper():
            w += 0.68
        elif ch.isdigit():
            w += 0.58
        else:
            w += 0.56
    return w * size * (1.07 if bold else 1.0)


@dataclass
class Node:
    id: str
    kind: str  # entity process store screen modal shell state start end action decision io lane pool note
    x: int
    y: int
    w: int
    h: int
    title: str = ""  # bold first line
    lines: tuple[str, ...] = ()
    parent: str | None = None
    planned: bool = False
    fill: str | None = None

    @property
    def text_lines(self) -> list[tuple[str, bool]]:
        out = [(self.title, True)] if self.title else []
        return out + [(ln, False) for ln in self.lines]


@dataclass
class Edge:
    id: str
    src: str
    tgt: str
    label: str = ""  # use "\n" for a second line
    exit: tuple[str, int] = ("R", 0)  # side (L/R/T/B) and offset in px from the side's centre
    entry: tuple[str, int] = ("L", 0)
    via: int | None = None  # x of the middle segment (L/R -> L/R) or y (T/B -> T/B)
    pts: tuple[tuple[int, int], ...] | None = None  # explicit corner points
    lab_seg: int = -1  # which segment holds the label (index into segments)
    lab_t: float = 0.5  # where along that segment (0..1)
    lab_c: float | None = None  # or: absolute x (horizontal segment) / y (vertical) of the label centre
    planned: bool = False
    kind: str = "flow"  # flow, tree, step, link


@dataclass
class Diagram:
    name: str  # draw.io page name
    key: str  # short key for HTML
    width: int
    height: int
    nodes: list[Node] = field(default_factory=list)
    edges: list[Edge] = field(default_factory=list)
    dfd: bool = False

    def node(self, nid: str) -> Node:
        for n in self.nodes:
            if n.id == nid:
                return n
        raise KeyError(nid)

    def abs_xy(self, n: Node) -> tuple[int, int]:
        x, y = n.x, n.y
        p = n.parent
        while p:
            pn = self.node(p)
            x += pn.x
            y += pn.y
            p = pn.parent
        return x, y


# ---------------------------------------------------------------- geometry

SHAPE = {
    "process": "ellipse", "start": "ellipse", "end": "ellipse",
    "decision": "rhombus", "io": "parallelogram",
}
IO_SLANT = 20  # px, draw.io parallelogram size with fixedSize=1


def port(d: Diagram, n: Node, side: str, off: int) -> tuple[float, float, float, float]:
    """Absolute (x, y) of a port plus draw.io's relative (fx, fy)."""
    X, Y = d.abs_xy(n)
    w, h = n.w, n.h
    cx, cy = X + w / 2, Y + h / 2
    shape = SHAPE.get(n.kind, "rect")
    if shape == "ellipse":
        rx, ry = w / 2, h / 2
        if side in "LR":
            if abs(off) > 0.62 * ry:
                raise ValueError(f"{n.id}: port offset {off} too far from centre for an ellipse side")
            dx = rx * math.sqrt(1 - (off / ry) ** 2)
            x, y = (cx + dx if side == "R" else cx - dx), cy + off
        else:
            if abs(off) > 0.62 * rx:
                raise ValueError(f"{n.id}: port offset {off} too far from centre for an ellipse side")
            dy = ry * math.sqrt(1 - (off / rx) ** 2)
            x, y = cx + off, (cy - dy if side == "T" else cy + dy)
    elif shape == "rhombus":
        if off:
            raise ValueError(f"{n.id}: rhombus ports must be at the corners (offset 0)")
        x, y = {"L": (X, cy), "R": (X + w, cy), "T": (cx, Y), "B": (cx, Y + h)}[side]
    elif shape == "parallelogram":
        if side in "LR":
            if off:
                raise ValueError(f"{n.id}: parallelogram side ports must be centred")
            # draw.io projects the centre->port ray onto the outline. A port placed exactly on the
            # slanted side makes that ray end on the outline and draw.io falls back to the centre,
            # so the relative port sits on the bounding box and the projection lands mid-slant.
            x = X + IO_SLANT / 2 if side == "L" else X + w - IO_SLANT / 2
            return x, cy, (0.0 if side == "L" else 1.0), 0.5
        else:
            x, y = cx + off, (Y if side == "T" else Y + h)
    else:
        x, y = {"L": (X, cy + off), "R": (X + w, cy + off), "T": (cx + off, Y), "B": (cx + off, Y + h)}[side]
    return x, y, (x - X) / w, (y - Y) / h


def polyline(d: Diagram, e: Edge) -> list[tuple[float, float]]:
    s, t = d.node(e.src), d.node(e.tgt)
    x0, y0, _, _ = port(d, s, *e.exit)
    x1, y1, _, _ = port(d, t, *e.entry)
    return [(x0, y0), *waypoints(d, e), (x1, y1)]


def waypoints(d: Diagram, e: Edge) -> list[tuple[float, float]]:
    if e.pts is not None:
        return [tuple(p) for p in e.pts]
    s, t = d.node(e.src), d.node(e.tgt)
    x0, y0, _, _ = port(d, s, *e.exit)
    x1, y1, _, _ = port(d, t, *e.entry)
    hs, ht = e.exit[0] in "LR", e.entry[0] in "LR"
    if hs and ht:
        if abs(y0 - y1) < 0.01:
            return []
        via = e.via if e.via is not None else round((x0 + x1) / 20) * 10
        return [(via, y0), (via, y1)]
    if not hs and not ht:
        if abs(x0 - x1) < 0.01:
            return []
        via = e.via if e.via is not None else round((y0 + y1) / 20) * 10
        return [(x0, via), (x1, via)]
    if hs and not ht:
        return [(x1, y0)]
    return [(x0, y1)]


def seg_len(a, b) -> float:
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def label_point(pl: list[tuple[float, float]], e: Edge) -> tuple[float, float, float]:
    """Centre of the label plus draw.io's relative geometry x (-1..1)."""
    segs = list(zip(pl, pl[1:]))
    i = e.lab_seg if e.lab_seg >= 0 else len(segs) + e.lab_seg
    total = sum(seg_len(a, b) for a, b in segs)
    before = sum(seg_len(a, b) for a, b in segs[:i])
    a, b = segs[i]
    t = e.lab_t
    if e.lab_c is not None:
        axis = 0 if abs(a[1] - b[1]) < 0.01 else 1
        t = (e.lab_c - a[axis]) / (b[axis] - a[axis])
        if not 0 < t < 1:
            raise ValueError(f"{e.id}: lab_c {e.lab_c} is not on segment {i}")
    dist = before + seg_len(a, b) * t
    gx = 2 * dist / total - 1
    lx = a[0] + (b[0] - a[0]) * t
    ly = a[1] + (b[1] - a[1]) * t
    return lx, ly, gx


def label_box(e: Edge, lx: float, ly: float) -> tuple[float, float, float, float]:
    lines = e.label.split("\n")
    w = max(text_width(ln, FONT_EDGE) for ln in lines) + 10
    h = LINE_H_EDGE * len(lines) + 4
    return lx - w / 2, ly - h / 2, w, h


# ---------------------------------------------------------------- draw.io

def _style(n: Node) -> str:
    base = f"html=1;whiteSpace=wrap;fontFamily=Helvetica;fontSize={FONT_NODE};fontColor={INK};"
    k = n.kind
    if k == "entity":
        s = f"rounded=0;fillColor={WHITE};strokeColor={INK};strokeWidth=2;"
    elif k == "process":
        s = f"ellipse;fillColor={SURFACE};strokeColor={TEAL};strokeWidth=2;"
    elif k == "store":
        s = (f"shape=partialRectangle;top=1;bottom=1;left=1;right=0;fillColor={CANVAS};"
             f"strokeColor={NAVY};strokeWidth=2;align=left;spacingLeft=12;")
    elif k == "shell":
        s = f"rounded=1;arcSize=12;fillColor={INK};strokeColor={INK};fontColor={WHITE};strokeWidth=2;"
        base = base.replace(f"fontColor={INK};", "")
    elif k == "screen":
        s = f"rounded=1;arcSize=10;fillColor={WHITE};strokeColor={TEAL};strokeWidth=2;"
    elif k == "modal":
        s = f"rounded=1;arcSize=10;fillColor={SURFACE};strokeColor={NAVY};strokeWidth=1.5;dashed=1;dashPattern=6 4;"
    elif k == "state":
        s = f"rounded=1;arcSize=50;fillColor={n.fill or SURFACE};strokeColor={MUTED};strokeWidth=1;fontSize=12;"
    elif k in ("start", "end"):
        s = f"ellipse;fillColor={TEAL if k == 'start' else INK};strokeColor={INK};fontColor={WHITE};strokeWidth=2;"
        base = base.replace(f"fontColor={INK};", "")
    elif k == "action":
        s = f"rounded=1;arcSize=14;fillColor={n.fill or WHITE};strokeColor={INK};strokeWidth=1.5;"
    elif k == "decision":
        s = f"rhombus;fillColor=#FEF3C7;strokeColor={OCHRE_INK};strokeWidth=1.5;"
    elif k == "io":
        s = f"shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;size={IO_SLANT};fillColor=#DBEAFE;strokeColor={NAVY};strokeWidth=1.5;"
    elif k == "pool":
        s = (f"swimlane;horizontal=0;startSize=40;fillColor={SURFACE};strokeColor={INK};strokeWidth=2;"
             f"fontStyle=1;fontSize=14;container=1;collapsible=0;")
    elif k == "lane":
        s = (f"swimlane;horizontal=0;startSize=30;fillColor={n.fill or CANVAS};swimlaneFillColor={n.fill or CANVAS};"
             f"strokeColor={MUTED};strokeWidth=1;fontStyle=1;fontSize=12;container=1;collapsible=0;")
    elif k == "note":
        s = f"text;align=left;verticalAlign=top;fontColor={MUTED};fontSize=12;"
    else:
        raise ValueError(k)
    if n.planned and k not in ("pool", "lane"):
        s += "dashed=1;dashPattern=6 4;"
    return s + base


def _value(n: Node) -> str:
    parts = []
    if n.title:
        parts.append(f"<b>{html.escape(n.title)}</b>")
    parts += [html.escape(ln) for ln in n.lines]
    return "<br>".join(parts)


SIDE_NAME = {"L": "west", "R": "east", "T": "north", "B": "south"}


def _edge_style(d: Diagram, e: Edge) -> str:
    s, t = d.node(e.src), d.node(e.tgt)
    _, _, fx0, fy0 = port(d, s, *e.exit)
    _, _, fx1, fy1 = port(d, t, *e.entry)
    color = INK if e.kind in ("flow", "step") else MUTED
    arrow = "endArrow=block;endFill=1;" if e.kind != "link" else "endArrow=none;"
    st = (f"edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;{arrow}"
          f"strokeColor={color};strokeWidth={1.5 if e.kind != 'link' else 1};fontFamily=Helvetica;"
          f"fontSize={FONT_EDGE};fontColor={INK};labelBackgroundColor={CANVAS};"
          f"exitX={fx0:.4f};exitY={fy0:.4f};exitDx=0;exitDy=0;exitPerimeter=1;"
          f"entryX={fx1:.4f};entryY={fy1:.4f};entryDx=0;entryDy=0;entryPerimeter=1;"
          f"sourcePortConstraint={SIDE_NAME[e.exit[0]]};targetPortConstraint={SIDE_NAME[e.entry[0]]};")
    if e.planned or e.kind == "link":
        st += "dashed=1;dashPattern=6 4;"
    return st


def to_drawio_page(d: Diagram, page_id: str) -> str:
    out = [f'<diagram id="{page_id}" name="{html.escape(d.name)}">',
           f'<mxGraphModel dx="{d.width}" dy="{d.height}" grid="1" gridSize="{GRID}" guides="1" tooltips="1" '
           f'connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="{d.width}" pageHeight="{d.height}" '
           f'background="{CANVAS}" math="0" shadow="0">',
           "<root>", f'<mxCell id="{page_id}-0"/>', f'<mxCell id="{page_id}-1" parent="{page_id}-0"/>']
    for n in d.nodes:
        parent = f"{d.key}_{n.parent}" if n.parent else f"{page_id}-1"
        out.append(f'<mxCell id="{d.key}_{n.id}" value="{html.escape(_value(n))}" style="{_style(n)}" vertex="1" parent="{parent}">'
                   f'<mxGeometry x="{n.x}" y="{n.y}" width="{n.w}" height="{n.h}" as="geometry"/></mxCell>')
    for e in d.edges:
        pl = polyline(d, e)
        wp = waypoints(d, e)
        _, _, gx = label_point(pl, e) if e.label else (0, 0, 0)
        val = "<br>".join(html.escape(x) for x in e.label.split("\n")) if e.label else ""
        pts = "".join(f'<mxPoint x="{_n(x)}" y="{_n(y)}"/>' for x, y in wp)
        arr = f'<Array as="points">{pts}</Array>' if wp else ""
        out.append(f'<mxCell id="{d.key}_{e.id}" value="{html.escape(val)}" style="{_edge_style(d, e)}" edge="1" '
                   f'parent="{page_id}-1" source="{d.key}_{e.src}" target="{d.key}_{e.tgt}">'
                   f'<mxGeometry x="{gx:.4f}" relative="1" as="geometry">{arr}</mxGeometry></mxCell>')
    out += ["</root>", "</mxGraphModel>", "</diagram>"]
    return "\n".join(out)


def _n(v: float) -> str:
    return str(int(round(v))) if abs(v - round(v)) < 1e-6 else f"{v:.2f}"


def to_drawio(diagrams: list[Diagram]) -> str:
    pages = "\n".join(to_drawio_page(d, f"p{i + 1}") for i, d in enumerate(diagrams))
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<mxfile host="app.diagrams.net" agent="scripts/round2/build.py" version="24.7.17" type="device">\n'
            f"{pages}\n</mxfile>\n")


# ---------------------------------------------------------------- SVG

def to_svg(d: Diagram) -> str:
    o = [f'<svg class="dg" data-diagram="{d.key}" viewBox="0 0 {d.width} {d.height}" width="{d.width}" '
         f'height="{d.height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="{html.escape(d.name)}">',
         f'<defs><marker id="ah-{d.key}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" '
         f'orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="{INK}"/></marker></defs>',
         f'<rect width="{d.width}" height="{d.height}" fill="{CANVAS}"/>']
    # containers first, then edges, then leaf nodes, then edge labels on top
    containers = [n for n in d.nodes if n.kind in ("pool", "lane")]
    leaves = [n for n in d.nodes if n.kind not in ("pool", "lane")]
    for n in containers:
        o.append(_svg_node(d, n))
    for e in d.edges:
        pl = polyline(d, e)
        pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in pl)
        dash = ' stroke-dasharray="6 4"' if (e.planned or e.kind == "link") else ""
        mk = "" if e.kind == "link" else f' marker-end="url(#ah-{d.key})"'
        col = INK if e.kind in ("flow", "step") else MUTED
        o.append(f'<polyline class="edge" data-id="{d.key}_{e.id}" data-src="{d.key}_{e.src}" data-tgt="{d.key}_{e.tgt}" points="{pts}" '
                 f'fill="none" stroke="{col}" stroke-width="1.6"{dash}{mk}/>')
    for n in leaves:
        o.append(_svg_node(d, n))
    for e in d.edges:
        if not e.label:
            continue
        pl = polyline(d, e)
        lx, ly, _ = label_point(pl, e)
        bx, by, bw, bh = label_box(e, lx, ly)
        lines = e.label.split("\n")
        o.append(f'<g class="elabel" data-id="{d.key}_{e.id}"><rect class="pill" x="{bx:.1f}" y="{by:.1f}" width="{bw:.1f}" '
                 f'height="{bh:.1f}" rx="4" fill="{CANVAS}" stroke="{"#D8CFC2"}" stroke-width="1"/>')
        y0 = ly - (len(lines) - 1) * LINE_H_EDGE / 2
        for i, ln in enumerate(lines):
            o.append(f'<text x="{lx:.1f}" y="{y0 + i * LINE_H_EDGE:.1f}" font-size="{FONT_EDGE}" text-anchor="middle" '
                     f'dominant-baseline="central" fill="{INK}">{html.escape(ln)}</text>')
        o.append("</g>")
    o.append("</svg>")
    return "\n".join(o)


def _svg_node(d: Diagram, n: Node) -> str:
    X, Y = d.abs_xy(n)
    w, h = n.w, n.h
    k = n.kind
    dash = ' stroke-dasharray="6 4"' if n.planned or k == "modal" else ""
    o = [f'<g class="node" data-id="{d.key}_{n.id}" data-kind="{k}" data-x="{X}" data-y="{Y}" data-w="{w}" data-h="{h}">']
    tc = INK
    if k == "entity":
        o.append(f'<rect x="{X}" y="{Y}" width="{w}" height="{h}" fill="{WHITE}" stroke="{INK}" stroke-width="2"{dash}/>')
    elif k == "process":
        o.append(f'<ellipse cx="{X + w / 2}" cy="{Y + h / 2}" rx="{w / 2}" ry="{h / 2}" fill="{SURFACE}" stroke="{TEAL}" stroke-width="2"{dash}/>')
    elif k == "store":
        o.append(f'<rect x="{X}" y="{Y}" width="{w}" height="{h}" fill="{CANVAS}" stroke="none"/>')
        o.append(f'<path d="M{X + w} {Y}H{X}V{Y + h}H{X + w}" fill="none" stroke="{NAVY}" stroke-width="2"{dash}/>')
    elif k == "shell":
        o.append(f'<rect x="{X}" y="{Y}" width="{w}" height="{h}" rx="8" fill="{INK}"/>')
        tc = WHITE
    elif k == "screen":
        o.append(f'<rect x="{X}" y="{Y}" width="{w}" height="{h}" rx="8" fill="{WHITE}" stroke="{TEAL}" stroke-width="2"{dash}/>')
    elif k == "modal":
        o.append(f'<rect x="{X}" y="{Y}" width="{w}" height="{h}" rx="8" fill="{SURFACE}" stroke="{NAVY}" stroke-width="1.5"{dash}/>')
    elif k == "state":
        o.append(f'<rect x="{X}" y="{Y}" width="{w}" height="{h}" rx="{h / 2}" fill="{n.fill or SURFACE}" stroke="{MUTED}" stroke-width="1"/>')
    elif k in ("start", "end"):
        o.append(f'<ellipse cx="{X + w / 2}" cy="{Y + h / 2}" rx="{w / 2}" ry="{h / 2}" fill="{TEAL if k == "start" else INK}"/>')
        tc = WHITE
    elif k == "action":
        o.append(f'<rect x="{X}" y="{Y}" width="{w}" height="{h}" rx="8" fill="{n.fill or WHITE}" stroke="{INK}" stroke-width="1.5"{dash}/>')
    elif k == "decision":
        o.append(f'<path d="M{X + w / 2} {Y}L{X + w} {Y + h / 2}L{X + w / 2} {Y + h}L{X} {Y + h / 2}Z" fill="#FEF3C7" stroke="{OCHRE_INK}" stroke-width="1.5"/>')
    elif k == "io":
        s = IO_SLANT
        o.append(f'<path d="M{X} {Y + h}L{X + s} {Y}H{X + w}L{X + w - s} {Y + h}Z" fill="#DBEAFE" stroke="{NAVY}" stroke-width="1.5"/>')
    elif k == "pool":
        o.append(f'<rect x="{X}" y="{Y}" width="{w}" height="{h}" fill="{SURFACE}" stroke="{INK}" stroke-width="2"/>')
        o.append(f'<line x1="{X + 40}" y1="{Y}" x2="{X + 40}" y2="{Y + h}" stroke="{INK}" stroke-width="2"/>')
        o.append(f'<text x="{X + 20}" y="{Y + h / 2}" font-size="14" font-weight="700" text-anchor="middle" '
                 f'dominant-baseline="central" fill="{INK}" transform="rotate(-90 {X + 20} {Y + h / 2})">{html.escape(n.title)}</text></g>')
        return "".join(o)
    elif k == "lane":
        o.append(f'<rect x="{X}" y="{Y}" width="{w}" height="{h}" fill="{n.fill or CANVAS}" stroke="{MUTED}" stroke-width="1"/>')
        o.append(f'<line x1="{X + 30}" y1="{Y}" x2="{X + 30}" y2="{Y + h}" stroke="{MUTED}" stroke-width="1"/>')
        o.append(f'<text x="{X + 15}" y="{Y + h / 2}" font-size="12" font-weight="700" text-anchor="middle" '
                 f'dominant-baseline="central" fill="{INK}" transform="rotate(-90 {X + 15} {Y + h / 2})">{html.escape(n.title)}</text></g>')
        return "".join(o)
    elif k == "note":
        tc = MUTED
    lines = n.text_lines
    size = 12 if k in ("state", "note") else FONT_NODE
    lh = 15 if k in ("state", "note") else LINE_H_NODE
    if k == "store":
        tx, anchor = X + 12, "start"
    elif k == "note":
        tx, anchor = X, "start"
    else:
        tx, anchor = X + w / 2, "middle"
    y0 = Y + h / 2 - (len(lines) - 1) * lh / 2
    if k == "note":
        y0 = Y + lh / 2
    for i, (ln, bold) in enumerate(lines):
        fw = ' font-weight="700"' if bold else ""
        o.append(f'<text class="nt" x="{tx}" y="{y0 + i * lh:.1f}" font-size="{size}"{fw} text-anchor="{anchor}" '
                 f'dominant-baseline="central" fill="{tc}">{html.escape(ln)}</text>')
    o.append("</g>")
    return "".join(o)


def inner_width(n: Node, y_off: float) -> float:
    """Usable text width of a node at a vertical offset from its centre."""
    k = n.kind
    if SHAPE.get(k) == "ellipse":
        ry = n.h / 2
        f = max(0.0, 1 - ((abs(y_off) + 8) / ry) ** 2)
        return n.w * math.sqrt(f) - 16
    if k == "decision":
        return n.w * (1 - (abs(y_off) + 8) / (n.h / 2)) - 12
    if k == "io":
        return n.w - 2 * IO_SLANT - 8
    if k == "store":
        return n.w - 24
    if k == "note":
        return n.w
    return n.w - 16
