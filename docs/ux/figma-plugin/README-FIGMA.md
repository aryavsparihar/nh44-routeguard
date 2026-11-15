# RouteGuard Figma builder

This plugin builds our Round 2 Figma file from the same tokens as the style guide and prototype (`docs/ux/data/tokens.json`). It runs once on an empty file. After that, the file is ours to edit by hand in Figma.

## Run it (Figma desktop app)

1. Create a new, empty Figma design file. Name it `RouteGuard Round 2`.
2. Menu > Plugins > Development > Import plugin from manifest…
3. Pick `docs/ux/figma-plugin/manifest.json` from this repo.
4. Menu > Plugins > Development > RouteGuard Round 2 builder.
5. Wait about a minute. A message at the bottom says "RouteGuard file built".
6. The fonts (Barlow Semi Condensed, Atkinson Hyperlegible, Atkinson Hyperlegible Mono) are Google Fonts that Figma already has. If one is missing, the plugin uses a close family or Inter and lists it in that message.

The empty "Page 1" of the new file becomes page 01. Figma's free Starter plan allows only 3 pages per file, so on that plan the hi-fi prototype goes on page 03, under the wireframes, and the page is named `03_Low_Fi_Wireframes & High_Fi_Prototype_Mobile_&_Desktop`. On a paid or education plan you get all 4 pages.

## What it makes

| Page | What is on it |
|---|---|
| `01_Style_Guide_&_Variables` | Variable collection "RouteGuard tokens" (33 colours, spacing, radius, touch size), 8 text styles under `RouteGuard/`, colour swatches with their WCAG ratio, the contrast pairs we use, type scale, spacing bars, 15 icons |
| `02_Components_&_Variants` | 5 component sets, all auto-layout: Decision Banner (Advice = SEND / HOLD / RAIL / DIVERT), Zone Risk Card (RiskLevel × Confidence, 9 variants), Connectivity & Sync Banner (4 states), Hazard Report Pill (Police Official / Verified Driver / Unconfirmed Driver), Bottom Nav Bar (ActiveTab = Map / 48h Strip / Advisor / Board / Report) |
| `03_Low_Fi_Wireframes` | 20 grey-box frames, the same as `ui ux round/07_Wireframes.pdf`: 19 phone frames at 390 × 844 and the desktop control room (1440 × 900, drawn smaller) |
| `04_High_Fi_Prototype_Mobile_&_Desktop` | 15 mobile screens (390 × 844), 6 overlays and the desktop control room (1440 × 900), built from instances of the components. The overlays are 3 bottom sheets (zone, offline drawer, truck detail) and 3 confirm dialogs (publish a closure, sign out, delete account). One row per user flow (D sign-in, A grower, B driver, C police, E profile, desktop), with arrows and labels between the screens |

Colours on every node are bound to the variables, and auto-layout gaps and padding are bound to the spacing variables, so changing a variable updates the whole file.

## Prototype links

Press Play on the prototype page. Four flows start there:

- **Flow D (first sign-in):** Welcome > Send code > OTP > Verify > Create account > Map. "Change number" on the OTP screen goes back.
- **Flow A (grower):** Map > tap the zone card (zone sheet opens as an overlay) > Plan a lot > Get advice > RAIL card > Commit > Board > tap your truck (#4, green outline) for its detail sheet.
- **Flow B (driver, offline):** Report > tap a hazard > This is the place > Save and send when online > map with the queued banner.
- **Flow C (police):** TCU console > Publish > the confirm dialog names the zone and how many drivers get the alert > Publish > the driver's alerts inbox. Cancel closes the dialog.
- On every screen the bottom nav switches screens, the bell opens the alerts inbox, the round badge opens Profile and settings, and tapping the sync banner opens the offline drawer as an overlay. In Profile, Sign out and Delete my account each open a confirm dialog first; OK goes back to Welcome. The back arrow on Alerts and Profile goes to the map. Close and Cancel close overlays.

## Numbers in the file

Zone scores on the prototype page come from our replay of 25 Aug 2025 (`rules-v0.1` on archived Open-Meteo weather, see `scripts/round2/replay_2025.py`). Names are our four personas (`ui ux round/05_Personas.pdf`); phone numbers and trucks are sample data. Priority and shelf-life values are placeholders until `lib/decide.ts` lands.

## How this file was made (say this if asked)

- The plugin code is ours, written with help from an AI coding assistant and reviewed by the team.
- The token values and icon SVGs inside `code.js` (the `BUILD:data` block) are written by `scripts/round2/build.py`. Do not edit that block by hand: change `tokens.json` or the icons, then run `python3 scripts/round2/build.py`.
- `scripts/verify_round2_all.py` checks that the plugin parses and uses the right Figma APIs, page names, component names and token values. It also passes a dry run against a mock of the Figma API, with and without the 3-page limit.

## After it runs

- Rename, rearrange and polish by hand. The plugin is a starting point, not the final file.
- If you change a colour, change it in the variable panel. For the code, also change `tokens.json` so the style guide, prototype and plugin stay in sync.
