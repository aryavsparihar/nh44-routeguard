# Figma guide: build the RouteGuard file by hand

What you are building: one Figma design file with 4 pages, using the same colours, type and components as `ui ux round/06_Style_Guide.pdf`. You hand the judges a view link to it.

Time: about 6 to 8 hours for one person, or 3 to 4 hours if two people split the pages (one does pages 1 and 2, the other does pages 3 and 4 once the components exist).

Keep these open while you work:

- `ui ux round/06_Style_Guide.pdf` for colours, type and the components with every variant.
- `ui ux round/07_Wireframes.pdf` for page 3.
- `ui ux round/09_Clickable_Prototype.html` (open in Chrome) for the hi-fi screens on page 4.

## Step 0: the file

1. In Figma choose **New design file**. Name it `RouteGuard Round 2`.
2. In the left panel, click **+** next to **Pages** and make 4 pages:
   - `01_Style_Guide_&_Variables`
   - `02_Components_&_Variants`
   - `03_Low_Fi_Wireframes`
   - `04_High_Fi_Prototype_Mobile_&_Desktop`
3. Fonts: Merriweather, Inter and JetBrains Mono are Google Fonts. Figma has them built in, so there is nothing to install.

## Step 1: colour variables (page 1)

1. Click empty canvas. In the right panel, under **Local variables**, click **Open variables**.
2. Click **Create collection** and name it `RouteGuard tokens`.
3. Click **+ Create variable > Color** for each row below. Type the name with slashes (for example `bg/canvas`); Figma turns the slashes into groups.

| Name | Hex | Name | Hex |
|---|---|---|---|
| `bg/canvas` | `#FDF8F0` | `send/fill` | `#1E5631` |
| `bg/surface` | `#F5EDE0` | `send/bg` | `#DCFCE7` |
| `bg/elevated` | `#FFFFFF` | `send/text` | `#14532D` |
| `bg/map` | `#EDE4D6` | `hold/fill` | `#B8862D` |
| `text/primary` | `#1E2D3A` | `hold/bg` | `#FEF3C7` |
| `text/secondary` | `#475569` | `hold/text` | `#78350F` |
| `text/inverse` | `#FFFFFF` | `rail/fill` | `#28557A` |
| `border/default` | `#D8CFC2` | `rail/bg` | `#DBEAFE` |
| `border/strong` | `#8A7F70` | `rail/text` | `#1E3A8A` |
| `brand/terracotta` | `#C85A32` | `divert/fill` | `#C85A32` |
| `brand/terracotta-ink` | `#A9481F` | `divert/bg` | `#FFEDD5` |
| `brand/teal` | `#2B5B54` | `divert/text` | `#7C2D12` |
| `brand/ochre` | `#B8862D` | `high/fill` | `#B91C1C` |
| `brand/ochre-ink` | `#7A5A12` | `high/bg` | `#FEE2E2` |
| `brand/navy` | `#28557A` | `high/text` | `#7F1D1D` |
| `risk/low-map` | `#2B5B54` | `risk/high-map` | `#B91C1C` |
| `risk/medium-map` | `#9A6E1F` | | |

4. Make **Number** variables for spacing:
   - `space/1` = 4, `space/2` = 8, `space/3` = 12, `space/4` = 16, `space/6` = 24, `space/8` = 32, `space/12` = 48
   - `radius/sm` = 4, `radius/md` = 8, `radius/lg` = 16
   - `touch/min` = 48
5. On the canvas, draw one 96 × 64 square per colour and set its fill to the variable: click the fill swatch, open the **Libraries** icon, and pick the variable. Under each square, type its name and its contrast ratio from the style guide PDF.

## Step 2: text styles (page 1)

1. Type a line of text, for example "Send the lot before Ramban closes".
2. Set it up as one row of the table below.
3. In the right panel, next to **Text**, click the four-dot icon, then **+**, and name the style, for example `RouteGuard/Display`.
4. Repeat for every row.

| Style | Font | Size / line height | Weight |
|---|---|---|---|
| `RouteGuard/Display` | Merriweather | 28 / 36 | Bold |
| `RouteGuard/H1` | Merriweather | 22 / 30 | Bold |
| `RouteGuard/H2` | Inter | 18 / 24 | Semi Bold |
| `RouteGuard/Body` | Inter | 14 / 20 | Regular |
| `RouteGuard/Input` | Inter | 16 / 24 | Regular |
| `RouteGuard/Label` | Inter, UPPERCASE, letter spacing 6% | 12 / 16 | Semi Bold |
| `RouteGuard/Data` | JetBrains Mono | 14 / 20 | Medium |

## Step 3: icons (page 1)

1. In Finder, open `ui ux round/icons/`.
2. Select all 14 `.svg` files and drag them onto the canvas. Figma imports them as vectors.
3. For each icon: select it, press **Cmd+Option+K** to make it a component, and name it `Icon/decision-send` (and so on).
4. Set each icon's stroke colour to the `text/primary` variable.

## Step 4: the 5 component sets (page 2)

The pattern for each set:

1. Build the first version as a frame with auto layout: select the pieces and press **Shift+A**.
2. Make it a component (**Cmd+Option+K**).
3. Duplicate it for each variant and change what differs. Name each one `Property=Value`, for example `Advice=SEND`.
4. Select all the versions and click **Combine as variants** in the right panel.

While you build, bind the values to your variables:

- **Fills:** click the swatch and pick the variable.
- **Padding and gap:** hover the number in the auto layout section and click the variable icon.

| Component set | Variants | What is inside (auto layout) |
|---|---|---|
| Decision Banner | `Advice=SEND`, `HOLD`, `RAIL`, `DIVERT` | Horizontal: 6 px left bar in `*/fill`; vertical stack of icon + word (22 px bold) and one line of "why" (Body). Background `*/bg`, text `*/text`. Padding 16, gap 8 |
| Zone Risk Card | `RiskLevel=Low/Medium/High` × `Confidence=Low/Medium/High` (9) | Zone title, level badge + confidence badge, score in Data style, range, reason line. 4 px left border in the risk colour |
| Connectivity & Sync Banner | `State=Online Live`, `Offline Cached`, `Stale`, `Syncing` | Icon + one line. Online is green `send/bg`, offline is dark `text/primary` with white text, stale is `hold/bg`, syncing is `rail/bg` |
| Hazard Report Pill | `Source=Police Official`, `Verified Driver`, `Unconfirmed Driver` | Icon + text in a pill (radius 999). Police: solid navy line. Verified: solid green. Unconfirmed: dashed grey |
| Bottom Nav Bar | `ActiveTab=Map`, `48h Strip`, `Advisor`, `Board`, `Report` | 5 equal items (icon + Label style). Each item is at least 48 px tall. The active one has a 3 px teal bar on top and teal text |

Copy the exact look from the "Components and variants" section of the style guide PDF, which shows every variant.

## Step 5: low-fi wireframes (page 3)

1. Press **F**, then draw a frame and set it to **W 390, H 844** in the right panel.
2. Make 12 of these frames. Use grey rectangles only, as in `07_Wireframes.pdf`, and add the numbered notes beside each frame.
3. Name the frames as in the PDF, for example `1 Risk map (home)`.

## Step 6: hi-fi screens (page 4)

1. Make one 390 × 844 frame per screen:
   - Risk map
   - 48-hour strip
   - Advisor form
   - Advice card
   - Board
   - Report steps 1, 2 and 3
   - TCU console
   - Loading
2. Make two overlay frames, 390 wide: the **Zone sheet** and the **Offline drawer**.
3. Make one **1440 × 900** frame: the **Desktop control room**.
4. Build them from **instances** of your components. Drag them from the **Assets** tab, so they are not copies. Then switch variants in the right panel, for example Advice=RAIL.
5. Use the numbers from the prototype's **Replay** scenario so the screens look real (for example zone 4 Ramban HIGH 1.00).

## Step 7: prototype links (page 4)

1. Open the **Prototype** tab in the right panel.
2. Select the Risk map frame and click **+** next to **Flow starting point**. Name it `Flow A: grower`.
3. Select a button, drag the blue **+** handle to the target frame, and set **On tap > Navigate to**.
4. For the zone sheet and offline drawer, set **On tap > Open overlay**, position **Bottom center**, and tick **Close when clicking outside**.
5. Wire these three flows:
   - **Flow A (grower):** Map > tap zone card (zone sheet overlay) > Plan a lot > Advisor > Get advice > Advice card > Commit > Board.
   - **Flow B (driver):** Report > tap a hazard > This is the place > Send > Map, with the offline banner.
   - **Flow C (police):** TCU console > Publish > Map.
6. In every bottom nav, link each tab to its screen.
7. In prototype settings, pick a 390 × 844 phone as the device. Press the **▶ Present** button to test.

## Step 8: hand it in

1. Click **Share**, set **Anyone with the link** to **can view**, and copy the link. Share the prototype link from Present mode as well.
2. Optional PDF: select the frames, then choose **File > Export frames to PDF**.

## Proof that you made it

- At each milestone, press **Cmd+Option+S** (Save to version history) and name it, for example "variables done" or "components done".
- **File > Show version history** shows each named save with the person and the time. Open it if a judge asks how you built the file.
- In the room: open the **Variables** panel, change `brand/teal` to another colour, and show that every screen updates. Then press Cmd+Z. This shows the file is built on variables and components, not drawn flat.

## The plugin shortcut (optional)

`docs/ux/figma-plugin/` builds pages 1 to 4 automatically (see `figma-plugin/README-FIGMA.md`). It is faster, but then a script built the file, not you. If you use it, say so if asked, and do the polish and the prototype links by hand. The manual build above is the stronger story for a UI/UX round.
