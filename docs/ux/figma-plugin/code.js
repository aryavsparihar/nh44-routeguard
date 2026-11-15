// RouteGuard Round 2: builds our Figma design file from the same tokens as the style guide and prototype.
// Run it once in an empty Figma design file (Plugins > Development > Import plugin from manifest).
// It creates 4 pages:
//   01_Style_Guide_&_Variables              variable collection, text styles, swatches with WCAG ratios, icons
//   02_Components_&_Variants                5 component sets with variants and auto-layout
//   03_Low_Fi_Wireframes                    16 grey-box frames, 390 x 844
//   04_High_Fi_Prototype_Mobile_&_Desktop   mobile frames 390 x 844, desktop 1440 x 900, click links
// The DATA block is written by scripts/round2/build.py from docs/ux/data and docs/ux/assets/icons.

/* BUILD:data */
const DATA = {
 "tokens": {
  "color": {
   "bg.canvas": "#F1F2EE",
   "bg.surface": "#E4E7E0",
   "bg.elevated": "#FFFFFF",
   "bg.map": "#DCE1D5",
   "text.primary": "#15191C",
   "text.secondary": "#4A5250",
   "text.inverse": "#FFFFFF",
   "border.default": "#C8CDC5",
   "border.strong": "#737B75",
   "brand.apple": "#C42A30",
   "brand.apple.ink": "#A3212A",
   "brand.highway": "#005F3F",
   "brand.milestone": "#F2B705",
   "brand.milestone.ink": "#6B4F00",
   "brand.rail": "#1D4B8A",
   "send.fill": "#005F3F",
   "send.bg": "#DCEEE3",
   "send.text": "#08432F",
   "hold.fill": "#A87A00",
   "hold.bg": "#FCEEBF",
   "hold.text": "#4F3A00",
   "rail.fill": "#1D4B8A",
   "rail.bg": "#DEE6F3",
   "rail.text": "#163A69",
   "divert.fill": "#C65316",
   "divert.bg": "#FBE3D2",
   "divert.text": "#6E2A05",
   "high.fill": "#B0202B",
   "high.bg": "#F8DEDC",
   "high.text": "#74131B",
   "risk.low.map": "#1F6E50",
   "risk.medium.map": "#8F6A00",
   "risk.high.map": "#B0202B"
  },
  "space": {
   "1": 4,
   "2": 8,
   "3": 12,
   "4": 16,
   "6": 24,
   "8": 32,
   "12": 48
  },
  "radius": {
   "sm": 2,
   "md": 6,
   "lg": 10,
   "pill": 999
  },
  "touch_min_px": 48,
  "type": {
   "display": {
    "family": "Barlow Semi Condensed",
    "fallback": "'Arial Narrow', sans-serif",
    "size": 32,
    "line": 36,
    "weight": 700
   },
   "h1": {
    "family": "Barlow Semi Condensed",
    "fallback": "'Arial Narrow', sans-serif",
    "size": 24,
    "line": 30,
    "weight": 700
   },
   "h2": {
    "family": "Barlow Semi Condensed",
    "fallback": "'Arial Narrow', sans-serif",
    "size": 20,
    "line": 24,
    "weight": 600
   },
   "body": {
    "family": "Atkinson Hyperlegible",
    "fallback": "Verdana, sans-serif",
    "size": 15,
    "line": 22,
    "weight": 400
   },
   "input": {
    "family": "Atkinson Hyperlegible",
    "fallback": "Verdana, sans-serif",
    "size": 16,
    "line": 24,
    "weight": 400
   },
   "label": {
    "family": "Barlow Semi Condensed",
    "fallback": "'Arial Narrow', sans-serif",
    "size": 13,
    "line": 16,
    "weight": 600,
    "upper": true,
    "tracking": 0.05
   },
   "data": {
    "family": "Atkinson Hyperlegible Mono",
    "fallback": "ui-monospace, Menlo, monospace",
    "size": 14,
    "line": 20,
    "weight": 500
   },
   "decision": {
    "family": "Barlow Semi Condensed",
    "fallback": "'Arial Narrow', sans-serif",
    "size": 28,
    "line": 30,
    "weight": 700,
    "upper": true,
    "tracking": 0.03
   }
  },
  "contrast_pairs": [
   {
    "fg": "text.primary",
    "bg": "bg.canvas",
    "use": "body text",
    "min": 4.5
   },
   {
    "fg": "text.primary",
    "bg": "bg.surface",
    "use": "body text on cards",
    "min": 4.5
   },
   {
    "fg": "text.primary",
    "bg": "bg.map",
    "use": "map labels",
    "min": 4.5
   },
   {
    "fg": "text.secondary",
    "bg": "bg.canvas",
    "use": "secondary text",
    "min": 4.5
   },
   {
    "fg": "text.secondary",
    "bg": "bg.surface",
    "use": "secondary text on cards",
    "min": 4.5
   },
   {
    "fg": "text.secondary",
    "bg": "bg.elevated",
    "use": "secondary text on sheets",
    "min": 4.5
   },
   {
    "fg": "brand.apple.ink",
    "bg": "bg.canvas",
    "use": "links and accent text",
    "min": 4.5
   },
   {
    "fg": "brand.apple.ink",
    "bg": "bg.surface",
    "use": "accent text on cards",
    "min": 4.5
   },
   {
    "fg": "brand.milestone.ink",
    "bg": "bg.canvas",
    "use": "warning text (milestone ink)",
    "min": 4.5
   },
   {
    "fg": "text.primary",
    "bg": "brand.milestone",
    "use": "milestone tag (black on NH yellow)",
    "min": 7.0
   },
   {
    "fg": "text.inverse",
    "bg": "brand.highway",
    "use": "primary button label",
    "min": 7.0
   },
   {
    "fg": "text.inverse",
    "bg": "brand.rail",
    "use": "secondary button label",
    "min": 4.5
   },
   {
    "fg": "text.inverse",
    "bg": "text.primary",
    "use": "offline banner",
    "min": 7.0
   },
   {
    "fg": "text.inverse",
    "bg": "brand.apple.ink",
    "use": "report button label",
    "min": 4.5
   },
   {
    "fg": "text.inverse",
    "bg": "high.fill",
    "use": "closure banner label",
    "min": 4.5
   },
   {
    "fg": "send.text",
    "bg": "send.bg",
    "use": "SEND decision badge",
    "min": 7.0,
    "decision": true
   },
   {
    "fg": "hold.text",
    "bg": "hold.bg",
    "use": "HOLD decision badge",
    "min": 7.0,
    "decision": true
   },
   {
    "fg": "rail.text",
    "bg": "rail.bg",
    "use": "RAIL decision badge",
    "min": 7.0,
    "decision": true
   },
   {
    "fg": "divert.text",
    "bg": "divert.bg",
    "use": "DIVERT decision badge",
    "min": 7.0,
    "decision": true
   },
   {
    "fg": "high.text",
    "bg": "high.bg",
    "use": "HIGH risk badge",
    "min": 7.0,
    "decision": true
   },
   {
    "fg": "text.primary",
    "bg": "send.bg",
    "use": "body text in SEND card",
    "min": 4.5
   },
   {
    "fg": "text.primary",
    "bg": "hold.bg",
    "use": "body text in HOLD card",
    "min": 4.5
   },
   {
    "fg": "text.primary",
    "bg": "rail.bg",
    "use": "body text in RAIL card",
    "min": 4.5
   },
   {
    "fg": "text.primary",
    "bg": "divert.bg",
    "use": "body text in DIVERT card",
    "min": 4.5
   },
   {
    "fg": "text.primary",
    "bg": "high.bg",
    "use": "body text in HIGH card",
    "min": 4.5
   },
   {
    "fg": "risk.low.map",
    "bg": "bg.map",
    "use": "low-risk hexagon fill (graphic)",
    "min": 3.0
   },
   {
    "fg": "risk.medium.map",
    "bg": "bg.map",
    "use": "medium-risk hexagon fill (graphic)",
    "min": 3.0
   },
   {
    "fg": "risk.high.map",
    "bg": "bg.map",
    "use": "high-risk hexagon fill (graphic)",
    "min": 3.0
   },
   {
    "fg": "border.strong",
    "bg": "bg.elevated",
    "use": "form field border (graphic)",
    "min": 3.0
   },
   {
    "fg": "send.fill",
    "bg": "bg.elevated",
    "use": "decision stripe (graphic)",
    "min": 3.0
   },
   {
    "fg": "hold.fill",
    "bg": "bg.elevated",
    "use": "decision stripe (graphic)",
    "min": 3.0
   },
   {
    "fg": "rail.fill",
    "bg": "bg.elevated",
    "use": "decision stripe (graphic)",
    "min": 3.0
   },
   {
    "fg": "divert.fill",
    "bg": "bg.elevated",
    "use": "decision stripe (graphic)",
    "min": 3.0
   }
  ]
 },
 "icons": {
  "decision-divert": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" role=\"img\" aria-labelledby=\"t\"><path d=\"M8 21V3\"/><path d=\"m5 6 3-3 3 3\"/><path d=\"M8 15a4 4 0 0 1 4-4h8\"/><path d=\"m17 8 3 3-3 3\"/></svg>",
  "decision-hold": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" role=\"img\" aria-labelledby=\"t\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/></svg>",
  "decision-rail": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" role=\"img\" aria-labelledby=\"t\"><rect x=\"5\" y=\"3\" width=\"14\" height=\"14\" rx=\"3\"/><path d=\"M5 10h14\"/><path d=\"M9 13.5h.01M15 13.5h.01\"/><path d=\"m8 21 2-4M16 21l-2-4\"/></svg>",
  "decision-send": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" role=\"img\" aria-labelledby=\"t\"><path d=\"M3 12h15\"/><path d=\"m13 6 6 6-6 6\"/><path d=\"M3 7h4M3 17h4\"/></svg>",
  "hazard-flash-flood": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" role=\"img\" aria-labelledby=\"t\"><path d=\"M8 3v3M12 2v4M16 3v3\"/><path d=\"M2 13c1.5 0 2.5-1 4-1s2.5 1 4 1 2.5-1 4-1 2.5 1 4 1 2.5-1 4-1\"/><path d=\"M2 18c1.5 0 2.5-1 4-1s2.5 1 4 1 2.5-1 4-1 2.5 1 4 1 2.5-1 4-1\"/></svg>",
  "hazard-landslide": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" role=\"img\" aria-labelledby=\"t\"><path d=\"M2 20h20\"/><path d=\"M4 20 9 7l3 5\"/><path d=\"M12 12c1.5 2.2 3.6 3.6 6.5 4.2\"/><circle cx=\"17.5\" cy=\"18.5\" r=\"1.5\"/><circle cx=\"13.5\" cy=\"17.5\" r=\"1\"/></svg>",
  "hazard-rockfall": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" role=\"img\" aria-labelledby=\"t\"><path d=\"M3 21V3h4l1 5-2 4 2 4v5\"/><path d=\"M3 21h18\"/><path d=\"m14 4 3-1 2 2-1 3h-3z\"/><path d=\"m14 15 3-1 3 2-1 3h-3z\"/><path d=\"M11 9h-1M12 12h-1\"/></svg>",
  "hazard-snow-ice": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" role=\"img\" aria-labelledby=\"t\"><path d=\"M12 3v14\"/><path d=\"m5.9 6.5 12.2 7\"/><path d=\"m5.9 13.5 12.2-7\"/><path d=\"m10 4.5 2 1.5 2-1.5\"/><path d=\"m10 15.5 2-1.5 2 1.5\"/><path d=\"M3 21h18\"/></svg>",
  "nav-advisor": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" role=\"img\" aria-labelledby=\"t\"><path d=\"M3 6h10v10H3z\"/><path d=\"M13 10h4l3 3v3h-7\"/><circle cx=\"7\" cy=\"18\" r=\"2\"/><circle cx=\"17\" cy=\"18\" r=\"2\"/></svg>",
  "nav-alerts": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" role=\"img\" aria-labelledby=\"t\"><path d=\"M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z\"/><path d=\"M10 21h4\"/></svg>",
  "nav-board": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" role=\"img\" aria-labelledby=\"t\"><rect x=\"5\" y=\"4\" width=\"14\" height=\"17\" rx=\"2\"/><path d=\"M9 4V3h6v1\"/><path d=\"M9 10h6M9 14h6M9 18h3\"/></svg>",
  "nav-map": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" role=\"img\" aria-labelledby=\"t\"><path d=\"M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z\"/><path d=\"M9 4v14M15 6v14\"/></svg>",
  "nav-report": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" role=\"img\" aria-labelledby=\"t\"><path d=\"M12 3 2 20h20z\"/><path d=\"M12 10v4M12 17h.01\"/></svg>",
  "nav-strip": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" role=\"img\" aria-labelledby=\"t\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"M7.5 5v14M12 5v14M16.5 5v14\"/></svg>",
  "status-offline-queue": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" role=\"img\" aria-labelledby=\"t\"><path d=\"M3 20v-3M7 20v-6M11 20v-9\"/><path d=\"M3 4l12 12\"/><rect x=\"15\" y=\"14\" width=\"6\" height=\"7\" rx=\"1\"/><path d=\"M16 11h4\"/></svg>"
 },
 "replay": [
  [
   1,
   0,
   "low",
   0.079,
   "low",
   "Landslide: 66 mm rain in 72 h near Nagrota; zone 1 has low exposure to landslides"
  ],
  [
   2,
   0,
   "medium",
   0.34,
   "medium",
   "Landslide: 50 mm rain in 72 h near Chenani; zone 2 is exposed to landslides"
  ],
  [
   3,
   0,
   "high",
   0.71,
   "medium",
   "Landslide: 65 mm rain in 72 h near Nashri; zone 3 is very exposed to landslides"
  ],
  [
   4,
   0,
   "high",
   0.657,
   "medium",
   "Rockfall: 36 mm rain in 48 h near Digdol; zone 4 is very exposed to rockfall"
  ],
  [
   5,
   0,
   "high",
   0.7,
   "medium",
   "Rockfall: 54 mm rain in 48 h near Navyug tunnel (Banihal side); zone 5 is exposed to rockfall"
  ],
  [
   6,
   0,
   "low",
   0.073,
   "low",
   "Rockfall: 39 mm rain in 48 h near Srinagar; zone 6 has low exposure to rockfall"
  ],
  [
   1,
   12,
   "low",
   0.086,
   "low",
   "Landslide: 70 mm rain in 72 h near Nagrota; zone 1 has low exposure to landslides"
  ],
  [
   2,
   12,
   "medium",
   0.396,
   "medium",
   "Landslide: 56 mm rain in 72 h near Chenani; zone 2 is exposed to landslides"
  ],
  [
   3,
   12,
   "high",
   0.823,
   "medium",
   "Landslide: 74 mm rain in 72 h near Nashri; zone 3 is very exposed to landslides"
  ],
  [
   4,
   12,
   "high",
   0.703,
   "medium",
   "Rockfall: 38 mm rain in 48 h near Ramban; zone 4 is very exposed to rockfall"
  ],
  [
   5,
   12,
   "high",
   0.7,
   "medium",
   "Rockfall: 54 mm rain in 48 h near Qazigund; zone 5 is exposed to rockfall"
  ],
  [
   6,
   12,
   "low",
   0.057,
   "low",
   "Rockfall: 33 mm rain in 48 h near Anantnag (Bijbehara); zone 6 has low exposure to rockfall"
  ],
  [
   1,
   24,
   "low",
   0.1,
   "low",
   "Landslide: 174 mm rain in 72 h (138 mm in 24 h) near Nagrota; zone 1 has low exposure to landslides"
  ],
  [
   2,
   24,
   "medium",
   0.6,
   "medium",
   "Landslide: 143 mm rain in 72 h (105 mm in 24 h) near Chenani; zone 2 is exposed to landslides"
  ],
  [
   3,
   24,
   "high",
   0.9,
   "medium",
   "Landslide: 127 mm rain in 72 h (69 mm in 24 h) near Nashri; zone 3 is very exposed to landslides"
  ],
  [
   4,
   24,
   "high",
   1.0,
   "medium",
   "Rockfall: 81 mm rain in 48 h near Ramban; zone 4 is very exposed to rockfall"
  ],
  [
   5,
   24,
   "high",
   0.7,
   "medium",
   "Rockfall: 81 mm rain in 48 h near Ramsoo; zone 5 is exposed to rockfall"
  ],
  [
   6,
   24,
   "low",
   0.1,
   "low",
   "Rockfall: 52 mm rain in 48 h near Anantnag (Bijbehara); zone 6 has low exposure to rockfall"
  ],
  [
   1,
   48,
   "low",
   0.1,
   "low",
   "Landslide: 214 mm rain in 72 h (54 mm in 24 h) near Nagrota; zone 1 has low exposure to landslides"
  ],
  [
   2,
   48,
   "medium",
   0.6,
   "low",
   "Landslide: 239 mm rain in 72 h (111 mm in 24 h) near Chenani; zone 2 is exposed to landslides"
  ],
  [
   3,
   48,
   "high",
   0.9,
   "low",
   "Landslide: 203 mm rain in 72 h (105 mm in 24 h) near Nashri; zone 3 is very exposed to landslides"
  ],
  [
   4,
   48,
   "high",
   1.0,
   "low",
   "Rockfall: 129 mm rain in 48 h near Ramban; zone 4 is very exposed to rockfall"
  ],
  [
   5,
   48,
   "high",
   0.7,
   "low",
   "Rockfall: 130 mm rain in 48 h near Ramsoo; zone 5 is exposed to rockfall"
  ],
  [
   6,
   48,
   "low",
   0.1,
   "low",
   "Landslide: 123 mm rain in 72 h (71 mm in 24 h) near Anantnag (Bijbehara); zone 6 has low exposure to landslides"
  ]
 ]
};
/* /BUILD:data */

const T = DATA.tokens.color;
const VARS = {};        // "bg.canvas" -> Variable
const STYLES = {};      // "body" -> TextStyle
const FONTS = {};       // "Inter|Bold" -> FontName that actually loaded
const fallbacks = [];

// ------------------------------------------------------------------ helpers
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
function lum(hex) {
  const c = rgb(hex);
  const f = v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function ratio(a, b) {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function solid(token, opacity) {
  const p = { type: 'SOLID', color: rgb(T[token]), opacity: opacity == null ? 1 : opacity };
  return VARS[token] ? figma.variables.setBoundVariableForPaint(p, 'color', VARS[token]) : p;
}
function bindSpace(node, field, px) {
  const key = Object.keys(DATA.tokens.space).find(k => DATA.tokens.space[k] === px);
  node[field] = px;
  if (key && VARS['space.' + key]) node.setBoundVariable(field, VARS['space.' + key]);
}
// Auto-layout frame. dir: 'H' | 'V' | null (absolute children)
function frame(o) {
  const f = figma.createFrame();
  f.name = o.name || 'Frame';
  f.fills = o.fill ? [solid(o.fill)] : [];
  if (o.stroke) { f.strokes = [solid(o.stroke)]; f.strokeWeight = o.strokeWeight || 1; if (o.dash) f.dashPattern = o.dash; }
  if (o.radius != null) f.cornerRadius = o.radius;
  f.resize(o.w || 100, o.h || 100);
  if (o.dir) {
    f.layoutMode = o.dir === 'H' ? 'HORIZONTAL' : 'VERTICAL';
    bindSpace(f, 'itemSpacing', o.gap == null ? 8 : o.gap);
    const p = o.pad == null ? 0 : o.pad;
    const [pt, pr, pb, pl] = Array.isArray(p) ? p : [p, p, p, p];
    bindSpace(f, 'paddingTop', pt); bindSpace(f, 'paddingRight', pr); bindSpace(f, 'paddingBottom', pb); bindSpace(f, 'paddingLeft', pl);
    f.layoutSizingHorizontal = o.w ? 'FIXED' : 'HUG';
    f.layoutSizingVertical = o.h ? 'FIXED' : 'HUG';
    if (o.align) f.counterAxisAlignItems = o.align;     // MIN | CENTER | MAX
    if (o.justify) f.primaryAxisAlignItems = o.justify; // MIN | CENTER | MAX | SPACE_BETWEEN
  }
  if (o.clip != null) f.clipsContent = o.clip;
  return f;
}
function add(parent, child, fill) {
  parent.appendChild(child);
  if (fill && parent.layoutMode && parent.layoutMode !== 'NONE') {
    if (parent.layoutMode === 'HORIZONTAL') child.layoutGrow = 1;
    child.layoutSizingHorizontal = 'FILL';
  }
  return child;
}
// Figma names some styles "Semi Bold" and others "SemiBold"; Atkinson Hyperlegible only has Regular and Bold.
const STYLE_ALTS = {
  'Regular': ['Regular'], 'Medium': ['Medium', 'Regular'], 'Semi Bold': ['Semi Bold', 'SemiBold', 'Bold'],
  'Bold': ['Bold'], 'Extra Bold': ['Extra Bold', 'ExtraBold', 'Bold'],
};
const FAMILY_ALTS = {
  'Barlow Semi Condensed': ['Barlow Semi Condensed', 'Barlow Condensed', 'Barlow'],
  'Atkinson Hyperlegible': ['Atkinson Hyperlegible', 'Atkinson Hyperlegible Next'],
  'Atkinson Hyperlegible Mono': ['Atkinson Hyperlegible Mono', 'Roboto Mono'],
};
async function loadFont(family, style) {
  const key = family + '|' + style;
  if (FONTS[key]) return FONTS[key];
  for (const fam of FAMILY_ALTS[family] || [family]) {
    for (const st of STYLE_ALTS[style] || [style]) {
      try {
        await figma.loadFontAsync({ family: fam, style: st });
        FONTS[key] = { family: fam, style: st };
        if (fam !== family) fallbacks.push(family + ' -> ' + fam);
        return FONTS[key];
      } catch (e) { /* try the next one */ }
    }
  }
  const alt = { family: 'Inter', style: style === 'Medium' ? 'Medium' : /Bold/.test(style) ? 'Bold' : 'Regular' };
  await figma.loadFontAsync(alt);
  FONTS[key] = alt;
  fallbacks.push(key);
  return alt;
}
const WEIGHT = { 400: 'Regular', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold' };
async function text(chars, styleName, color, o = {}) {
  const t = figma.createText();
  const st = STYLES[styleName];
  t.fontName = st.fontName;
  t.characters = chars;
  await t.setTextStyleIdAsync(st.id);
  if (o.size) t.fontSize = o.size;
  if (o.weight) { t.fontName = await loadFont(st.fontName.family, WEIGHT[o.weight]); }
  t.fills = [solid(color || 'text.primary')];
  if (o.align) t.textAlignHorizontal = o.align;
  t.name = o.name || chars.slice(0, 24);
  return t;
}
// wrapping text: pass it to add(parent, t, true) so it fills the parent's width
function wrapText(t) { t.textAutoResize = 'HEIGHT'; return t; }
const EXTRA_ICONS = {
  bell: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></svg>',
};
function icon(name, colorToken, size) {
  const svg = (DATA.icons[name] || EXTRA_ICONS[name]).replace(/currentColor/g, T[colorToken || 'text.primary']);
  const n = figma.createNodeFromSvg(svg);
  n.name = 'icon/' + name;
  if (size && size !== 24) n.rescale(size / 24);
  return n;
}
function rect(w, h, token, radius) {
  const r = figma.createRectangle();
  r.resize(w, h);
  r.fills = token ? [solid(token)] : [];
  if (radius) r.cornerRadius = radius;
  return r;
}
function hotspot(parent, x, y, w, h, name) {
  const f = figma.createFrame();
  f.name = 'hotspot/' + name; f.fills = []; f.resize(w, h); f.x = x; f.y = y;
  parent.appendChild(f);
  return f;
}
function topFrame(node) { let n = node; while (n.parent && n.parent.type !== 'PAGE') n = n.parent; return n; }
async function link(node, dest, kind) {
  // Figma rejects a link to the screen the button is already on (for example the Map tab on the Map screen)
  if (dest && topFrame(node).id === dest.id) return;
  const ease = { type: 'EASE_OUT' };
  const action = kind === 'CLOSE' ? { type: 'CLOSE' } : {
    type: 'NODE', destinationId: dest.id, navigation: kind === 'DIALOG' ? 'OVERLAY' : (kind || 'NAVIGATE'), preserveScrollPosition: false,
    transition: kind === 'OVERLAY' ? { type: 'MOVE_IN', direction: 'TOP', matchLayers: false, easing: ease, duration: 0.25 }
      : { type: 'DISSOLVE', easing: ease, duration: 0.2 },
  };
  const reactions = [{ trigger: { type: 'ON_CLICK' }, actions: [action] }];
  if (node.setReactionsAsync) await node.setReactionsAsync(reactions);
  else node.reactions = reactions;
}
// Pages. Figma's free Starter plan allows only 3 pages per file, so:
//  - the empty "Page 1" of a new file is reused as our first page, and
//  - if Figma refuses a new page, the content goes on the last page, below what is already there.
// BASE_Y is where the current section starts on its page; place() adds it.
const PAGES = [];
let REUSE = null, BASE_Y = 0, MERGED = 0;
async function newPage(name) {
  let p = null;
  if (REUSE) { p = REUSE; REUSE = null; p.name = name; }
  else {
    try { p = figma.createPage(); p.name = name; } catch (e) { p = null; }
  }
  if (p) { PAGES.push(p); BASE_Y = 0; }
  else {
    p = PAGES[PAGES.length - 1];
    let bottom = 0;
    for (const c of p.children) bottom = Math.max(bottom, c.y + c.height);
    BASE_Y = Math.ceil((bottom + 600) / 10) * 10;
    p.name = p.name + ' & ' + name.replace(/^\d+_/, '');
    MERGED++;
  }
  await figma.setCurrentPageAsync(p);
  return p;
}
function place(page, node, x, y) { page.appendChild(node); node.x = x; node.y = y + BASE_Y; return node; }

// An orthogonal arrow on the canvas, through absolute points [[x, y], ...], with an arrow head at the end.
// Prototype links only show in Prototype mode; these arrows show the flow on the page itself.
let ARROWS = 0;
async function arrow(page, pts, label, labelAt) {
  ARROWS++;
  const minX = Math.min(...pts.map(p => p[0])), minY = Math.min(...pts.map(p => p[1]));
  const v = figma.createVector();
  v.name = 'arrow/' + (label || 'flow');
  const net = {
    vertices: pts.map((p, i) => Object.assign({ x: p[0] - minX, y: p[1] - minY }, i === pts.length - 1 ? { strokeCap: 'ARROW_LINES' } : {})),
    segments: pts.slice(1).map((p, i) => ({ start: i, end: i + 1 })),
    regions: [],
  };
  if (v.setVectorNetworkAsync) await v.setVectorNetworkAsync(net); else v.vectorNetwork = net;
  v.strokes = [solid('text.primary')]; v.strokeWeight = 3; v.strokeJoin = 'ROUND';
  place(page, v, minX, minY - BASE_Y);
  if (label) {
    const i = labelAt == null ? 0 : labelAt;
    const a = pts[i], b = pts[i + 1];
    const tag = frame({ name: 'arrow label', dir: 'H', pad: [4, 8, 4, 8], fill: 'brand.milestone', radius: 2 });
    add(tag, await text(label, 'label', 'text.primary'));
    place(page, tag, (a[0] + b[0]) / 2 - tag.width / 2, (a[1] + b[1]) / 2 - tag.height - 6 - BASE_Y);
  }
  return v;
}
// NH milestone: yellow cap with black text, white body. Our logo and section marker.
async function milestone(top, bottom, w) {
  const m = frame({ name: 'milestone ' + top + ' ' + bottom, dir: 'V', gap: 0, w: w || 56, fill: 'bg.elevated', stroke: 'text.primary', strokeWeight: 2, radius: 2, clip: true });
  const cap = frame({ name: 'cap', dir: 'V', pad: [4, 0, 2, 0], fill: 'brand.milestone', align: 'CENTER' });
  add(m, cap, true);
  add(cap, await text(top, 'label', 'text.primary', { weight: 700 }));
  const body = frame({ name: 'body', dir: 'V', pad: [2, 0, 4, 0], align: 'CENTER' });
  add(m, body, true);
  add(body, await text(bottom, 'h2', 'text.primary', { weight: 700 }));
  return m;
}

// ------------------------------------------------------------------ 1 variables and text styles
async function buildTokens() {
  const coll = figma.variables.createVariableCollection('RouteGuard tokens');
  const mode = coll.modes[0].modeId;
  coll.renameMode(mode, 'Light');
  for (const name of Object.keys(T)) {
    // Figma variable names use "/" for groups and do not allow ".", so bg.canvas becomes bg/canvas
    const v = figma.variables.createVariable('color/' + name.replace(/\./g, '/'), coll, 'COLOR');
    v.setValueForMode(mode, Object.assign(rgb(T[name]), { a: 1 }));
    v.description = 'tokens.json ' + name + ' ' + T[name];
    VARS[name] = v;
  }
  for (const k of Object.keys(DATA.tokens.space)) {
    const v = figma.variables.createVariable('space/' + k, coll, 'FLOAT');
    v.setValueForMode(mode, DATA.tokens.space[k]);
    VARS['space.' + k] = v;
  }
  for (const k of Object.keys(DATA.tokens.radius)) {
    const v = figma.variables.createVariable('radius/' + k, coll, 'FLOAT');
    v.setValueForMode(mode, DATA.tokens.radius[k]);
  }
  const touch = figma.variables.createVariable('size/touch-min', coll, 'FLOAT');
  touch.setValueForMode(mode, DATA.tokens.touch_min_px);

  for (const name of Object.keys(DATA.tokens.type)) {
    const t = DATA.tokens.type[name];
    const font = await loadFont(t.family, WEIGHT[t.weight]);
    const s = figma.createTextStyle();
    s.name = 'RouteGuard/' + name;
    s.fontName = font;
    s.fontSize = t.size;
    s.lineHeight = { unit: 'PIXELS', value: t.line };
    if (t.upper) { s.textCase = 'UPPER'; s.letterSpacing = { unit: 'PERCENT', value: (t.tracking || 0) * 100 }; }
    if (font.family !== t.family) s.description = 'fallback ' + font.family + ' (' + t.family + ' not available)';
    if (!s.description) s.description = t.family + ' ' + t.size + '/' + t.line + ' ' + t.weight;
    STYLES[name] = s;
  }
}

async function buildStyleGuide(page) {
  const root = frame({ name: 'Style guide', dir: 'V', gap: 32, pad: 48, fill: 'bg.canvas', w: 1440 });
  place(page, root, 0, 0);
  const brand = frame({ name: 'brand', dir: 'H', gap: 16, align: 'CENTER' });
  add(root, brand);
  add(brand, await milestone('NH', '44', 64));
  add(brand, await text('RouteGuard design system', 'display'));
  add(root, wrapText(await text('Tokens from docs/ux/data/tokens.json. Every colour below is a variable in the "RouteGuard tokens" collection; every text style is under RouteGuard/. Colours come from NH-44 itself: highway-sign green, milestone yellow, apple red, rail blue. Ratios use the WCAG 2.1 formula: text needs 4.5:1, decision badges 7:1.', 'body', 'text.secondary')), true);

  add(root, await text('Colour variables', 'h1'));
  const grid = frame({ name: 'Swatches', dir: 'H', gap: 16, w: 1344 });
  grid.layoutWrap = 'WRAP'; grid.counterAxisSpacing = 16;
  add(root, grid);
  for (const name of Object.keys(T)) {
    const onW = ratio(T['text.inverse'], T[name]), onD = ratio(T['text.primary'], T[name]);
    const best = Math.max(onW, onD);
    const tag = best >= 7 ? 'AAA' : best >= 4.5 ? 'AA' : best >= 3 ? 'AA large / UI' : 'fail';
    const card = frame({ name: 'swatch/' + name, dir: 'V', gap: 0, w: 200, fill: 'bg.elevated', stroke: 'border.default', radius: 6, clip: true });
    add(grid, card);
    const chip = frame({ name: 'chip', dir: 'V', pad: 8, w: 200, h: 64, fill: name, justify: 'MAX' });
    add(card, chip);
    add(chip, await text('Aa', 'h2', onW >= onD ? 'text.inverse' : 'text.primary'));
    const meta = frame({ name: 'meta', dir: 'V', gap: 2, pad: 8, w: 200 });
    add(card, meta);
    add(meta, await text(name, 'body', 'text.primary', { weight: 600 }));
    add(meta, await text(T[name] + ' \u00b7 ' + (onW >= onD ? 'white' : 'ink') + ' ' + best.toFixed(2) + ':1 ' + tag, 'body', 'text.secondary'));
  }

  add(root, await text('Pairs we use', 'h1'));
  const pairs = frame({ name: 'Contrast pairs', dir: 'V', gap: 4, w: 1344 });
  add(root, pairs);
  for (const p of DATA.tokens.contrast_pairs) {
    const r = ratio(T[p.fg], T[p.bg]);
    const row = frame({ name: p.fg + ' on ' + p.bg, dir: 'H', gap: 16, pad: [6, 12, 6, 12], fill: p.bg, radius: 2, w: 1344, align: 'CENTER' });
    add(pairs, row);
    add(row, await text(p.fg + ' on ' + p.bg, 'data', p.fg));
    add(row, wrapText(await text(p.use, 'body', ratio(T['text.inverse'], T[p.bg]) > ratio(T['text.primary'], T[p.bg]) ? 'text.inverse' : 'text.primary')), true);
    add(row, await text(r.toFixed(2) + ':1 (needs ' + p.min + ':1) ' + (r >= p.min ? 'PASS' : 'FAIL'), 'data', p.fg));
  }

  add(root, await text('Text styles', 'h1'));
  for (const name of Object.keys(DATA.tokens.type)) {
    const t = DATA.tokens.type[name];
    const row = frame({ name: 'type/' + name, dir: 'H', gap: 24, w: 1344, align: 'CENTER' });
    add(root, row);
    const lab = await text(name + ' \u00b7 ' + t.family + ' ' + t.size + '/' + t.line, 'body', 'text.secondary');
    lab.resize(260, lab.height); lab.textAutoResize = 'HEIGHT';
    add(row, lab);
    add(row, await text(name === 'data' ? '0.70 \u00b7 range 0.45 to 0.95 \u00b7 +24 h' : 'Send the lot before Ramban closes', name));
  }

  add(root, await text('Spacing (8 pt grid) and touch', 'h1'));
  for (const k of Object.keys(DATA.tokens.space)) {
    const row = frame({ name: 'space/' + k, dir: 'H', gap: 12, align: 'CENTER' });
    add(root, row);
    add(row, rect(DATA.tokens.space[k] * 4, 16, 'brand.rail', 2));
    add(row, await text('space.' + k + ' = ' + DATA.tokens.space[k] + ' px', 'data', 'text.secondary'));
  }
  add(root, await text('Touch targets are at least ' + DATA.tokens.touch_min_px + ' px.', 'body', 'text.secondary'));

  add(root, await text('Icons (24 px grid, 2 px stroke, round caps)', 'h1'));
  const ig = frame({ name: 'Icons', dir: 'H', gap: 16, w: 1344 });
  ig.layoutWrap = 'WRAP'; ig.counterAxisSpacing = 16;
  add(root, ig);
  for (const name of Object.keys(DATA.icons)) {
    const cell = frame({ name: 'icon-cell/' + name, dir: 'V', gap: 8, pad: 12, w: 150, fill: 'bg.elevated', stroke: 'border.default', radius: 6, align: 'CENTER' });
    add(ig, cell);
    add(cell, icon(name, 'text.primary', 48));
    add(cell, await text(name, 'data', 'text.secondary', { size: 12 }));
  }
}

// ------------------------------------------------------------------ 2 components
const ADVICE = {
  SEND: { tok: 'send', icon: 'decision-send', why: 'All 6 zones stay low for 24 h. Leave in the next 12 h.' },
  HOLD: { tok: 'hold', icon: 'decision-hold', why: 'Zone 3 is medium at +12 h. Wait 6 h and check again.' },
  RAIL: { tok: 'rail', icon: 'decision-rail', why: 'Zones 3 to 5 stay high at +24 h and +48 h. Book a Budgam\u2013Delhi parcel slot.' },
  DIVERT: { tok: 'divert', icon: 'decision-divert', why: 'Light truck: take Mughal Road instead of NH-44.' },
};
const LEVEL = { Low: { bg: 'send.bg', text: 'send.text', map: 'risk.low.map', score: '0.15' }, Medium: { bg: 'hold.bg', text: 'hold.text', map: 'risk.medium.map', score: '0.42' }, High: { bg: 'high.bg', text: 'high.text', map: 'risk.high.map', score: '0.71' } };
const CONF = { Low: { bg: 'bg.surface', text: 'text.secondary' }, Medium: { bg: 'bg.surface', text: 'text.primary' }, High: { bg: 'rail.bg', text: 'rail.text' } };
const SYNC = {
  'Online Live': { bg: 'send.bg', text: 'send.text', icon: 'nav-map', label: 'Live \u00b7 scores from the 18:34 UTC run' },
  'Offline Cached <5KB': { bg: 'text.primary', text: 'text.inverse', icon: 'status-offline-queue', label: 'Offline \u00b7 cached scores from 2 h ago, 0.8 KB' },
  'Stale Score >2h': { bg: 'hold.bg', text: 'hold.text', icon: 'decision-hold', label: 'Scores are 3 h old \u00b7 the hourly job missed a run' },
  'Syncing Queued Report (2)': { bg: 'rail.bg', text: 'rail.text', icon: 'status-offline-queue', label: 'Sending 2 queued reports\u2026' },
};
const SOURCE = {
  'Police Official': { bg: 'rail.bg', text: 'rail.text', stroke: 'rail.fill', icon: 'decision-hold' },
  'Verified Driver': { bg: 'send.bg', text: 'send.text', stroke: 'send.fill', icon: 'decision-send' },
  'Unconfirmed Driver': { bg: 'bg.elevated', text: 'text.secondary', stroke: 'border.strong', icon: 'status-offline-queue', dash: [4, 3] },
};
const TABS = [['Map', 'nav-map'], ['48h Strip', 'nav-strip'], ['Advisor', 'nav-advisor'], ['Board', 'nav-board'], ['Report', 'nav-report']];

async function badge(label, bgTok, textTok) {
  const b = frame({ name: 'badge', dir: 'H', gap: 4, pad: [2, 8, 2, 8], fill: bgTok, radius: 2, align: 'CENTER' });
  add(b, await text(label, 'label', textTok, { weight: 700 }));
  return b;
}
async function buildComponents(page) {
  const sets = {};
  let y = 0;
  const title = await text('Components and variants', 'display');
  place(page, title, 0, y); y += 60;

  // Decision Banner
  let comps = [];
  for (const adv of Object.keys(ADVICE)) {
    const a = ADVICE[adv];
    const c = figma.createComponent();
    c.name = 'Advice=' + adv;
    c.layoutMode = 'HORIZONTAL'; c.itemSpacing = 0; c.resize(358, 100);
    c.layoutSizingHorizontal = 'FIXED'; c.layoutSizingVertical = 'HUG';
    c.cornerRadius = 6; c.clipsContent = true; c.strokes = [solid('border.default')]; c.fills = [solid(a.tok + '.bg')];
    const stripe = rect(6, 10, a.tok + '.fill');
    add(c, stripe); stripe.layoutSizingVertical = 'FILL';
    const body = frame({ name: 'body', dir: 'V', gap: 4, pad: [12, 16, 12, 16] });
    add(c, body, true);
    const head = frame({ name: 'head', dir: 'H', gap: 8, align: 'CENTER' });
    add(body, head);
    add(head, icon(a.icon, a.tok + '.text'));
    add(head, await text(adv, 'decision', a.tok + '.text', { name: 'advice' }));
    add(body, wrapText(await text(a.why, 'body', 'text.primary', { name: 'why' })), true);
    comps.push(c);
  }
  sets.decision = figma.combineAsVariants(comps, page);

  // Zone Risk Card: RiskLevel x Confidence
  comps = [];
  for (const lv of Object.keys(LEVEL)) for (const cf of Object.keys(CONF)) {
    const L = LEVEL[lv], K = CONF[cf];
    const c = figma.createComponent();
    c.name = 'RiskLevel=' + lv + ', Confidence=' + cf;
    c.layoutMode = 'HORIZONTAL'; c.itemSpacing = 0; c.resize(358, 100);
    c.layoutSizingHorizontal = 'FIXED'; c.layoutSizingVertical = 'HUG';
    c.cornerRadius = 6; c.clipsContent = true; c.fills = [solid('bg.elevated')]; c.strokes = [solid('border.default')];
    const stripe = rect(6, 10, L.map);
    add(c, stripe); stripe.layoutSizingVertical = 'FILL';
    const body = frame({ name: 'body', dir: 'V', gap: 8, pad: [12, 16, 12, 16] });
    add(c, body, true);
    add(body, await text('Zone 4 \u00b7 Ramban \u2192 Ramsoo', 'body', 'text.primary', { weight: 600, name: 'zone' }));
    const row = frame({ name: 'badges', dir: 'H', gap: 8 });
    add(body, row);
    add(row, await badge((lv === 'High' ? '\u25b2\u25b2 ' : lv === 'Medium' ? '\u25b2 ' : '') + lv + ' risk', L.bg, L.text));
    add(row, await badge(cf + ' confidence', K.bg, K.text));
    const sc = frame({ name: 'score', dir: 'H', gap: 12, align: 'CENTER' });
    add(body, sc);
    add(sc, await text(L.score, 'data', 'text.primary', { size: 24, name: 'score' }));
    add(sc, await text('range ' + (+L.score - 0.2).toFixed(2) + ' to ' + Math.min(1, +L.score + 0.25).toFixed(2), 'data', 'text.secondary', { name: 'range' }));
    const why = frame({ name: 'reason', dir: 'H', gap: 8 });
    add(body, why, true);
    add(why, icon('hazard-landslide', 'text.primary', 20));
    add(why, wrapText(await text('Landslide: rain over 72 h near Ramban', 'body', 'text.primary', { name: 'reason' })), true);
    comps.push(c);
  }
  sets.zone = figma.combineAsVariants(comps, page);

  // Connectivity & Sync Banner
  comps = [];
  for (const st of Object.keys(SYNC)) {
    const s = SYNC[st];
    const c = figma.createComponent();
    c.name = 'State=' + st;
    c.layoutMode = 'HORIZONTAL'; c.itemSpacing = 8; c.paddingLeft = 12; c.paddingRight = 12;
    c.resize(390, 48); c.layoutSizingHorizontal = 'FIXED'; c.layoutSizingVertical = 'FIXED';
    c.counterAxisAlignItems = 'CENTER'; c.fills = [solid(s.bg)];
    add(c, icon(s.icon, s.text, 20));
    add(c, await text(s.label, 'body', s.text, { weight: 600, name: 'label' }));
    comps.push(c);
  }
  sets.sync = figma.combineAsVariants(comps, page);

  // Hazard Report Pill
  comps = [];
  for (const src of Object.keys(SOURCE)) {
    const s = SOURCE[src];
    const c = figma.createComponent();
    c.name = 'Source=' + src;
    c.layoutMode = 'HORIZONTAL'; c.itemSpacing = 6; c.paddingLeft = 12; c.paddingRight = 12; c.paddingTop = 6; c.paddingBottom = 6;
    c.layoutSizingHorizontal = 'HUG'; c.layoutSizingVertical = 'HUG'; c.counterAxisAlignItems = 'CENTER';
    c.cornerRadius = 999; c.fills = [solid(s.bg)]; c.strokes = [solid(s.stroke)]; c.strokeWeight = 1;
    if (s.dash) c.dashPattern = s.dash;
    add(c, icon(s.icon, s.text, 20));
    add(c, await text(src + ': rockfall at Digdol', 'body', s.text, { weight: 600, name: 'label' }));
    comps.push(c);
  }
  sets.pill = figma.combineAsVariants(comps, page);

  // Bottom Nav Bar
  comps = [];
  for (const [active] of TABS) {
    const c = figma.createComponent();
    c.name = 'ActiveTab=' + active;
    c.layoutMode = 'HORIZONTAL'; c.itemSpacing = 0; c.resize(390, 64);
    c.layoutSizingHorizontal = 'FIXED'; c.layoutSizingVertical = 'FIXED';
    c.fills = [solid('bg.elevated')]; c.strokes = [solid('border.default')]; c.strokeTopWeight = 1; c.strokeBottomWeight = 0; c.strokeLeftWeight = 0; c.strokeRightWeight = 0;
    for (const [tab, ic] of TABS) {
      const on = tab === active;
      const item = frame({ name: 'tab/' + tab, dir: 'V', gap: 2, align: 'CENTER', justify: 'CENTER', h: 64 });
      add(c, item, true); item.layoutSizingVertical = 'FILL';
      add(item, icon(ic, on ? 'brand.highway' : 'text.secondary'));
      add(item, await text(tab === '48h Strip' ? '48h' : tab, 'label', on ? 'brand.highway' : 'text.secondary'));
    }
    comps.push(c);
  }
  sets.nav = figma.combineAsVariants(comps, page);

  const names = { decision: 'Decision Banner', zone: 'Zone Risk Card', sync: 'Connectivity & Sync Banner', pill: 'Hazard Report Pill', nav: 'Bottom Nav Bar' };
  for (const k of Object.keys(sets)) {
    const s = sets[k];
    s.name = names[k];
    s.layoutMode = k === 'zone' ? 'HORIZONTAL' : 'VERTICAL';
    if (k === 'zone') { s.layoutWrap = 'WRAP'; s.counterAxisSpacing = 16; s.resize(1170, 100); s.layoutSizingHorizontal = 'FIXED'; s.layoutSizingVertical = 'HUG'; }
    else { s.layoutSizingHorizontal = 'HUG'; s.layoutSizingVertical = 'HUG'; }
    s.itemSpacing = 16; s.paddingTop = 24; s.paddingBottom = 24; s.paddingLeft = 24; s.paddingRight = 24;
    s.fills = [solid('bg.surface')]; s.cornerRadius = 10;
    const lab = await text(names[k], 'h1');
    place(page, lab, 0, y); y += 40;
    place(page, s, 0, y); y += s.height + 60;
  }
  return sets;
}

// ------------------------------------------------------------------ 3 wireframes
const WF = [
  ['1 Risk map (home)', [['title \u00b7 role \u00b7 bell \u00b7 me', 36], ['sync banner', 28, 1], ['horizon chips', 32], ['map \u00b7 hex cells', 300], ['legend', 12], ['zone chips', 100], ['road report pills', 40]]],
  ['2 Zone sheet (overlay)', [['title \u00b7 role \u00b7 bell \u00b7 me', 36], ['sync banner', 28, 1], ['map, dimmed', 200], ['bottom sheet: badges, score, reason, hazard bars, outlook, past closures', 420, 2]]],
  ['3 48-hour strip', [['title \u00b7 role \u00b7 bell \u00b7 me', 36], ['sync banner', 28, 1], ['worst on route', 44], ['6 zones x 4 times grid', 380], ['pattern note', 24]]],
  ['4 Dispatch advisor (form)', [['title \u00b7 role \u00b7 bell \u00b7 me', 36], ['sync banner', 28, 1], ['variety', 48], ['days \u00b7 tonnes', 48], ['destination (3 radio cards)', 170], ['truck (2 radio cards)', 116], ['truck number', 48], ['get advice', 48, 1]]],
  ['5 Advice card', [['title \u00b7 role \u00b7 bell \u00b7 me', 36], ['sync banner', 28, 1], ['decision banner', 120, 1], ['worst zone card', 140], ['delay \u00b7 priority', 80], ['commit to board', 48, 1], ['change lot', 48, 2]]],
  ['6 Shipment board', [['title \u00b7 role \u00b7 bell \u00b7 me', 36], ['sync banner', 28, 1], ['filter: all / moving / held', 56], ['truck card #1', 110], ['truck card #2', 110], ['truck card #3', 110], ['truck card #4', 110]]],
  ['7 Report: what did you see', [['title \u00b7 role \u00b7 bell \u00b7 me', 36], ['sync banner', 28, 1], ['step 1 of 3', 8, 1], ['4 hazard buttons, 112 px tall', 240], ['offline note', 50, 2]]],
  ['8 Report: where + send', [['title \u00b7 role \u00b7 bell \u00b7 me', 36], ['sync banner', 28, 1], ['step 2 of 3', 8, 1], ['photo (optional)', 140], ['GPS coords + zone', 80], ['this is the place', 48, 1], ['send report', 48, 1]]],
  ['9 TCU console (police)', [['title \u00b7 role \u00b7 bell \u00b7 me', 36], ['sync banner', 28, 1], ['zone', 48], ['status: closed / one-way / open', 180], ['cause', 48], ['publish advisory', 48, 1], ['driver reports waiting', 120]]],
  ['10 Offline drawer', [['title \u00b7 role \u00b7 bell \u00b7 me', 36], ['sync banner', 28, 1], ['screen behind', 160], ['drawer: cache size, queued reports, send now, works offline', 420, 2]]],
  ['11 Loading state', [['title \u00b7 role \u00b7 bell \u00b7 me', 36], ['sync banner', 28, 1], ['skeleton chips', 48], ['skeleton map', 300], ['skeleton rows', 120]]],
  ['12 Empty and error states', [['title \u00b7 role \u00b7 bell \u00b7 me', 36], ['sync banner', 28, 1], ['icon', 60], ['what happened, in plain words', 50], ['one action: retry / plan a lot', 48, 1]]],
  ['13 Welcome + phone number', [['routeguard \u00b7 one line on what it does', 90], ['what you get \u00b7 3 lines', 96, 2], ['+91 \u00b7 mobile number', 48], ['send code', 48, 1], ['no password, code by SMS', 24]], true],
  ['14 OTP check', [['back \u00b7 enter the code', 36], ['sent to +91 \u2026 \u00b7 change number', 24], ['6 code boxes', 56], ['verify', 48, 1], ['resend in 30 s', 32, 2], ['wrong / expired code message', 48, 2]], true],
  ['15 Create account + consent', [['create your account', 36], ['full name', 48], ['role: grower / agent / driver', 64], ['truck no. (drivers)', 48], ["agent's phone (drivers)", 48], ['location \u00b7 alerts switches \u00b7 what we keep', 110, 2], ['create account', 48, 1]], true],
  ['16 Profile and settings', [['title \u00b7 role \u00b7 bell \u00b7 me', 36], ['sync banner', 28, 1], ['name \u00b7 role \u00b7 verified badge', 70], ['alert zones', 80], ['offline data \u00b7 0.8 KB', 48], ['sign out', 48, 2], ['delete account', 48, 2]]],
  ['17 Alerts inbox', [['title \u00b7 role \u00b7 bell \u00b7 me', 36], ['sync banner', 28, 1], ['for zones 3, 4, 5', 24], ['police update', 70], ['verified report', 70], ['zone turns high', 70], ['scores are old', 70]]],
  ['18 Truck detail (sheet)', [['title \u00b7 role \u00b7 bell \u00b7 me', 36], ['sync banner', 28, 1], ['board, dimmed', 140], ['bottom sheet: advice and why, last seen, ETA, delay, priority, zones on the route, call the driver', 440, 2]]],
  ['19 Confirm dialog', [['title \u00b7 role \u00b7 bell \u00b7 me', 36], ['sync banner', 28, 1], ['screen behind, dimmed', 220], ['dialog: title, what will happen, main action, cancel', 200, 2]]],
  ['20 Desktop control room (1440 x 900)', [['header \u00b7 milestone \u00b7 role \u00b7 sync banner', 40], ['risk map', 300], ['48 h strip + shipment board', 300], ['road reports / TCU form', 300, 2]], true, true],
];
async function buildWireframes(page) {
  const frames = [];
  for (let i = 0; i < WF.length; i++) {
    const [name, boxes, noNav, wide] = WF[i];
    if (wide) { // desktop 1440 x 900, drawn at 0.58 so it fits two columns
      const f = frame({ name: 'WF ' + name, dir: 'V', gap: 12, pad: 16, w: 840, h: 525, fill: 'bg.elevated', stroke: 'border.strong', radius: 8, clip: true });
      place(page, f, (i % 6) * 450, Math.floor(i / 6) * 960 + 60);
      const [hd, ...cols] = boxes;
      const hb = frame({ name: hd[0], dir: 'V', pad: 6, h: hd[1], fill: 'border.strong', radius: 2 });
      add(f, hb, true);
      add(hb, await text(hd[0], 'label', 'text.inverse'));
      const row = frame({ name: 'columns', dir: 'H', gap: 12 });
      add(f, row, true); row.layoutGrow = 1;
      for (const [lab, , kind] of cols) {
        const b = frame({ name: lab, dir: 'V', pad: 6, fill: kind === 2 ? null : 'border.default', stroke: kind === 2 ? 'border.strong' : null, dash: kind === 2 ? [6, 4] : null, radius: 2 });
        add(row, b, true); b.layoutGrow = 1; b.layoutSizingVertical = 'FILL';
        add(b, wrapText(await text(lab, 'label', 'text.primary')), true);
      }
      place(page, await text(name, 'h2'), f.x, f.y - BASE_Y - 36);
      frames.push(f);
      continue;
    }
    const f = frame({ name: 'WF ' + name, dir: 'V', gap: 12, pad: [16, 16, 0, 16], w: 390, h: 844, fill: 'bg.elevated', stroke: 'border.strong', radius: 28, clip: true });
    place(page, f, (i % 6) * 450, Math.floor(i / 6) * 960 + 60);
    for (const [lab, h, kind] of boxes) {
      const b = frame({ name: lab, dir: 'V', pad: 6, h, fill: kind === 1 ? 'border.strong' : kind === 2 ? null : 'border.default', stroke: kind === 2 ? 'border.strong' : null, dash: kind === 2 ? [6, 4] : null, radius: 2 });
      add(f, b, true);
      if (h >= 24) add(b, await text(lab, 'label', kind === 1 ? 'text.inverse' : 'text.primary'));
    }
    const sp = frame({ name: 'spacer', dir: 'V' });
    add(f, sp, true); sp.layoutGrow = 1;
    if (noNav) { place(page, await text(name, 'h2'), f.x, f.y - BASE_Y - 36); frames.push(f); continue; }
    const nav = frame({ name: 'bottom nav', dir: 'V', pad: 6, h: 64, fill: 'border.strong' });
    add(f, nav, true);
    add(nav, await text('bottom nav \u00b7 5 tabs', 'label', 'text.inverse'));
    const cap = await text(name, 'h2');
    place(page, cap, f.x, f.y - BASE_Y - 36);
    frames.push(f);
  }
  return frames;
}

// ------------------------------------------------------------------ 4 hi-fi prototype
function replayRow(z, h) { return DATA.replay.find(r => r[0] === z && r[1] === h); }
const ZN = { 1: 'Jammu', 2: 'Chenani', 3: 'Nashri', 4: 'Ramban', 5: 'Banihal', 6: 'Srinagar' };
const LVTOK = { low: 'Low', medium: 'Medium', high: 'High' };

// Layout of page 4: one row per flow, screens left to right, arrows between them.
const COL = 640, ROW = 1080, TOP = 220;
const at = (col, row) => [col * COL, TOP + row * ROW];

// Avatar initials of the four personas (05_Personas): Haji Ghulam Nabi, Tariq Ahmad, Gurpreet Singh, Insp. Rajesh Sharma.
const INITIALS = { 'Grower / Trader': 'GN', 'Transport Agent': 'TA', 'Truck Driver': 'GS', 'Traffic Police (TCU)': 'RS' };
// App screen: highway-green header like an NH sign (title, role, alerts bell, profile), sync banner, content, bottom nav.
async function screen(page, name, pos, title, role, tab, sets, syncState, back) {
  const f = frame({ name, w: 390, h: 844, fill: 'bg.canvas', radius: 24, clip: true, stroke: 'border.strong' });
  place(page, f, pos[0], pos[1]);
  const head = frame({ name: 'header (NH sign)', w: 390, h: 64, fill: 'brand.highway' });
  f.appendChild(head);
  let backBtn = null, x0 = 16;
  if (back) {
    backBtn = frame({ name: 'button/back', dir: 'H', w: 48, h: 48, radius: 2, align: 'CENTER', justify: 'CENTER' });
    head.appendChild(backBtn); backBtn.x = 4; backBtn.y = 8;
    add(backBtn, await text('\u2190', 'h1', 'text.inverse'));
    x0 = 56;
  }
  const t = await text(title, 'h1', 'text.inverse'); head.appendChild(t); t.x = x0; t.y = 8;
  const r = await text(role, 'label', 'text.inverse'); head.appendChild(r); r.x = x0; r.y = 40;
  const bell = frame({ name: 'button/alerts', dir: 'H', w: 48, h: 48, radius: 2, align: 'CENTER', justify: 'CENTER' });
  head.appendChild(bell); bell.x = 270; bell.y = 8;
  add(bell, icon('bell', 'text.inverse', 24));
  const me = frame({ name: 'button/profile', dir: 'H', w: 48, h: 48, radius: 24, fill: 'brand.milestone', align: 'CENTER', justify: 'CENTER' });
  head.appendChild(me); me.x = 326; me.y = 8;
  add(me, await text(INITIALS[role] || 'GS', 'label', 'text.primary', { weight: 700 }));
  const sync = sets.sync.children.find(c => c.name === 'State=' + (syncState || 'Online Live')).createInstance();
  f.appendChild(sync); sync.x = 0; sync.y = 64;
  const body = frame({ name: 'content', dir: 'V', gap: 12, w: 358 });
  f.appendChild(body); body.x = 16; body.y = 124;
  const nav = sets.nav.children.find(c => c.name === 'ActiveTab=' + tab).createInstance();
  f.appendChild(nav); nav.x = 0; nav.y = 780;
  return { f, body, sync, nav, bell, me, back: backBtn };
}
// Screen before sign-in: no header, no nav.
async function bare(page, name, pos) {
  const f = frame({ name, w: 390, h: 844, fill: 'bg.canvas', radius: 24, clip: true, stroke: 'border.strong' });
  place(page, f, pos[0], pos[1]);
  const body = frame({ name: 'content', dir: 'V', gap: 16, w: 342 });
  f.appendChild(body); body.x = 24; body.y = 48;
  return { f, body };
}
function variant(set, props) {
  const want = Object.keys(props).map(k => k + '=' + props[k]).join(', ');
  return set.children.find(c => c.name === want).createInstance();
}
async function button(label, fillTok, textTok, strokeTok) {
  const b = frame({ name: 'button/' + label, dir: 'H', h: 48, pad: [0, 16, 0, 16], fill: fillTok, stroke: strokeTok, radius: 6, align: 'CENTER', justify: 'CENTER' });
  add(b, await text(label, 'body', textTok, { weight: 700 }));
  return b;
}
async function field(parent, label, value, opts) {
  add(parent, await text(label, 'label', 'text.secondary'));
  const f = frame({ name: 'field/' + label, dir: 'H', h: 48, pad: [0, 12, 0, 12], fill: 'bg.elevated', stroke: (opts && opts.focus) ? 'brand.highway' : 'border.strong', strokeWeight: (opts && opts.focus) ? 2 : 1, radius: 6, align: 'CENTER' });
  add(parent, f, true);
  add(f, await text(value, 'input', (opts && opts.hint) ? 'text.secondary' : 'text.primary'));
  return f;
}
async function toggleRow(parent, label, on) {
  const row = frame({ name: 'switch/' + label, dir: 'H', h: 48, gap: 12, align: 'CENTER', justify: 'SPACE_BETWEEN' });
  add(parent, row, true);
  add(row, wrapText(await text(label, 'body')), true);
  const sw = frame({ name: 'switch', w: 52, h: 32, radius: 16, fill: on ? 'brand.highway' : 'border.strong' });
  add(row, sw);
  const knob = rect(24, 24, 'bg.elevated', 12); sw.appendChild(knob); knob.x = on ? 24 : 4; knob.y = 4;
  return row;
}
async function rowLabel(page, code, title, sub, row) {
  const y = TOP + row * ROW, x = -600;
  place(page, await milestone(code === 'PC' ? 'WEB' : 'FLOW', code, 64), x, y);
  const t = await text(title, 'display'); t.resize(440, t.height); t.textAutoResize = 'HEIGHT'; place(page, t, x, y + 80);
  const s2 = await text(sub, 'body', 'text.secondary'); s2.resize(440, s2.height); s2.textAutoResize = 'HEIGHT'; place(page, s2, x, y + 80 + t.height + 12);
}

// Confirm dialog, shown as a centred overlay: what will happen, the main action first, Cancel under it.
async function dialog(page, name, pos, title, body, okLabel, okFill) {
  const f = frame({ name, dir: 'V', gap: 12, pad: 20, w: 342, fill: 'bg.elevated', stroke: 'border.default', radius: 10 });
  place(page, f, pos[0], pos[1]);
  add(f, wrapText(await text(title, 'h2')), true);
  add(f, wrapText(await text(body, 'body')), true);
  const ok = await button(okLabel, okFill, 'text.inverse');
  add(f, ok, true);
  const cancel = await button('Cancel', 'bg.elevated', 'text.primary', 'border.strong');
  add(f, cancel, true);
  return { f, ok, cancel };
}

async function buildPrototype(page, sets) {
  const S = {};
  // ---------------- Flow D: first sign-in (row 0)
  await rowLabel(page, 'D', 'First sign-in and account', 'Phone number, a 6-digit code by SMS, then a short account form for new users. No passwords.', 0);
  S.welcome = await bare(page, 'A1 Welcome + phone', at(0, 0));
  {
    const b = S.welcome.body;
    const brand = frame({ name: 'brand', dir: 'H', gap: 12, align: 'CENTER' });
    add(b, brand);
    add(brand, await milestone('NH', '44', 56));
    add(brand, await text('RouteGuard', 'display'));
    add(b, wrapText(await text('Know before you load: where NH-44 may close in the next 48 hours, and what to do with your lot.', 'body')), true);
    const gets = frame({ name: 'what you get', dir: 'V', gap: 10, pad: [12, 12, 12, 12], fill: 'bg.elevated', stroke: 'border.default', radius: 6 });
    add(b, gets, true);
    for (const [ic, line] of [['nav-strip', 'Risk for each of the 6 zones, from now to 48 hours ahead'], ['nav-advisor', 'One answer for your lot: send, hold, rail or divert'], ['status-offline-queue', 'Works in the gorge with no signal']]) {
      const row = frame({ name: 'gets/' + ic, dir: 'H', gap: 10, align: 'MIN' });
      add(gets, row, true);
      add(row, icon(ic, 'brand.highway', 24));
      add(row, wrapText(await text(line, 'body')), true);
    }
    await field(b, 'Mobile number', '+91   98765 43210', { focus: true });
    add(b, wrapText(await text('No password. We send a 6-digit code to this number by SMS.', 'body', 'text.secondary')), true);
    S.welcomeGo = await button('Send code', 'brand.highway', 'text.inverse');
    add(b, S.welcomeGo, true);
  }
  S.otp = await bare(page, 'A2 OTP check', at(1, 0));
  {
    const b = S.otp.body;
    S.otpBack = await button('\u2190 Change number', 'bg.canvas', 'brand.highway');
    add(b, S.otpBack); S.otpBack.layoutSizingHorizontal = 'HUG';
    add(b, await text('Enter the 6-digit code', 'h1'));
    add(b, wrapText(await text('Sent by SMS to +91 98765 x3210.', 'body', 'text.secondary')), true);
    const boxes = frame({ name: 'code boxes', dir: 'H', gap: 8 });
    add(b, boxes, true);
    for (const d of ['4', '1', '8', '2', '', '']) {
      const c = frame({ name: 'digit', dir: 'H', h: 56, fill: 'bg.elevated', stroke: d ? 'text.primary' : 'border.strong', strokeWeight: d ? 2 : 1, radius: 6, align: 'CENTER', justify: 'CENTER' });
      add(boxes, c, true);
      if (d) add(c, await text(d, 'data', 'text.primary', { size: 24 }));
    }
    const err = frame({ name: 'error (example)', dir: 'H', gap: 8, pad: [8, 12, 8, 12], fill: 'high.bg', radius: 6, align: 'CENTER' });
    add(b, err, true);
    add(err, wrapText(await text('That code has expired. Send a new code; your number is kept.', 'body', 'high.text', { weight: 700 })), true);
    S.otpGo = await button('Verify', 'brand.highway', 'text.inverse');
    add(b, S.otpGo, true);
    add(b, await text('Send a new code in 0:24', 'body', 'text.secondary'));
  }
  S.create = await bare(page, 'A3 Create account + consent', at(2, 0));
  {
    const b = S.create.body; b.itemSpacing = 10;
    add(b, await text('Create your account', 'h1'));
    await field(b, 'Full name', 'Gurpreet Singh');
    add(b, await text('I am a', 'label', 'text.secondary'));
    const roles = frame({ name: 'role cards', dir: 'H', gap: 8 });
    add(b, roles, true);
    for (const [r, on] of [['Grower / trader', false], ['Transport agent', false], ['Truck driver', true]]) {
      const c = frame({ name: 'role/' + r, dir: 'V', h: 56, pad: [4, 6, 4, 6], fill: on ? 'send.bg' : 'bg.elevated', stroke: on ? 'brand.highway' : 'border.strong', strokeWeight: on ? 2 : 1, radius: 6, align: 'CENTER', justify: 'CENTER' });
      add(roles, c, true);
      add(c, wrapText(await text(r, 'body', 'text.primary', { weight: 700, align: 'CENTER' })), true);
    }
    await field(b, 'Truck number', 'JK05 G 7712');
    await field(b, "Your agent's phone", '70061 22290');
    add(b, await text('You choose what we use', 'label', 'text.secondary'));
    await toggleRow(b, 'Location, to tag your reports', true);
    await toggleRow(b, 'Alerts for zones on your route', true);
    add(b, wrapText(await text('\u25b8 What we keep, and for how long', 'body', 'brand.highway', { weight: 700 })), true);
    S.createGo = await button('Create account', 'brand.highway', 'text.inverse');
    add(b, S.createGo, true);
    add(b, wrapText(await text('Police and TCU accounts are added by an admin.', 'body', 'text.secondary')), true);
  }

  // ---------------- Flow A: grower plans a lot (row 1)
  await rowLabel(page, 'A', 'Grower plans a lot', 'Map, zone sheet, advisor form, advice card, then the truck lands on the agent board.', 1);
  S.map = await screen(page, 'M1 Risk map', at(0, 1), 'Risk map', 'Grower / Trader', 'Map', sets);
  {
    const b = S.map.body;
    const chips = frame({ name: 'horizon chips', dir: 'H', gap: 8 });
    add(b, chips);
    for (const h of ['Now', '+12 h', '+24 h', '+48 h']) add(chips, await button(h, h === '+24 h' ? 'text.primary' : 'bg.elevated', h === '+24 h' ? 'text.inverse' : 'text.primary', 'border.strong'));
    const map = frame({ name: 'map (hex cells by zone, replay 25 Aug 2025 +24 h)', w: 358, h: 300, fill: 'bg.map', radius: 6, clip: true });
    add(b, map);
    for (let z = 1; z <= 6; z++) {
      const r = replayRow(z, 24);
      for (let k = 0; k < 6; k++) {
        const hx = figma.createPolygon(); hx.pointCount = 6; hx.resize(16, 16);
        hx.fills = [solid({ low: 'risk.low.map', medium: 'risk.medium.map', high: 'risk.high.map' }[r[2]])];
        hx.strokes = [solid('bg.elevated')]; hx.strokeWeight = 1;
        map.appendChild(hx); hx.x = 150 + Math.round(Math.sin((z * 6 + k) / 5) * 30) + (k % 2) * 14; hx.y = 270 - (z - 1) * 46 - k * 7;
        hx.name = 'zone ' + z;
      }
      const lab = await text('Z' + z + ' ' + ZN[z], 'label', 'text.primary'); map.appendChild(lab); lab.x = 220; lab.y = 268 - (z - 1) * 46 - 18;
    }
    const zrow = frame({ name: 'zone cards', dir: 'V', gap: 8 });
    add(b, zrow, true);
    const r4 = replayRow(4, 24);
    S.mapZoneCard = variant(sets.zone, { RiskLevel: LVTOK[r4[2]], Confidence: LVTOK[r4[4]] });
    add(zrow, S.mapZoneCard);
    add(zrow, variant(sets.pill, { Source: 'Police Official' }));
  }
  S.sheet = frame({ name: 'O1 Zone sheet (overlay)', dir: 'V', gap: 12, pad: [8, 16, 24, 16], w: 390, fill: 'bg.elevated', radius: 10 });
  place(page, S.sheet, at(1, 1)[0], at(1, 1)[1] + 200);
  {
    add(S.sheet, rect(40, 4, 'border.strong', 2)); S.sheet.counterAxisAlignItems = 'MIN';
    const head = frame({ name: 'head', dir: 'H', justify: 'SPACE_BETWEEN', align: 'CENTER' });
    add(S.sheet, head, true);
    add(head, await text('Zone 4 \u00b7 +24 h', 'h2'));
    S.sheetClose = await button('Close', 'bg.elevated', 'text.primary', 'border.strong');
    add(head, S.sheetClose);
    const r = replayRow(4, 24);
    add(S.sheet, variant(sets.zone, { RiskLevel: LVTOK[r[2]], Confidence: LVTOK[r[4]] }));
    add(S.sheet, wrapText(await text('Replay 25 Aug 2025: ' + r[5], 'body')), true);
    add(S.sheet, wrapText(await text('Past closure here: 2019-05-09 Digdol, landslide, closed 48 h, 500 trucks (incidents.csv)', 'body', 'text.secondary')), true);
    S.sheetPlan = await button('Plan a lot through this zone', 'brand.highway', 'text.inverse');
    add(S.sheet, S.sheetPlan, true);
  }
  S.form = await screen(page, 'M3 Advisor form', at(2, 1), 'Dispatch advisor', 'Grower / Trader', 'Advisor', sets);
  {
    const b = S.form.body;
    for (const [lab, val] of [['Variety', 'Delicious'], ['Days since picking', '12'], ['Tonnes', '10'], ['Destination', '\u25c9 Azadpur (Delhi)   \u25cb Narwal   \u25cb Parimpora'], ['Truck', '\u25c9 Multi-axle   \u25cb Light 6-wheeler'], ['Truck number', 'JK05 G 7712']]) await field(b, lab, val);
    S.formGo = await button('Get advice', 'brand.highway', 'text.inverse');
    add(b, S.formGo, true);
  }
  S.advice = await screen(page, 'M4 Advice card (RAIL)', at(3, 1), 'Dispatch advisor', 'Grower / Trader', 'Advisor', sets);
  {
    const b = S.advice.body;
    add(b, variant(sets.decision, { Advice: 'RAIL' }));
    const r = replayRow(4, 24);
    add(b, variant(sets.zone, { RiskLevel: LVTOK[r[2]], Confidence: LVTOK[r[4]] }));
    add(b, wrapText(await text('10 t Delicious, 12 days since picking (57% of a placeholder 21-day shelf life). Priority 3.43.', 'body', 'text.secondary')), true);
    S.adviceCommit = await button('Commit JK05 G 7712 to board', 'brand.highway', 'text.inverse');
    add(b, S.adviceCommit, true);
  }
  S.board = await screen(page, 'M5 Shipment board', at(4, 1), 'Shipment board', 'Transport Agent', 'Board', sets);
  {
    const b = S.board.body;
    const tabs = frame({ name: 'filter', dir: 'H', gap: 8 });
    add(b, tabs, true);
    for (const [t, on] of [['All', true], ['Moving', false], ['Held', false]]) add(tabs, await button(t, on ? 'text.primary' : 'bg.elevated', on ? 'text.inverse' : 'text.primary', 'border.strong'), true);
    add(b, wrapText(await text('Ranked by priority = spoilage \u00d7 load value. Tap a truck for its detail.', 'body', 'text.secondary')), true);
    const TRUCKS = [
      [1, 'JK13 D 0921', 'SEND', '9 t Ambri to Parimpora \u00b7 4.11', 'Pulwama, 25 min ago', 'about 2 h'],
      [2, 'JK22 C 8810', 'RAIL', '8 t Kullu Delicious to Azadpur \u00b7 3.67', 'Sopore, 40 min ago', 'by parcel train from Budgam'],
      [3, 'JK03 F 2214', 'RAIL', '10 t Delicious to Azadpur \u00b7 3.43', 'Budgam, 14 min ago', 'by parcel train from Budgam'],
      [4, 'JK05 G 7712', 'RAIL', '10 t Delicious to Azadpur \u00b7 3.43', 'At the orchard, not left yet', 'by parcel train from Budgam'],
    ];
    for (const [i, truck, adv, lot, seen, eta] of TRUCKS) {
      const mine = truck === 'JK05 G 7712';
      const card = frame({ name: 'truck ' + truck, dir: 'V', gap: 2, pad: [8, 12, 8, 12], fill: 'bg.elevated', stroke: mine ? 'brand.highway' : 'border.default', strokeWeight: mine ? 2 : 1, radius: 6 });
      add(b, card, true);
      const top = frame({ name: 'top', dir: 'H', gap: 8, align: 'CENTER' });
      add(card, top, true);
      add(top, await badge('#' + i, 'text.primary', 'text.inverse'));
      add(top, await text(truck, 'data', 'text.primary', { weight: 700 }));
      add(top, await badge(adv, ADVICE[adv].tok + '.bg', ADVICE[adv].tok + '.text'));
      if (mine) add(top, await badge('just committed', 'send.bg', 'send.text'));
      add(card, wrapText(await text(lot, 'body', 'text.secondary')), true);
      add(card, wrapText(await text('Last seen: ' + seen, 'body')), true);
      add(card, wrapText(await text('ETA: ' + eta, 'body')), true);
      if (mine) S.boardCard = card;
    }
  }
  // O3: truck detail, a bottom sheet over the board
  S.ship = frame({ name: 'O3 Truck detail (overlay)', dir: 'V', gap: 10, pad: [8, 16, 20, 16], w: 390, fill: 'bg.elevated', radius: 10 });
  place(page, S.ship, at(5, 1)[0], at(5, 1)[1] + 60);
  {
    add(S.ship, rect(40, 4, 'border.strong', 2)); S.ship.counterAxisAlignItems = 'MIN';
    const head = frame({ name: 'head', dir: 'H', justify: 'SPACE_BETWEEN', align: 'CENTER' });
    add(S.ship, head, true);
    add(head, await text('JK05 G 7712 \u00b7 #4', 'h2'));
    S.shipClose = await button('Close', 'bg.elevated', 'text.primary', 'border.strong');
    add(head, S.shipClose);
    add(S.ship, variant(sets.decision, { Advice: 'RAIL' }));
    const dl = frame({ name: 'details', dir: 'V', gap: 4 });
    add(S.ship, dl, true);
    for (const [k, v] of [['Lot', '10 t Delicious, picked 12 days ago'], ['Going to', 'Azadpur (Delhi)'], ['Last seen', 'At the orchard, not left yet'], ['ETA', 'by parcel train from Budgam'], ['Expected delay', '+24 h by road, rail avoids it'], ['Priority', '3.43 (57% shelf life \u00d7 Rs 6.0 lakh)'], ['Driver', '98\u2022\u2022 \u2022\u2022\u2022 521']]) {
      const row = frame({ name: 'kv/' + k, dir: 'H', gap: 8 });
      add(dl, row, true);
      const kt = await text(k, 'label', 'text.secondary'); kt.resize(112, kt.height); kt.textAutoResize = 'HEIGHT';
      add(row, kt);
      add(row, wrapText(await text(v, 'body')), true);
    }
    add(S.ship, await text('Zones on this route', 'label', 'text.secondary'));
    for (let z = 1; z <= 6; z++) {
      const row = frame({ name: 'zone ' + z, dir: 'H', gap: 4, align: 'CENTER' });
      add(S.ship, row, true);
      const zl = await text(z + ' ' + ZN[z], 'body'); zl.resize(96, zl.height); zl.textAutoResize = 'HEIGHT';
      add(row, zl);
      for (const h of [0, 24, 48]) {
        const r = replayRow(z, h);
        const L = LEVEL[LVTOK[r[2]]];
        const cell = frame({ name: 'cell ' + h, dir: 'H', gap: 6, h: 32, fill: L.bg, radius: 2, align: 'CENTER', justify: 'CENTER' });
        add(row, cell, true);
        add(cell, await text(r[3].toFixed(2), 'data', L.text, { weight: 700 }));
        add(cell, await text(r[2] === 'medium' ? 'med' : r[2], 'label', L.text));
      }
    }
    add(S.ship, await button('Call the driver', 'brand.highway', 'text.inverse'), true);
  }
  S.strip = await screen(page, 'M2 48-hour strip', at(6, 1), '48-hour strip', 'Grower / Trader', '48h Strip', sets);
  {
    const b = S.strip.body;
    add(b, wrapText(await text('Worst on the route: zone 4 (Ramban) is high now.', 'body', 'text.primary', { weight: 700 })), true);
    for (let z = 1; z <= 6; z++) {
      const row = frame({ name: 'zone ' + z, dir: 'H', gap: 4, align: 'CENTER' });
      add(b, row, true);
      const zl = await text(z + ' ' + ZN[z], 'body'); zl.resize(84, zl.height); zl.textAutoResize = 'HEIGHT';
      add(row, zl);
      for (const h of [0, 12, 24, 48]) {
        const r = replayRow(z, h);
        const L = LEVEL[LVTOK[r[2]]];
        const cell = frame({ name: 'cell ' + h, dir: 'V', gap: 0, h: 56, fill: L.bg, radius: 2, align: 'CENTER', justify: 'CENTER' });
        add(row, cell, true);
        add(cell, await text(r[3].toFixed(2), 'data', L.text, { weight: 700 }));
        add(cell, await text(r[2] === 'medium' ? 'med' : r[2], 'label', L.text));
      }
    }
  }

  // ---------------- Flow B: driver reports offline (row 2)
  await rowLabel(page, 'B', 'Driver reports a hazard offline', 'Three taps: what, where, send. With no signal the report waits on the phone and the banner counts it.', 2);
  S.rep1 = await screen(page, 'M6 Report 1 \u00b7 what', at(0, 2), 'Report a hazard', 'Truck Driver', 'Report', sets, 'Offline Cached <5KB');
  {
    const b = S.rep1.body;
    add(b, await text('What did you see?', 'h2'));
    const grid = frame({ name: 'hazards', dir: 'H', gap: 12, w: 358 });
    grid.layoutWrap = 'WRAP'; grid.counterAxisSpacing = 12;
    add(b, grid);
    S.rep1Buttons = [];
    for (const [k, lab] of [['hazard-landslide', 'Landslide'], ['hazard-rockfall', 'Rockfall'], ['hazard-flash-flood', 'Flash flood'], ['hazard-snow-ice', 'Snow / ice']]) {
      const hb = frame({ name: 'hazard/' + lab, dir: 'V', gap: 8, w: 173, h: 112, fill: 'bg.elevated', stroke: 'border.strong', strokeWeight: 2, radius: 10, align: 'CENTER', justify: 'CENTER' });
      add(grid, hb);
      add(hb, icon(k, 'text.primary', 40));
      add(hb, await text(lab, 'body', 'text.primary', { weight: 700, size: 16 }));
      S.rep1Buttons.push(hb);
    }
    add(b, wrapText(await text('No signal right now. Your report will wait on this phone and send by itself.', 'body')), true);
  }
  S.rep2 = await screen(page, 'M7 Report 2 \u00b7 where', at(1, 2), 'Report a hazard', 'Truck Driver', 'Report', sets, 'Offline Cached <5KB');
  {
    const b = S.rep2.body;
    add(b, await text('Rockfall: where?', 'h2'));
    add(b, frame({ name: 'photo (optional)', h: 140, fill: 'border.default', radius: 6 }), true);
    add(b, await text('33.30284, 75.17981 \u00b7 near Digdol, zone 4', 'data'));
    S.rep2Go = await button('This is the place', 'brand.apple.ink', 'text.inverse');
    add(b, S.rep2Go, true);
  }
  S.rep3 = await screen(page, 'M8 Report 3 \u00b7 send', at(2, 2), 'Report a hazard', 'Truck Driver', 'Report', sets, 'Offline Cached <5KB');
  {
    const b = S.rep3.body;
    add(b, await text('Send this report?', 'h2'));
    add(b, variant(sets.pill, { Source: 'Unconfirmed Driver' }));
    add(b, wrapText(await text('It shows as unconfirmed until police or a second driver confirms it.', 'body', 'text.secondary')), true);
    S.rep3Go = await button('Save and send when online', 'brand.apple.ink', 'text.inverse');
    add(b, S.rep3Go, true);
  }
  S.queued = await screen(page, 'M9 Map with queued report', at(3, 2), 'Risk map', 'Truck Driver', 'Map', sets, 'Syncing Queued Report (2)');
  add(S.queued.body, wrapText(await text('Saved on this phone. It sends when you have signal.', 'body', 'text.primary', { weight: 700 })), true);
  S.drawer = frame({ name: 'O2 Offline drawer (overlay)', dir: 'V', gap: 12, pad: [8, 16, 24, 16], w: 390, fill: 'bg.elevated', radius: 10 });
  place(page, S.drawer, at(4, 2)[0], at(4, 2)[1] + 300);
  {
    add(S.drawer, rect(40, 4, 'border.strong', 2));
    const head = frame({ name: 'head', dir: 'H', justify: 'SPACE_BETWEEN', align: 'CENTER' });
    add(S.drawer, head, true);
    add(head, await text('Offline and sync', 'h2'));
    S.drawerClose = await button('Close', 'bg.elevated', 'text.primary', 'border.strong');
    add(head, S.drawerClose);
    add(S.drawer, wrapText(await text('24 zone scores cached on this phone \u00b7 under 5 KB, so it loads on 2G', 'body')), true);
    add(S.drawer, variant(sets.pill, { Source: 'Unconfirmed Driver' }));
    add(S.drawer, await button('Send now', 'brand.highway', 'text.inverse'), true);
  }

  // ---------------- Flow C: police closure (row 3)
  await rowLabel(page, 'C', 'Police publish a closure', 'The TCU console sets the zone, asks once to confirm, then alerts every driver routed through it.', 3);
  S.tcu = await screen(page, 'M10 TCU console', at(0, 3), 'TCU console', 'Traffic Police (TCU)', 'Report', sets);
  {
    const b = S.tcu.body;
    for (const [lab, val] of [['Zone', 'Zone 4 \u00b7 Ramban \u2192 Ramsoo'], ['Road status', '\u25c9 Closed both ways'], ['Cause', 'Landslide']]) await field(b, lab, val);
    S.tcuGo = await button('Publish and alert drivers in the zone', 'brand.rail', 'text.inverse');
    add(b, S.tcuGo, true);
    add(b, await text('Driver reports waiting (1)', 'label', 'text.secondary'));
    add(b, variant(sets.pill, { Source: 'Unconfirmed Driver' }));
  }
  S.publish = await dialog(page, 'O5 Confirm publish (overlay)', [at(1, 3)[0] + 24, at(1, 3)[1] + 260], 'Publish this advisory?',
    'Zone 4 \u00b7 Ramban \u2192 Ramsoo: closed both ways. Cause: landslide. 3 drivers routed through this zone get a push alert now.', 'Publish', 'brand.rail');
  S.alerts = await screen(page, 'M11 Alerts inbox', at(2, 3), 'Alerts', 'Truck Driver', 'Map', sets, null, true);
  {
    const b = S.alerts.body;
    add(b, wrapText(await text('For zones 3, 4, 5. Tap an alert to see the zone.', 'body', 'text.secondary')), true);
    const items = [
      ['rail', true, 'Police: zone 4 closed both ways', 'Landslide \u00b7 Ramban \u00b7 just now'],
      ['send', true, 'Landslide confirmed at Seri', 'Verified driver report, zone 3 \u00b7 70 min ago'],
      ['high', false, 'Zone 3 is high risk now', 'Nashri \u2192 Ramban \u00b7 medium confidence'],
      ['high', false, 'Zone 5 is high risk now', 'Ramsoo \u2192 Qazigund \u00b7 medium confidence'],
    ];
    S.alertItems = [];
    for (const [tok, isNew, head, sub] of items) {
      const c = frame({ name: 'alert/' + head, dir: 'H', gap: 0, fill: tok + '.bg', radius: 6, clip: true });
      add(b, c, true);
      const edge = rect(6, 10, tok + '.fill'); add(c, edge); edge.layoutSizingVertical = 'FILL';
      const t = frame({ name: 'text', dir: 'V', gap: 2, pad: [10, 12, 10, 12] });
      add(c, t, true);
      if (isNew) add(t, await badge('New', 'text.primary', 'text.inverse'));
      add(t, wrapText(await text(head, 'body', tok + '.text', { weight: 700 })), true);
      add(t, wrapText(await text(sub, 'body', 'text.primary')), true);
      S.alertItems.push(c);
    }
  }

  // ---------------- Account (row 4)
  await rowLabel(page, 'E', 'Profile and settings', 'Alert zones, offline data, sign out and delete account. Opens from the round badge on every screen. Both exits ask first.', 4);
  S.profile = await screen(page, 'M12 Profile and settings', at(0, 4), 'Profile and settings', 'Truck Driver', 'Map', sets, null, true);
  {
    const b = S.profile.body;
    const who = frame({ name: 'who', dir: 'H', gap: 12, pad: 12, fill: 'bg.elevated', stroke: 'border.default', radius: 6, align: 'CENTER' });
    add(b, who, true);
    const av = frame({ name: 'avatar', dir: 'H', w: 56, h: 56, radius: 28, fill: 'brand.milestone', align: 'CENTER', justify: 'CENTER' });
    add(who, av);
    add(av, await text('GS', 'h2', 'text.primary', { weight: 700 }));
    const wt = frame({ name: 'name', dir: 'V', gap: 4 });
    add(who, wt, true);
    add(wt, await text('Gurpreet Singh', 'h2'));
    add(wt, await text('+91 98765 x4521', 'data', 'text.secondary'));
    const tags = frame({ name: 'tags', dir: 'H', gap: 6 });
    add(wt, tags, true); tags.layoutWrap = 'WRAP'; tags.counterAxisSpacing = 6;
    add(tags, await badge('Truck driver', 'bg.surface', 'text.primary'));
    add(tags, await badge('Verified by your agent', 'send.bg', 'send.text'));
    add(b, await text('Alert zones', 'label', 'text.secondary'));
    const chips = frame({ name: 'alert zone chips', dir: 'H', gap: 8, w: 358 });
    chips.layoutWrap = 'WRAP'; chips.counterAxisSpacing = 8;
    add(b, chips);
    for (let z = 1; z <= 6; z++) {
      const on = z >= 3 && z <= 5;
      add(chips, await button('Z' + z + ' ' + ZN[z], on ? 'text.primary' : 'bg.elevated', on ? 'text.inverse' : 'text.primary', 'border.strong'));
    }
    const off = frame({ name: 'offline data', dir: 'V', gap: 2, pad: 12, fill: 'bg.elevated', stroke: 'border.default', radius: 6 });
    add(b, off, true);
    add(off, await text('Offline data', 'label', 'text.secondary'));
    add(off, wrapText(await text('0.8 KB on this phone \u00b7 scores from the 25 Aug 2025 06:00 UTC run', 'body')), true);
    S.signOut = await button('Sign out', 'bg.elevated', 'text.primary', 'border.strong');
    add(b, S.signOut, true);
    S.deleteBtn = await button('Delete my account', 'bg.elevated', 'brand.apple.ink', 'brand.apple.ink');
    add(b, S.deleteBtn, true);
    add(b, wrapText(await text('Unsent reports stay on this phone and still send after you sign out.', 'body', 'text.secondary')), true);
  }
  S.signOutDlg = await dialog(page, 'O4 Confirm sign out (overlay)', [at(1, 4)[0] + 24, at(1, 4)[1] + 120], 'Sign out?',
    '1 report is still waiting to send. It stays on this phone and sends when you have signal.', 'Sign out', 'brand.highway');
  S.deleteDlg = await dialog(page, 'O6 Confirm delete (overlay)', [at(1, 4)[0] + 24, at(1, 4)[1] + 460], 'Delete your account?',
    'Your name, phone number and trucks are erased within 30 days. Road reports you sent stay on the map without your name, so other drivers keep the warning. This cannot be undone.', 'Delete account', 'brand.apple.ink');

  // ---------------- Desktop (row 5)
  await rowLabel(page, 'PC', 'Desktop control room', 'Transport agents and TCU police at 1440 x 900.', 5);
  S.desk = frame({ name: 'D1 Control room (desktop)', w: 1440, h: 900, fill: 'bg.canvas', clip: true });
  place(page, S.desk, at(0, 5)[0], at(0, 5)[1]);
  {
    const head = frame({ name: 'header', dir: 'H', gap: 16, pad: [0, 24, 0, 24], w: 1440, h: 64, fill: 'brand.highway', align: 'CENTER', justify: 'SPACE_BETWEEN' });
    S.desk.appendChild(head);
    const left = frame({ name: 'brand', dir: 'H', gap: 12, align: 'CENTER' });
    add(head, left);
    add(left, await milestone('NH', '44', 40));
    add(left, await text('RouteGuard control room', 'h1', 'text.inverse'));
    const ds = variant(sets.sync, { State: 'Online Live' }); add(head, ds);
    const cols = frame({ name: 'columns', dir: 'H', gap: 16, pad: 16, w: 1440, h: 836 });
    S.desk.appendChild(cols); cols.y = 64;
    const c1 = frame({ name: 'map column', dir: 'V', gap: 12, pad: 16, w: 520, fill: 'bg.elevated', stroke: 'border.default', radius: 6 });
    add(cols, c1); c1.layoutSizingVertical = 'FILL';
    add(c1, await text('Risk map', 'label', 'text.secondary'));
    add(c1, frame({ name: 'map', h: 620, fill: 'bg.map', radius: 6 }), true);
    const c2 = frame({ name: 'strip + board column', dir: 'V', gap: 12, pad: 16, fill: 'bg.elevated', stroke: 'border.default', radius: 6 });
    add(cols, c2, true); c2.layoutSizingVertical = 'FILL';
    add(c2, await text('48-hour strip and shipment board', 'label', 'text.secondary'));
    add(c2, variant(sets.decision, { Advice: 'RAIL' }));
    add(c2, variant(sets.zone, { RiskLevel: 'High', Confidence: 'Medium' }));
    const c3 = frame({ name: 'reports column', dir: 'V', gap: 12, pad: 16, w: 380, fill: 'bg.elevated', stroke: 'border.default', radius: 6 });
    add(cols, c3); c3.layoutSizingVertical = 'FILL';
    add(c3, await text('Road reports', 'label', 'text.secondary'));
    for (const src of Object.keys(SOURCE)) add(c3, variant(sets.pill, { Source: src }));
  }

  // ---- arrows on the canvas: which screen leads to which
  const R = n => [n.x + n.width, n.y + Math.min(n.height, 844) / 2];   // right middle
  const L = n => [n.x, n.y + Math.min(n.height, 844) / 2];              // left middle
  const mid = (a, b) => (a + b) / 2;
  async function right(a, b, label) {     // a -> b in the same row
    const p = R(a), q = L(b);
    if (Math.abs(p[1] - q[1]) < 1) return arrow(page, [p, q], label);
    const x = mid(p[0], q[0]);
    return arrow(page, [p, [x, p[1]], [x, q[1]], q], label, 1);
  }
  await right(S.welcome.f, S.otp.f, 'Send code');
  await right(S.otp.f, S.create.f, 'Verify: new user');
  { // returning user and new user both land on the map (row below)
    const a = S.create.f, o = S.otp.f, m = S.map.f;
    const y = a.y + a.height + 130;
    await arrow(page, [[a.x + a.width / 2, a.y + a.height], [a.x + a.width / 2, y], [m.x + 255, y], [m.x + 255, m.y]], 'Create account', 1);
    await arrow(page, [[o.x + o.width / 2, o.y + o.height], [o.x + o.width / 2, y - 60], [m.x + 135, y - 60], [m.x + 135, m.y]], 'Verify: account exists', 1);
  }
  await right(S.map.f, S.sheet, 'Tap zone card');
  await right(S.sheet, S.form.f, 'Plan a lot');
  await right(S.form.f, S.advice.f, 'Get advice');
  await right(S.advice.f, S.board.f, 'Commit');
  await right(S.board.f, S.ship, 'Tap your truck');
  { // the 48h tab, drawn over the top of the truck sheet
    const a = S.board.f, z = S.strip.f, y = a.y - 70;
    await arrow(page, [[a.x + a.width / 2, a.y], [a.x + a.width / 2, y], [z.x + z.width / 2, y], [z.x + z.width / 2, z.y]], '48h tab', 1);
  }
  await right(S.rep1.f, S.rep2.f, 'Tap 1: hazard');
  await right(S.rep2.f, S.rep3.f, 'Tap 2: place');
  await right(S.rep3.f, S.queued.f, 'Tap 3: send');
  await right(S.queued.f, S.drawer, 'Tap the banner');
  await right(S.tcu.f, S.publish.f, 'Publish');
  await right(S.publish.f, S.alerts.f, 'Driver gets the alert');
  { // profile: each exit asks first; after Sign out it goes back to the welcome screen (top row), along the left margin
    const p = S.profile.f, w = S.welcome.f, mx = p.x + p.width + (S.signOutDlg.f.x - p.x - p.width) / 2;
    for (const [d, y0, lab] of [[S.signOutDlg.f, p.y + 470, 'Sign out'], [S.deleteDlg.f, p.y + 530, 'Delete']]) {
      const yd = d.y + d.height / 2;
      await arrow(page, [[p.x + p.width, y0], [mx, y0], [mx, yd], [d.x, yd]], lab, 2);
    }
    await arrow(page, [[p.x, p.y + 640], [p.x - 80, p.y + 640], [p.x - 80, w.y + 422], [w.x, w.y + 422]], 'Sign out \u00b7 OK', 1);
  }

  // ---- click links (prototype reactions)
  const navTargets = { Map: S.map.f, '48h Strip': S.strip.f, Advisor: S.form.f, Board: S.board.f, Report: S.rep1.f };
  const screens = [S.map, S.strip, S.form, S.advice, S.board, S.rep1, S.rep2, S.rep3, S.queued, S.tcu, S.alerts, S.profile];
  for (const s of screens) {
    TABS.forEach(([tab], i) => { s.navHot = s.navHot || []; s.navHot.push([hotspot(s.f, i * 78, 780, 78, 64, 'nav ' + tab), navTargets[tab]]); });
    s.syncHot = hotspot(s.f, 0, 64, 390, 48, 'sync banner');
  }
  for (const s of screens) {
    for (const [h, dest] of s.navHot) await link(h, dest, 'NAVIGATE');
    await link(s.syncHot, S.drawer, 'OVERLAY');
    await link(s.bell, S.alerts.f, 'NAVIGATE');
    await link(s.me, S.profile.f, 'NAVIGATE');
    if (s.back) await link(s.back, S.map.f, 'NAVIGATE');
  }
  await link(S.welcomeGo, S.otp.f, 'NAVIGATE');
  await link(S.otpGo, S.create.f, 'NAVIGATE');
  await link(S.otpBack, S.welcome.f, 'NAVIGATE');
  await link(S.createGo, S.map.f, 'NAVIGATE');
  await link(S.mapZoneCard, S.sheet, 'OVERLAY');
  await link(S.sheetClose, null, 'CLOSE');
  await link(S.sheetPlan, S.form.f, 'NAVIGATE');
  await link(S.drawerClose, null, 'CLOSE');
  await link(S.formGo, S.advice.f, 'NAVIGATE');
  await link(S.adviceCommit, S.board.f, 'NAVIGATE');
  await link(S.boardCard, S.ship, 'OVERLAY');
  await link(S.shipClose, null, 'CLOSE');
  for (const hb of S.rep1Buttons) await link(hb, S.rep2.f, 'NAVIGATE');
  await link(S.rep2Go, S.rep3.f, 'NAVIGATE');
  await link(S.rep3Go, S.queued.f, 'NAVIGATE');
  await link(S.tcuGo, S.publish.f, 'DIALOG');
  await link(S.publish.ok, S.alerts.f, 'NAVIGATE');
  await link(S.publish.cancel, null, 'CLOSE');
  await link(S.alertItems[0], S.sheet, 'OVERLAY');
  await link(S.signOut, S.signOutDlg.f, 'DIALOG');
  await link(S.signOutDlg.ok, S.welcome.f, 'NAVIGATE');
  await link(S.signOutDlg.cancel, null, 'CLOSE');
  await link(S.deleteBtn, S.deleteDlg.f, 'DIALOG');
  await link(S.deleteDlg.ok, S.welcome.f, 'NAVIGATE');
  await link(S.deleteDlg.cancel, null, 'CLOSE');
  page.flowStartingPoints = [
    { nodeId: S.welcome.f.id, name: 'Flow D: first sign-in' },
    { nodeId: S.map.f.id, name: 'Flow A: plan a lot (grower)' },
    { nodeId: S.rep1.f.id, name: 'Flow B: report offline (driver)' },
    { nodeId: S.tcu.f.id, name: 'Flow C: official closure (TCU)' },
  ];
  const note = await text('Mobile frames are 390 x 844, desktop 1440 x 900. Each row is one user flow; the black arrows show which screen leads to which (press Play for the clickable version). Zone numbers are from our replay of 25 Aug 2025 (rules-v0.1 on archived weather). Names are our four personas; phones and trucks are sample data. The overlays (O1 to O6) open from the screens next to them.', 'body', 'text.secondary');
  note.resize(1800, note.height); note.textAutoResize = 'HEIGHT';
  place(page, note, -600, 0);
}

// ------------------------------------------------------------------ main
async function main() {
  const startPage = figma.currentPage;
  if (startPage.children.length === 0) REUSE = startPage; // the blank "Page 1" of a new file
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await buildTokens();
  const p1 = await newPage('01_Style_Guide_&_Variables');
  await buildStyleGuide(p1);
  const p2 = await newPage('02_Components_&_Variants');
  const sets = await buildComponents(p2);
  const p3 = await newPage('03_Low_Fi_Wireframes');
  await buildWireframes(p3);
  const p4 = await newPage('04_High_Fi_Prototype_Mobile_&_Desktop');
  await buildPrototype(p4, sets);
  const built = p4.children.map(n => n.name);
  const count = re => built.filter(n => re.test(n)).length;
  await figma.setCurrentPageAsync(p1);
  const msg = 'RouteGuard file built: ' + PAGES.length + ' pages' + (MERGED ? ' (free plan: 3-page limit, so some sections share a page)' : '') + ', ' + Object.keys(VARS).length + ' variables, 5 component sets, ' + count(/^[AM]\d+ /) + ' phone screens, ' + count(/^O\d+ /) + ' overlays, ' + count(/^D\d+ /) + ' desktop, ' + ARROWS + ' flow arrows.' +
    (fallbacks.length ? ' Font fallbacks: ' + fallbacks.join(', ') : '');
  figma.closePlugin(msg);
}

main().catch(e => {
  console.error('RouteGuard plugin failed:', e && e.stack ? e.stack : e);
  figma.closePlugin('RouteGuard plugin failed: ' + (e && e.message ? e.message : e));
});
