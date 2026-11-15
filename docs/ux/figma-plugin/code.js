// RouteGuard Round 2: builds our Figma design file from the same tokens as the style guide and prototype.
// Run it once in an empty Figma design file (Plugins > Development > Import plugin from manifest).
// It creates 4 pages:
//   01_Style_Guide_&_Variables              variable collection, text styles, swatches with WCAG ratios, icons
//   02_Components_&_Variants                5 component sets with variants and auto-layout
//   03_Low_Fi_Wireframes                    12 grey-box frames, 390 x 844
//   04_High_Fi_Prototype_Mobile_&_Desktop   mobile frames 390 x 844, desktop 1440 x 900, click links
// The DATA block is written by scripts/round2/build.py from docs/ux/data and docs/ux/assets/icons.

/* BUILD:data */
const DATA = {
 "tokens": {
  "color": {
   "bg.canvas": "#FDF8F0",
   "bg.surface": "#F5EDE0",
   "bg.elevated": "#FFFFFF",
   "bg.map": "#EDE4D6",
   "text.primary": "#1E2D3A",
   "text.secondary": "#475569",
   "text.inverse": "#FFFFFF",
   "border.default": "#D8CFC2",
   "border.strong": "#8A7F70",
   "brand.terracotta": "#C85A32",
   "brand.terracotta.ink": "#A9481F",
   "brand.teal": "#2B5B54",
   "brand.ochre": "#B8862D",
   "brand.ochre.ink": "#7A5A12",
   "brand.navy": "#28557A",
   "send.fill": "#1E5631",
   "send.bg": "#DCFCE7",
   "send.text": "#14532D",
   "hold.fill": "#B8862D",
   "hold.bg": "#FEF3C7",
   "hold.text": "#78350F",
   "rail.fill": "#28557A",
   "rail.bg": "#DBEAFE",
   "rail.text": "#1E3A8A",
   "divert.fill": "#C85A32",
   "divert.bg": "#FFEDD5",
   "divert.text": "#7C2D12",
   "high.fill": "#B91C1C",
   "high.bg": "#FEE2E2",
   "high.text": "#7F1D1D",
   "risk.low.map": "#2B5B54",
   "risk.medium.map": "#9A6E1F",
   "risk.high.map": "#B91C1C"
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
   "sm": 4,
   "md": 8,
   "lg": 16,
   "pill": 999
  },
  "touch_min_px": 48,
  "type": {
   "display": {
    "family": "Merriweather",
    "fallback": "Georgia, serif",
    "size": 28,
    "line": 36,
    "weight": 700
   },
   "h1": {
    "family": "Merriweather",
    "fallback": "Georgia, serif",
    "size": 22,
    "line": 30,
    "weight": 700
   },
   "h2": {
    "family": "Inter",
    "fallback": "system-ui, sans-serif",
    "size": 18,
    "line": 24,
    "weight": 600
   },
   "body": {
    "family": "Inter",
    "fallback": "system-ui, sans-serif",
    "size": 14,
    "line": 20,
    "weight": 400
   },
   "input": {
    "family": "Inter",
    "fallback": "system-ui, sans-serif",
    "size": 16,
    "line": 24,
    "weight": 400
   },
   "label": {
    "family": "Inter",
    "fallback": "system-ui, sans-serif",
    "size": 12,
    "line": 16,
    "weight": 600,
    "upper": true,
    "tracking": 0.06
   },
   "data": {
    "family": "JetBrains Mono",
    "fallback": "ui-monospace, Menlo, monospace",
    "size": 14,
    "line": 20,
    "weight": 500
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
    "fg": "brand.terracotta.ink",
    "bg": "bg.canvas",
    "use": "links and accent text",
    "min": 4.5
   },
   {
    "fg": "brand.terracotta.ink",
    "bg": "bg.surface",
    "use": "accent text on cards",
    "min": 4.5
   },
   {
    "fg": "brand.ochre.ink",
    "bg": "bg.canvas",
    "use": "warning text",
    "min": 4.5
   },
   {
    "fg": "text.inverse",
    "bg": "brand.teal",
    "use": "primary button label",
    "min": 7.0
   },
   {
    "fg": "text.inverse",
    "bg": "brand.navy",
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
    "bg": "brand.terracotta.ink",
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
async function loadFont(family, style) {
  const key = family + '|' + style;
  if (FONTS[key]) return FONTS[key];
  try {
    await figma.loadFontAsync({ family, style });
    FONTS[key] = { family, style };
  } catch (e) {
    const alt = { family: 'Inter', style: style === 'Medium' ? 'Medium' : style === 'Bold' ? 'Bold' : 'Regular' };
    await figma.loadFontAsync(alt);
    FONTS[key] = alt;
    fallbacks.push(key);
  }
  return FONTS[key];
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
function icon(name, colorToken, size) {
  const svg = DATA.icons[name].replace(/currentColor/g, T[colorToken || 'text.primary']);
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
async function link(node, dest, kind) {
  const ease = { type: 'EASE_OUT' };
  const action = kind === 'CLOSE' ? { type: 'CLOSE' } : {
    type: 'NODE', destinationId: dest.id, navigation: kind || 'NAVIGATE', preserveScrollPosition: false,
    transition: kind === 'OVERLAY' ? { type: 'MOVE_IN', direction: 'TOP', matchLayers: false, easing: ease, duration: 0.25 }
      : { type: 'DISSOLVE', easing: ease, duration: 0.2 },
  };
  const reactions = [{ trigger: { type: 'ON_CLICK' }, actions: [action] }];
  if (node.setReactionsAsync) await node.setReactionsAsync(reactions);
  else node.reactions = reactions;
}
async function newPage(name) {
  const p = figma.createPage();
  p.name = name;
  await figma.setCurrentPageAsync(p);
  return p;
}
function place(page, node, x, y) { page.appendChild(node); node.x = x; node.y = y; return node; }

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
    s.description = t.family + ' ' + t.size + '/' + t.line + ' ' + t.weight;
    STYLES[name] = s;
  }
  // a decision style, for the one-word answer
  const dfont = await loadFont('Inter', 'Extra Bold');
  const d = figma.createTextStyle();
  d.name = 'RouteGuard/decision'; d.fontName = dfont; d.fontSize = 22; d.lineHeight = { unit: 'PIXELS', value: 28 };
  STYLES.decision = d;
  await loadFont('Inter', 'Semi Bold'); await loadFont('Inter', 'Bold'); await loadFont('Inter', 'Medium');
}

async function buildStyleGuide(page) {
  const root = frame({ name: 'Style guide', dir: 'V', gap: 32, pad: 48, fill: 'bg.canvas', w: 1440 });
  place(page, root, 0, 0);
  add(root, await text('RouteGuard design system', 'display'));
  add(root, wrapText(await text('Tokens from docs/ux/data/tokens.json. Every colour below is a variable in the "RouteGuard tokens" collection; every text style is under RouteGuard/. Ratios use the WCAG 2.1 formula: text needs 4.5:1, decision badges 7:1.', 'body', 'text.secondary')), true);

  add(root, await text('Colour variables', 'h1'));
  const grid = frame({ name: 'Swatches', dir: 'H', gap: 16, w: 1344 });
  grid.layoutWrap = 'WRAP'; grid.counterAxisSpacing = 16;
  add(root, grid);
  for (const name of Object.keys(T)) {
    const onW = ratio(T['text.inverse'], T[name]), onD = ratio(T['text.primary'], T[name]);
    const best = Math.max(onW, onD);
    const tag = best >= 7 ? 'AAA' : best >= 4.5 ? 'AA' : best >= 3 ? 'AA large / UI' : 'fail';
    const card = frame({ name: 'swatch/' + name, dir: 'V', gap: 0, w: 200, fill: 'bg.elevated', stroke: 'border.default', radius: 8, clip: true });
    add(grid, card);
    const chip = frame({ name: 'chip', dir: 'V', pad: 8, w: 200, h: 64, fill: name, justify: 'MAX' });
    add(card, chip);
    add(chip, await text('Aa', 'h2', onW >= onD ? 'text.inverse' : 'text.primary'));
    const meta = frame({ name: 'meta', dir: 'V', gap: 2, pad: 8, w: 200 });
    add(card, meta);
    add(meta, await text(name, 'body', 'text.primary', { weight: 600 }));
    add(meta, await text(T[name] + ' · ' + (onW >= onD ? 'white' : 'ink') + ' ' + best.toFixed(2) + ':1 ' + tag, 'body', 'text.secondary'));
  }

  add(root, await text('Pairs we use', 'h1'));
  const pairs = frame({ name: 'Contrast pairs', dir: 'V', gap: 4, w: 1344 });
  add(root, pairs);
  for (const p of DATA.tokens.contrast_pairs) {
    const r = ratio(T[p.fg], T[p.bg]);
    const row = frame({ name: p.fg + ' on ' + p.bg, dir: 'H', gap: 16, pad: [6, 12, 6, 12], fill: p.bg, radius: 4, w: 1344, align: 'CENTER' });
    add(pairs, row);
    add(row, await text(p.fg + ' on ' + p.bg, 'data', p.fg));
    add(row, wrapText(await text(p.use, 'body', p.bg.indexOf('fill') >= 0 || p.bg.indexOf('teal') >= 0 || p.bg.indexOf('navy') >= 0 || p.bg.indexOf('ink') >= 0 || p.bg === 'text.primary' ? 'text.inverse' : 'text.primary')), true);
    add(row, await text(r.toFixed(2) + ':1 (needs ' + p.min + ':1) ' + (r >= p.min ? 'PASS' : 'FAIL'), 'data', p.fg));
  }

  add(root, await text('Text styles', 'h1'));
  for (const name of Object.keys(DATA.tokens.type)) {
    const t = DATA.tokens.type[name];
    const row = frame({ name: 'type/' + name, dir: 'H', gap: 24, w: 1344, align: 'CENTER' });
    add(root, row);
    const lab = await text(name + ' · ' + t.family + ' ' + t.size + '/' + t.line, 'body', 'text.secondary');
    lab.resize(260, lab.height); lab.textAutoResize = 'HEIGHT';
    add(row, lab);
    add(row, await text(name === 'data' ? '0.70 · range 0.45 to 0.95 · +24 h' : 'Send the lot before Ramban closes', name));
  }

  add(root, await text('Spacing (8 pt grid) and touch', 'h1'));
  for (const k of Object.keys(DATA.tokens.space)) {
    const row = frame({ name: 'space/' + k, dir: 'H', gap: 12, align: 'CENTER' });
    add(root, row);
    add(row, rect(DATA.tokens.space[k] * 4, 16, 'brand.navy', 2));
    add(row, await text('space.' + k + ' = ' + DATA.tokens.space[k] + ' px', 'data', 'text.secondary'));
  }
  add(root, await text('Touch targets are at least ' + DATA.tokens.touch_min_px + ' px.', 'body', 'text.secondary'));

  add(root, await text('Icons (24 px grid, 2 px stroke, round caps)', 'h1'));
  const ig = frame({ name: 'Icons', dir: 'H', gap: 16, w: 1344 });
  ig.layoutWrap = 'WRAP'; ig.counterAxisSpacing = 16;
  add(root, ig);
  for (const name of Object.keys(DATA.icons)) {
    const cell = frame({ name: 'icon-cell/' + name, dir: 'V', gap: 8, pad: 12, w: 150, fill: 'bg.elevated', stroke: 'border.default', radius: 8, align: 'CENTER' });
    add(ig, cell);
    add(cell, icon(name, 'text.primary', 48));
    add(cell, await text(name, 'data', 'text.secondary', { size: 12 }));
  }
}

// ------------------------------------------------------------------ 2 components
const ADVICE = {
  SEND: { tok: 'send', icon: 'decision-send', why: 'All 6 zones stay low for 24 h. Leave in the next 12 h.' },
  HOLD: { tok: 'hold', icon: 'decision-hold', why: 'Zone 3 is medium at +12 h. Wait 6 h and check again.' },
  RAIL: { tok: 'rail', icon: 'decision-rail', why: 'Zones 3 to 5 stay high at +24 h and +48 h. Book a Budgam–Delhi parcel slot.' },
  DIVERT: { tok: 'divert', icon: 'decision-divert', why: 'Light truck: take Mughal Road instead of NH-44.' },
};
const LEVEL = { Low: { bg: 'send.bg', text: 'send.text', map: 'risk.low.map', score: '0.15' }, Medium: { bg: 'hold.bg', text: 'hold.text', map: 'risk.medium.map', score: '0.42' }, High: { bg: 'high.bg', text: 'high.text', map: 'risk.high.map', score: '0.71' } };
const CONF = { Low: { bg: 'bg.surface', text: 'text.secondary' }, Medium: { bg: 'bg.surface', text: 'text.primary' }, High: { bg: 'rail.bg', text: 'rail.text' } };
const SYNC = {
  'Online Live': { bg: 'send.bg', text: 'send.text', icon: 'nav-map', label: 'Live · scores from the 18:34 UTC run' },
  'Offline Cached <5KB': { bg: 'text.primary', text: 'text.inverse', icon: 'status-offline-queue', label: 'Offline · cached scores, 1.9 KB' },
  'Stale Score >2h': { bg: 'hold.bg', text: 'hold.text', icon: 'decision-hold', label: 'Scores are 3 h old · the hourly job missed a run' },
  'Syncing Queued Report (2)': { bg: 'rail.bg', text: 'rail.text', icon: 'status-offline-queue', label: 'Sending 2 queued reports…' },
};
const SOURCE = {
  'Police Official': { bg: 'rail.bg', text: 'rail.text', stroke: 'rail.fill', icon: 'decision-hold' },
  'Verified Driver': { bg: 'send.bg', text: 'send.text', stroke: 'send.fill', icon: 'decision-send' },
  'Unconfirmed Driver': { bg: 'bg.elevated', text: 'text.secondary', stroke: 'border.strong', icon: 'status-offline-queue', dash: [4, 3] },
};
const TABS = [['Map', 'nav-map'], ['48h Strip', 'nav-strip'], ['Advisor', 'nav-advisor'], ['Board', 'nav-board'], ['Report', 'nav-report']];

async function badge(label, bgTok, textTok) {
  const b = frame({ name: 'badge', dir: 'H', gap: 4, pad: [2, 8, 2, 8], fill: bgTok, radius: 4, align: 'CENTER' });
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
    c.cornerRadius = 8; c.clipsContent = true; c.strokes = [solid('border.default')]; c.fills = [solid(a.tok + '.bg')];
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
    c.cornerRadius = 8; c.clipsContent = true; c.fills = [solid('bg.elevated')]; c.strokes = [solid('border.default')];
    const stripe = rect(6, 10, L.map);
    add(c, stripe); stripe.layoutSizingVertical = 'FILL';
    const body = frame({ name: 'body', dir: 'V', gap: 8, pad: [12, 16, 12, 16] });
    add(c, body, true);
    add(body, await text('Zone 4 · Ramban → Ramsoo', 'body', 'text.primary', { weight: 600, name: 'zone' }));
    const row = frame({ name: 'badges', dir: 'H', gap: 8 });
    add(body, row);
    add(row, await badge((lv === 'High' ? '▲▲ ' : lv === 'Medium' ? '▲ ' : '') + lv + ' risk', L.bg, L.text));
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
      add(item, icon(ic, on ? 'brand.teal' : 'text.secondary'));
      add(item, await text(tab === '48h Strip' ? '48h' : tab, 'label', on ? 'brand.teal' : 'text.secondary'));
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
    s.fills = [solid('bg.surface')]; s.cornerRadius = 16;
    const lab = await text(names[k], 'h1');
    place(page, lab, 0, y); y += 40;
    place(page, s, 0, y); y += s.height + 60;
  }
  return sets;
}

// ------------------------------------------------------------------ 3 wireframes
const WF = [
  ['1 Risk map (home)', [['title · role', 36], ['sync banner', 28, 1], ['horizon chips', 32], ['map · hex cells', 300], ['legend', 12], ['zone chips', 100], ['road report pills', 40]]],
  ['2 Zone sheet (overlay)', [['title · role', 36], ['sync banner', 28, 1], ['map, dimmed', 200], ['bottom sheet: badges, score, reason, hazard bars, outlook, past closures', 420, 2]]],
  ['3 48-hour strip', [['title · role', 36], ['sync banner', 28, 1], ['worst on route', 44], ['6 zones x 4 times grid', 380], ['pattern note', 24]]],
  ['4 Dispatch advisor (form)', [['title · role', 36], ['sync banner', 28, 1], ['variety', 48], ['days · tonnes', 48], ['destination (3 radio cards)', 170], ['truck (2 radio cards)', 116], ['truck number', 48], ['get advice', 48, 1]]],
  ['5 Advice card', [['title · role', 36], ['sync banner', 28, 1], ['decision banner', 120, 1], ['worst zone card', 140], ['delay · priority', 80], ['commit to board', 48, 1], ['change lot', 48, 2]]],
  ['6 Shipment board', [['title · role', 36], ['sync banner', 28, 1], ['filter: all / moving / held', 56], ['truck card #1', 110], ['truck card #2', 110], ['truck card #3', 110], ['truck card #4', 110]]],
  ['7 Report: what did you see', [['title · role', 36], ['sync banner', 28, 1], ['step 1 of 3', 8, 1], ['4 hazard buttons, 112 px tall', 240], ['offline note', 50, 2]]],
  ['8 Report: where + send', [['title · role', 36], ['sync banner', 28, 1], ['step 2 of 3', 8, 1], ['photo (optional)', 140], ['GPS coords + zone', 80], ['this is the place', 48, 1], ['send report', 48, 1]]],
  ['9 TCU console (police)', [['title · role', 36], ['sync banner', 28, 1], ['zone', 48], ['status: closed / one-way / open', 180], ['cause', 48], ['publish advisory', 48, 1], ['driver reports waiting', 120]]],
  ['10 Offline drawer', [['title · role', 36], ['sync banner', 28, 1], ['screen behind', 160], ['drawer: cache size, queued reports, send now, works offline', 420, 2]]],
  ['11 Loading state', [['title · role', 36], ['sync banner', 28, 1], ['skeleton chips', 48], ['skeleton map', 300], ['skeleton rows', 120]]],
  ['12 Empty and error states', [['title · role', 36], ['sync banner', 28, 1], ['icon', 60], ['what happened, in plain words', 50], ['one action: retry / plan a lot', 48, 1]]],
];
async function buildWireframes(page) {
  const frames = [];
  for (let i = 0; i < WF.length; i++) {
    const [name, boxes] = WF[i];
    const f = frame({ name: 'WF ' + name, dir: 'V', gap: 12, pad: [16, 16, 0, 16], w: 390, h: 844, fill: 'bg.elevated', stroke: 'border.strong', radius: 28, clip: true });
    place(page, f, (i % 6) * 450, Math.floor(i / 6) * 960 + 60);
    for (const [lab, h, kind] of boxes) {
      const b = frame({ name: lab, dir: 'V', pad: 6, h, fill: kind === 1 ? 'border.strong' : kind === 2 ? null : 'border.default', stroke: kind === 2 ? 'border.strong' : null, dash: kind === 2 ? [6, 4] : null, radius: 4 });
      add(f, b, true);
      if (h >= 24) add(b, await text(lab, 'label', kind === 1 ? 'text.inverse' : 'text.primary'));
    }
    const sp = frame({ name: 'spacer', dir: 'V' });
    add(f, sp, true); sp.layoutGrow = 1;
    const nav = frame({ name: 'bottom nav', dir: 'V', pad: 6, h: 64, fill: 'border.strong' });
    add(f, nav, true);
    add(nav, await text('bottom nav · 5 tabs', 'label', 'text.inverse'));
    const cap = await text(name, 'h2');
    place(page, cap, f.x, f.y - 36);
    frames.push(f);
  }
  return frames;
}

// ------------------------------------------------------------------ 4 hi-fi prototype
function replayRow(z, h) { return DATA.replay.find(r => r[0] === z && r[1] === h); }
const ZN = { 1: 'Jammu', 2: 'Chenani', 3: 'Nashri', 4: 'Ramban', 5: 'Banihal', 6: 'Srinagar' };
const LVTOK = { low: 'Low', medium: 'Medium', high: 'High' };

async function screen(page, name, x, y, title, role, tab, sets, syncState) {
  const f = frame({ name, w: 390, h: 844, fill: 'bg.canvas', radius: 28, clip: true, stroke: 'border.strong' });
  place(page, f, x, y);
  const t = await text(title, 'h1'); f.appendChild(t); t.x = 16; t.y = 12;
  const r = await text(role, 'label', 'text.secondary'); f.appendChild(r); r.x = 16; r.y = 40;
  const sync = sets.sync.children.find(c => c.name === 'State=' + (syncState || 'Online Live')).createInstance();
  f.appendChild(sync); sync.x = 0; sync.y = 64;
  const body = frame({ name: 'content', dir: 'V', gap: 12, w: 358 });
  f.appendChild(body); body.x = 16; body.y = 124;
  const nav = sets.nav.children.find(c => c.name === 'ActiveTab=' + tab).createInstance();
  f.appendChild(nav); nav.x = 0; nav.y = 780;
  return { f, body, sync, nav };
}
function variant(set, props) {
  const want = Object.keys(props).map(k => k + '=' + props[k]).join(', ');
  return set.children.find(c => c.name === want).createInstance();
}
async function button(label, fillTok, textTok, strokeTok) {
  const b = frame({ name: 'button/' + label, dir: 'H', h: 48, pad: [0, 16, 0, 16], fill: fillTok, stroke: strokeTok, radius: 8, align: 'CENTER', justify: 'CENTER' });
  add(b, await text(label, 'body', textTok, { weight: 600 }));
  return b;
}

async function buildPrototype(page, sets) {
  const S = {};
  const X = i => i * 440;
  // Map (replay +24 h)
  S.map = await screen(page, 'M1 Risk map', X(0), 60, 'Risk map', 'Grower / Trader', 'Map', sets);
  {
    const b = S.map.body;
    const chips = frame({ name: 'horizon chips', dir: 'H', gap: 8 });
    add(b, chips);
    for (const h of ['Now', '+12 h', '+24 h', '+48 h']) add(chips, await button(h, h === '+24 h' ? 'text.primary' : 'bg.elevated', h === '+24 h' ? 'text.inverse' : 'text.primary', 'border.strong'));
    const map = frame({ name: 'map (hex cells by zone, replay 25 Aug 2025 +24 h)', w: 358, h: 300, fill: 'bg.map', radius: 8, clip: true });
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
  // Zone sheet overlay
  S.sheet = frame({ name: 'O1 Zone sheet (overlay)', dir: 'V', gap: 12, pad: [8, 16, 24, 16], w: 390, fill: 'bg.elevated', radius: 20 });
  place(page, S.sheet, X(0), 960);
  {
    add(S.sheet, rect(40, 4, 'border.strong', 2)); S.sheet.counterAxisAlignItems = 'MIN';
    const head = frame({ name: 'head', dir: 'H', justify: 'SPACE_BETWEEN', align: 'CENTER' });
    add(S.sheet, head, true);
    add(head, await text('Zone 4 · +24 h', 'h2'));
    S.sheetClose = await button('Close', 'bg.elevated', 'text.primary', 'border.strong');
    add(head, S.sheetClose);
    const r = replayRow(4, 24);
    add(S.sheet, variant(sets.zone, { RiskLevel: LVTOK[r[2]], Confidence: LVTOK[r[4]] }));
    add(S.sheet, wrapText(await text('Replay 25 Aug 2025: ' + r[5], 'body')), true);
    add(S.sheet, wrapText(await text('Past closure here: 2019-05-09 Digdol, landslide, closed 48 h, 500 trucks (incidents.csv)', 'body', 'text.secondary')), true);
    S.sheetPlan = await button('Plan a lot through this zone', 'brand.teal', 'text.inverse');
    add(S.sheet, S.sheetPlan, true);
  }
  // 48 h strip
  S.strip = await screen(page, 'M2 48-hour strip', X(1), 60, '48-hour strip', 'Grower / Trader', '48h Strip', sets);
  {
    const b = S.strip.body;
    add(b, wrapText(await text('Worst on the route: zone 4 (Ramban) is high now.', 'body', 'text.primary', { weight: 600 })), true);
    for (let z = 1; z <= 6; z++) {
      const row = frame({ name: 'zone ' + z, dir: 'H', gap: 4, align: 'CENTER' });
      add(b, row, true);
      const zl = await text(z + ' ' + ZN[z], 'body'); zl.resize(84, zl.height); zl.textAutoResize = 'HEIGHT';
      add(row, zl);
      for (const h of [0, 12, 24, 48]) {
        const r = replayRow(z, h);
        const L = LEVEL[LVTOK[r[2]]];
        const cell = frame({ name: 'cell ' + h, dir: 'V', gap: 0, h: 56, fill: L.bg, radius: 4, align: 'CENTER', justify: 'CENTER' });
        add(row, cell, true);
        add(cell, await text(r[3].toFixed(2), 'data', L.text, { weight: 700 }));
        add(cell, await text(r[2] === 'medium' ? 'med' : r[2], 'label', L.text));
      }
    }
  }
  // Advisor form
  S.form = await screen(page, 'M3 Advisor form', X(2), 60, 'Dispatch advisor', 'Grower / Trader', 'Advisor', sets);
  {
    const b = S.form.body;
    for (const [lab, val] of [['Variety', 'Delicious'], ['Days since picking', '12'], ['Tonnes', '10'], ['Destination', '◉ Azadpur (Delhi)   ○ Narwal   ○ Parimpora'], ['Truck', '◉ Multi-axle   ○ Light 6-wheeler'], ['Truck number', 'JK05 G 7712']]) {
      add(b, await text(lab, 'label', 'text.secondary'));
      const f = frame({ name: 'field/' + lab, dir: 'H', h: 48, pad: [0, 12, 0, 12], fill: 'bg.elevated', stroke: 'border.strong', radius: 8, align: 'CENTER' });
      add(b, f, true);
      add(f, await text(val, 'input'));
    }
    S.formGo = await button('Get advice', 'brand.teal', 'text.inverse');
    add(b, S.formGo, true);
  }
  // Advice
  S.advice = await screen(page, 'M4 Advice card (RAIL)', X(3), 60, 'Dispatch advisor', 'Grower / Trader', 'Advisor', sets);
  {
    const b = S.advice.body;
    const d = variant(sets.decision, { Advice: 'RAIL' });
    add(b, d);
    const r = replayRow(4, 24);
    add(b, variant(sets.zone, { RiskLevel: LVTOK[r[2]], Confidence: LVTOK[r[4]] }));
    add(b, wrapText(await text('10 t Delicious, 12 days since picking (57% of a placeholder 21-day shelf life). Priority 3.43.', 'body', 'text.secondary')), true);
    S.adviceCommit = await button('Commit JK05 G 7712 to board', 'brand.teal', 'text.inverse');
    add(b, S.adviceCommit, true);
  }
  // Board
  S.board = await screen(page, 'M5 Shipment board', X(4), 60, 'Shipment board', 'Transport Agent', 'Board', sets);
  {
    const b = S.board.body;
    add(b, wrapText(await text('Ranked by priority = spoilage × load value. Sample trucks.', 'body', 'text.secondary')), true);
    for (const [i, truck, lot, adv] of [[1, 'JK13 D 0921', '9 t Ambri to Parimpora', 'SEND'], [2, 'JK22 C 8810', '8 t Kullu Delicious to Azadpur', 'RAIL'], [3, 'JK05 G 7712', '10 t Delicious to Azadpur · just committed', 'RAIL'], [4, 'JK03 F 2214', '10 t Delicious to Azadpur', 'RAIL']]) {
      const card = frame({ name: 'truck ' + truck, dir: 'V', gap: 6, pad: 12, fill: 'bg.elevated', stroke: i === 3 ? 'brand.teal' : 'border.default', strokeWeight: i === 3 ? 2 : 1, radius: 8 });
      add(b, card, true);
      const top = frame({ name: 'top', dir: 'H', gap: 8, align: 'CENTER' });
      add(card, top, true);
      add(top, await badge('#' + i, 'text.primary', 'text.inverse'));
      add(top, await text(truck, 'data'));
      add(top, await badge(adv, ADVICE[adv].tok + '.bg', ADVICE[adv].tok + '.text'));
      add(card, await text(lot, 'body', 'text.secondary'));
    }
  }
  // Report 1-3
  S.rep1 = await screen(page, 'M6 Report 1 · what', X(5), 60, 'Report a hazard', 'Truck Driver', 'Report', sets, 'Offline Cached <5KB');
  {
    const b = S.rep1.body;
    add(b, await text('What did you see?', 'h2'));
    const grid = frame({ name: 'hazards', dir: 'H', gap: 12, w: 358 });
    grid.layoutWrap = 'WRAP'; grid.counterAxisSpacing = 12;
    add(b, grid);
    S.rep1Buttons = [];
    for (const [k, lab] of [['hazard-landslide', 'Landslide'], ['hazard-rockfall', 'Rockfall'], ['hazard-flash-flood', 'Flash flood'], ['hazard-snow-ice', 'Snow / ice']]) {
      const hb = frame({ name: 'hazard/' + lab, dir: 'V', gap: 8, w: 173, h: 112, fill: 'bg.elevated', stroke: 'border.strong', strokeWeight: 2, radius: 16, align: 'CENTER', justify: 'CENTER' });
      add(grid, hb);
      add(hb, icon(k, 'text.primary', 40));
      add(hb, await text(lab, 'body', 'text.primary', { weight: 700, size: 16 }));
      S.rep1Buttons.push(hb);
    }
    add(b, wrapText(await text('No signal right now. Your report will wait on this phone and send by itself.', 'body')), true);
  }
  S.rep2 = await screen(page, 'M7 Report 2 · where', X(6), 60, 'Report a hazard', 'Truck Driver', 'Report', sets, 'Offline Cached <5KB');
  {
    const b = S.rep2.body;
    add(b, await text('Rockfall: where?', 'h2'));
    add(b, frame({ name: 'photo (optional)', h: 140, fill: 'border.default', radius: 8 }), true);
    add(b, await text('33.30284, 75.17981 · near Digdol, zone 4', 'data'));
    S.rep2Go = await button('This is the place', 'brand.terracotta.ink', 'text.inverse');
    add(b, S.rep2Go, true);
  }
  S.rep3 = await screen(page, 'M8 Report 3 · send', X(7), 60, 'Report a hazard', 'Truck Driver', 'Report', sets, 'Offline Cached <5KB');
  {
    const b = S.rep3.body;
    add(b, await text('Send this report?', 'h2'));
    add(b, variant(sets.pill, { Source: 'Unconfirmed Driver' }));
    add(b, wrapText(await text('It shows as unconfirmed until police or a second driver confirms it.', 'body', 'text.secondary')), true);
    S.rep3Go = await button('Save and send when online', 'brand.terracotta.ink', 'text.inverse');
    add(b, S.rep3Go, true);
  }
  S.queued = await screen(page, 'M9 Map with queued report', X(8), 60, 'Risk map', 'Truck Driver', 'Map', sets, 'Syncing Queued Report (2)');
  add(S.queued.body, wrapText(await text('Saved on this phone. It sends when you have signal.', 'body', 'text.primary', { weight: 600 })), true);
  // TCU
  S.tcu = await screen(page, 'M10 TCU console', X(9), 60, 'TCU console', 'Traffic Police (TCU)', 'Report', sets);
  {
    const b = S.tcu.body;
    for (const [lab, val] of [['Zone', 'Zone 4 · Ramban → Ramsoo'], ['Road status', '◉ Closed both ways'], ['Cause', 'Landslide']]) {
      add(b, await text(lab, 'label', 'text.secondary'));
      const f = frame({ name: 'field/' + lab, dir: 'H', h: 48, pad: [0, 12, 0, 12], fill: 'bg.elevated', stroke: 'border.strong', radius: 8, align: 'CENTER' });
      add(b, f, true);
      add(f, await text(val, 'input'));
    }
    S.tcuGo = await button('Publish and alert drivers in zone', 'brand.navy', 'text.inverse');
    add(b, S.tcuGo, true);
    add(b, await text('Driver reports waiting (1)', 'label', 'text.secondary'));
    add(b, variant(sets.pill, { Source: 'Unconfirmed Driver' }));
  }
  // Offline drawer overlay
  S.drawer = frame({ name: 'O2 Offline drawer (overlay)', dir: 'V', gap: 12, pad: [8, 16, 24, 16], w: 390, fill: 'bg.elevated', radius: 20 });
  place(page, S.drawer, X(1), 960);
  {
    add(S.drawer, rect(40, 4, 'border.strong', 2));
    const head = frame({ name: 'head', dir: 'H', justify: 'SPACE_BETWEEN', align: 'CENTER' });
    add(S.drawer, head, true);
    add(head, await text('Offline and sync', 'h2'));
    S.drawerClose = await button('Close', 'bg.elevated', 'text.primary', 'border.strong');
    add(head, S.drawerClose);
    add(S.drawer, wrapText(await text('24 zone scores cached on this phone · under 5 KB, so it loads on 2G', 'body')), true);
    add(S.drawer, variant(sets.pill, { Source: 'Unconfirmed Driver' }));
    add(S.drawer, await button('Send now', 'brand.teal', 'text.inverse'), true);
  }
  // Desktop control room 1440 x 900
  S.desk = frame({ name: 'D1 Control room (desktop)', w: 1440, h: 900, fill: 'bg.canvas', clip: true });
  place(page, S.desk, 0, 1700);
  {
    const head = frame({ name: 'header', dir: 'H', gap: 16, pad: [0, 24, 0, 24], w: 1440, h: 64, fill: 'text.primary', align: 'CENTER', justify: 'SPACE_BETWEEN' });
    S.desk.appendChild(head);
    add(head, await text('RouteGuard control room', 'h1', 'text.inverse'));
    const ds = variant(sets.sync, { State: 'Online Live' }); add(head, ds);
    const cols = frame({ name: 'columns', dir: 'H', gap: 16, pad: 16, w: 1440, h: 836 });
    S.desk.appendChild(cols); cols.y = 64;
    const c1 = frame({ name: 'map column', dir: 'V', gap: 12, pad: 16, w: 520, fill: 'bg.elevated', stroke: 'border.default', radius: 8 });
    add(cols, c1); c1.layoutSizingVertical = 'FILL';
    add(c1, await text('Risk map', 'label', 'text.secondary'));
    add(c1, frame({ name: 'map', h: 620, fill: 'bg.map', radius: 8 }), true);
    const c2 = frame({ name: 'strip + board column', dir: 'V', gap: 12, pad: 16, fill: 'bg.elevated', stroke: 'border.default', radius: 8 });
    add(cols, c2, true); c2.layoutSizingVertical = 'FILL';
    add(c2, await text('48-hour strip and shipment board', 'label', 'text.secondary'));
    add(c2, variant(sets.decision, { Advice: 'RAIL' }));
    add(c2, variant(sets.zone, { RiskLevel: 'High', Confidence: 'Medium' }));
    const c3 = frame({ name: 'reports column', dir: 'V', gap: 12, pad: 16, w: 380, fill: 'bg.elevated', stroke: 'border.default', radius: 8 });
    add(cols, c3); c3.layoutSizingVertical = 'FILL';
    add(c3, await text('Road reports', 'label', 'text.secondary'));
    for (const src of Object.keys(SOURCE)) add(c3, variant(sets.pill, { Source: src }));
  }

  // ---- click links (prototype reactions)
  const navTargets = { Map: S.map.f, '48h Strip': S.strip.f, Advisor: S.form.f, Board: S.board.f, Report: S.rep1.f };
  const screens = [S.map, S.strip, S.form, S.advice, S.board, S.rep1, S.rep2, S.rep3, S.queued, S.tcu];
  for (const s of screens) {
    TABS.forEach(([tab], i) => { s.navHot = s.navHot || []; s.navHot.push([hotspot(s.f, i * 78, 780, 78, 64, 'nav ' + tab), navTargets[tab]]); });
    s.syncHot = hotspot(s.f, 0, 64, 390, 48, 'sync banner');
  }
  for (const s of screens) {
    for (const [h, dest] of s.navHot) await link(h, dest, 'NAVIGATE');
    await link(s.syncHot, S.drawer, 'OVERLAY');
  }
  await link(S.mapZoneCard, S.sheet, 'OVERLAY');
  await link(S.sheetClose, null, 'CLOSE');
  await link(S.sheetPlan, S.form.f, 'NAVIGATE');
  await link(S.drawerClose, null, 'CLOSE');
  await link(S.formGo, S.advice.f, 'NAVIGATE');
  await link(S.adviceCommit, S.board.f, 'NAVIGATE');
  for (const hb of S.rep1Buttons) await link(hb, S.rep2.f, 'NAVIGATE');
  await link(S.rep2Go, S.rep3.f, 'NAVIGATE');
  await link(S.rep3Go, S.queued.f, 'NAVIGATE');
  await link(S.tcuGo, S.map.f, 'NAVIGATE');
  page.flowStartingPoints = [
    { nodeId: S.map.f.id, name: 'Flow A: plan a lot (grower)' },
    { nodeId: S.rep1.f.id, name: 'Flow B: report offline (driver)' },
    { nodeId: S.tcu.f.id, name: 'Flow C: official closure (TCU)' },
  ];
  const note = await text('Mobile frames are 390 x 844 (iPhone 14). Desktop control room is 1440 x 900. Numbers are from our replay of 25 Aug 2025 (rules-v0.1 on archived weather). Trucks are sample data.', 'body', 'text.secondary');
  place(page, note, 0, 0);
}

// ------------------------------------------------------------------ main
async function main() {
  const startPage = figma.currentPage;
  const startEmpty = startPage.children.length === 0;
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
  await figma.setCurrentPageAsync(p1);
  if (startEmpty) startPage.remove(); // the blank "Page 1" of a new file
  const msg = 'RouteGuard file built: 4 pages, ' + Object.keys(VARS).length + ' variables, 5 component sets.' +
    (fallbacks.length ? ' Fonts not installed, used Inter instead: ' + fallbacks.join(', ') : '');
  figma.closePlugin(msg);
}

main().catch(e => {
  figma.closePlugin('RouteGuard plugin failed: ' + (e && e.message ? e.message : e));
});
