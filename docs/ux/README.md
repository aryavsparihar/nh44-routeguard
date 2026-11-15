# Round 2 UI/UX pack

The deliverables for the judges are in **`ui ux round/`** at the repo root. Each one is a separate file:

| File | What it is |
|---|---|
| `01_DFD_Level_0.drawio` / `.pdf` / `.png` | DFD Level 0 (context) |
| `02_DFD_Level_1.drawio` / `.pdf` / `.png` | DFD Level 1 (system) |
| `03_Sitemap.drawio` / `.pdf` / `.png` | PWA sitemap |
| `04_User_Flows.drawio` / `.pdf` / `.png` | 3 swimlane user flows |
| `05_Personas.pdf` | Research basis, journey, 4 personas |
| `06_Style_Guide.pdf` | Colours with WCAG ratios, type, spacing, icons, every component variant |
| `07_Wireframes.pdf` | 12 low-fi wireframes |
| `08_Design_Rationale.pdf` | Why it works this way, states, accessibility, data, DFD notes |
| `09_Clickable_Prototype.html` | The clickable prototype. The only HTML file. Works offline |
| `icons/` | 14 SVG icons, 24 px grid, 2 px stroke |

The Figma file is separate: build it by hand with **`FIGMA-GUIDE.md`**.

## Guides for the team (not for the judges)

| File | What it is |
|---|---|
| `DRAWIO-GUIDE.md` | Redraw the DFDs yourselves in draw.io, and how to show a judge |
| `FIGMA-GUIDE.md` | Build the Figma file by hand: variables, styles, components, screens, links |
| `judge-defense-bible.md` | Likely judge questions and answers |
| `figma-plugin/` | Optional: a plugin that builds the Figma file automatically |

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
| `assets/icons/` | The icon sources |

## Change something

1. Edit a source from the table above.
2. Rebuild (needs `.venv-ux` with Playwright for the PDFs and PNGs, see the top of `scripts/verify_round2_all.py`):

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
