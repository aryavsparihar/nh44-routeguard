# Round 2 UI/UX pack

Open `routeguard-round2-master.html` in a browser. It holds everything: rubric matrix, personas, DFDs, sitemap, user flows, design system, wireframes, the clickable prototype and the judge Q&A.

| File | What it is |
|---|---|
| `routeguard-round2-master.html` | The hub page. Works offline, no external files |
| `routeguard-architecture.drawio` | DFD Level 0, DFD Level 1, PWA sitemap, user flows (4 pages). Open in draw.io |
| `assets/icons/` | 14 icons, 24 px grid, 2 px stroke |
| `assets/diagrams/` | The 4 diagrams as SVG |
| `data/tokens.json` | Colours, type, spacing. The one source for the hub and Figma |
| `data/live-2026-11-10.json` | Real risk rows from Supabase, run of 10 Nov 2026 18:34 UTC |
| `data/replay-2025-08-25.json` | Our model replayed on 24 and 25 Aug 2025 (archived weather) |
| `figma-plugin/` | Builds the Figma file. See `figma-plugin/README-FIGMA.md` |
| `judge-defense-bible.md` | Design rationale and likely judge questions |

## Change something

1. Edit the source: `scripts/round2/diagrams.py` (diagrams), `scripts/round2/prototype.js` (prototype), `data/tokens.json`, the icons, the HTML itself or the bible.
2. Rebuild:

```bash
python3 scripts/round2/build.py
```

3. Check (needs `.venv-ux` with Playwright, see the top of the script):

```bash
python3 scripts/verify_round2_all.py
```

It must end with `0 errors, 0 warnings`. Screenshots land in `/tmp/round2_audit/`; look at them.

To rebuild the replay data: `jobs/.venv/bin/python scripts/round2/replay_2025.py`.
