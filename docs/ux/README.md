# Round 2 UI/UX pack

The deliverables for the judges are in **`ui ux round/`** at the repo root. Each one is a separate file:

| File | What it is |
|---|---|
| `01_DFD_Level_0.drawio` + `.pdf` | DFD Level 0 (context). Open the `.drawio` in draw.io; the `.pdf` is for reading on GitHub |
| `02_DFD_Level_1.drawio` + `.pdf` | DFD Level 1 (system) |
| `03_Sitemap.drawio` + `.pdf` | PWA sitemap: sign-in, 5 tabs, alerts, profile, sheets, dialogs, desktop |
| `04_User_Flows.drawio` + `.pdf` | 4 swimlane user flows (A grower, B driver offline, C police, D first sign-in) |
| `05_Personas.pdf` | Research basis, journey, 4 personas |
| `06_Style_Guide.pdf` | Colours with WCAG ratios, type, spacing, 15 icons, every component variant |
| `07_Wireframes.pdf` | 20 low-fi wireframes: 1 to 12 the main app, 13 to 16 sign-in, account and profile, 17 to 19 alerts, truck detail and the confirm dialog, 20 the desktop control room |
| `08_Design_Rationale.pdf` | Why it works this way, states, accessibility, data, DFD notes |
| `09_Clickable_Prototype.html` | The clickable prototype. Download it and open it in any browser; it works offline. It starts at sign-in (Flow D); the panel on the right lists the paths to try |

| Other files | What it is |
|---|---|
| `figma-plugin/` | A plugin that builds the Figma file (style guide, components, wireframes, hi-fi prototype) from the same tokens |
| `assets/icons/` | The 15 icon SVGs (24 px grid, 2 px stroke) |

The app is in English for now. Every word on the phone goes through one function (`tr()` in `scripts/round2/web/shared.js`), so Hindi and Urdu can be added later as a table of translations without touching the screens.

## Sources

| Path | What it is |
|---|---|
| `scripts/round2/diagrams.py` | The 4 diagrams |
| `scripts/round2/pages/*.html` | Text of the documents and the prototype page |
| `scripts/round2/web/*.css`, `*.js` | Shared styles and components, document widgets, prototype logic |
| `docs/ux/data/tokens.json` | Colours, type, spacing. One source for everything |
| `docs/ux/data/live-2026-11-10.json` | Real risk rows from Supabase, run of 10 Nov 2026 18:34 UTC |
| `docs/ux/data/replay-2025-08-25.json` | Our model replayed on 24 and 25 Aug 2025 (archived weather) |
| `docs/ux/routeguard-architecture.drawio` | All 4 generated diagrams in one file (working copy) |

## Change something

1. Edit a source from the table above.
2. Rebuild (needs `.venv-ux` with Playwright for the PDFs, see the top of `scripts/verify_round2_all.py`):

```bash
python3 scripts/round2/build.py
```

3. Check:

```bash
python3 scripts/verify_round2_all.py
```

It must end with `0 errors, 0 warnings`. Screenshots land in `/tmp/round2_audit/`; look at them.

A `.drawio` in `ui ux round/` that was saved from draw.io by a person is never overwritten by the build. To go back to the generated one, delete it and rebuild.

To rebuild the replay data, run `jobs/.venv/bin/python scripts/round2/replay_2025.py`.
