"""The four Round 2 diagrams, as coordinates. Edit here, then run build.py.

Naming rules we hold ourselves to (checked by scripts/verify_round2_all.py):
  * DFD flow labels are nouns (data), never verbs.
  * Every flow between an external entity and the system on Level 0 appears on
    Level 1 with the same label, the same entity and the same direction.
  * Stores only connect to processes. Entities only connect to processes.
  * Dashed = planned for 25 Nov, solid = live today (same convention as the Round 1 deck).
"""

from __future__ import annotations

from engine import Diagram, Edge, Node

N, E = Node, Edge


# ---------------------------------------------------------------- Tab 1: DFD Level 0

def dfd_level0() -> Diagram:
    d = Diagram("1_DFD_Level_0_Context", "l0", 1400, 560, dfd=True)
    d.nodes += [
        N("P0", "process", 520, 200, 360, 280, "0", ("RouteGuard NH-44 Prediction &", "Smart Apple Logistics System")),
        N("E1", "entity", 600, 40, 200, 80, "E1", ("Open-Meteo API",)),
        N("E2", "entity", 60, 240, 200, 80, "E2", ("Grower / Trader",)),
        N("E3", "entity", 60, 360, 200, 80, "E3", ("Transport Agent",)),
        N("E4", "entity", 1140, 240, 200, 80, "E4", ("Truck Driver",)),
        N("E5", "entity", 1140, 360, 200, 80, "E5", ("Traffic Police / Admin", "(TCU)")),
    ]
    d.edges += [
        E("F1", "E1", "P0", "hourly weather\nforecast + history", ("B", -80), ("T", -80)),
        E("F2", "P0", "E1", "weather point\nquery (15 points)", ("T", 80), ("B", 80)),
        E("F3", "E2", "P0", "lot details", ("R", -20), ("L", -80)),
        E("F4", "P0", "E2", "advice card +\nzone risk", ("L", -40), ("R", 20)),
        E("F5", "E3", "P0", "shipment +\ndriver details", ("R", -20), ("L", 40)),
        E("F6", "P0", "E3", "fleet board status", ("L", 80), ("R", 20)),
        E("F7", "E4", "P0", "hazard report", ("L", -20), ("R", -80)),
        E("F8", "P0", "E4", "zone push alert", ("R", -40), ("L", 20)),
        E("F9", "E5", "P0", "official closure advisory", ("L", -20), ("R", 40)),
        E("F10", "P0", "E5", "pending report queue", ("R", 80), ("L", 20)),
    ]
    return d


# ---------------------------------------------------------------- Tab 2: DFD Level 1

def dfd_level1() -> Diagram:
    d = Diagram("2_DFD_Level_1_System", "l1", 2280, 1060, dfd=True)
    d.nodes += [
        # external entities (same five as Level 0)
        N("E1", "entity", 20, 140, 180, 80, "E1", ("Open-Meteo API",)),
        N("E2", "entity", 20, 670, 180, 80, "E2", ("Grower / Trader",)),
        N("E3", "entity", 20, 920, 180, 80, "E3", ("Transport Agent",)),
        N("E5", "entity", 1980, 120, 180, 80, "E5", ("Traffic Police /", "Admin (TCU)")),
        N("E4", "entity", 1980, 920, 180, 80, "E4", ("Truck Driver",)),
        # processes (solid = runs today, dashed = planned for 25 Nov)
        N("P1", "process", 360, 30, 300, 300, "P1.0", ("Hourly Risk", "Scoring Engine", "(run_risk.py +", "check_run.py)")),
        N("P2", "process", 360, 630, 280, 160, "P2.0", ("Client Dispatch Advisor", "& Priority Scorer", "(decide.ts)"), planned=True),
        N("P4", "process", 360, 880, 280, 160, "P4.0", ("Fleet Shipment &", "Agent Board Manager"), planned=True),
        N("P3", "process", 1520, 40, 300, 240, "P3.0", ("Hazard Report Intake,", "Verification &", "Expiry Engine"), planned=True),
        N("P5", "process", 1520, 590, 300, 240, "P5.0", ("Offline Cache Sync &", "Web-Push Alert", "Dispatcher"), planned=True),
        # data stores (open-ended rectangles)
        N("D1", "store", 880, 60, 300, 80, "D1", ("weather_readings",)),
        N("D2", "store", 880, 170, 300, 60, "D2", ("zones + hexes (H3 res 8, slope)",)),
        N("D3", "store", 880, 270, 300, 40, "D3", ("incidents",)),
        N("D4", "store", 880, 370, 300, 40, "D4", ("risk_scores + latest_risk view",)),
        N("D5", "store", 880, 470, 300, 40, "D5", ("reports (expire after 6 h)",)),
        N("D7", "store", 880, 680, 300, 60, "D7", ("client IndexedDB (<5 KB + queue)",), planned=True),
        N("D6", "store", 880, 930, 300, 60, "D6", ("users + shipments (agent_id)",)),
    ]
    d.edges += [
        # external flows: same labels, entities and directions as Level 0
        E("F1", "E1", "P1", "hourly weather\nforecast + history", ("R", -20), ("L", -20)),
        E("F2", "P1", "E1", "weather point\nquery (15 points)", ("L", 20), ("R", 20)),
        E("F3", "E2", "P2", "lot details", ("R", -20), ("L", -20), planned=True),
        E("F4", "P2", "E2", "advice card +\nzone risk", ("L", 20), ("R", 20), planned=True),
        E("F5", "E3", "P4", "shipment +\ndriver details", ("R", -20), ("L", -20), planned=True),
        E("F6", "P4", "E3", "fleet board status", ("L", 20), ("R", 20), planned=True),
        E("F9", "E5", "P3", "official closure\nadvisory", ("L", -20), ("R", -20), planned=True),
        E("F10", "P3", "E5", "pending report\nqueue", ("R", 20), ("L", 20), planned=True),
        E("F7", "E4", "P3", "hazard report", ("R", 0), ("R", 60), planned=True,
          pts=((2200, 960), (2200, 220)), lab_seg=1, lab_c=600),
        E("F8", "P5", "E4", "zone push alert", ("R", 0), ("T", 0), planned=True, lab_seg=1, lab_c=815),
        # P1.0 and its stores
        E("I1", "P1", "D1", "weather readings", ("R", -90), ("L", -10)),
        E("I2", "D1", "P1", "weather history (backtest)", ("L", 20), ("R", -60), planned=True),
        E("I23", "P1", "D2", "hex rows (one-off load)", ("R", 0), ("L", -20), planned=True),
        E("I3", "D2", "P1", "zone exposure + cell slope", ("L", 10), ("R", 30)),
        E("I4", "D3", "P1", "incident history", ("L", 0), ("R", 60), via=840, lab_seg=-1),
        E("I5", "P1", "D4", "risk scores (24 rows)", ("R", 90), ("L", 0), via=800, lab_seg=0),
        E("I6", "D5", "P1", "confirmed reports (6 h)", ("L", 0), ("B", 50), planned=True, lab_seg=0),
        # P2.0 and P4.0
        E("I7", "D7", "P2", "risk summary (<5 KB)", ("L", 0), ("R", 0), planned=True),
        E("I8", "P2", "P4", "committed shipment", ("B", 0), ("T", 0), planned=True),
        E("I9", "P4", "D6", "shipment record", ("R", -10), ("L", -10), planned=True, lab_t=0.27),
        E("I10", "D6", "P4", "fleet records", ("L", 10), ("R", 10), planned=True, lab_t=0.25),
        # P3.0 and its stores
        E("I12", "P3", "D3", "closure record", ("L", -60), ("R", 0), via=1220, planned=True, lab_seg=0),
        E("I11", "P3", "D5", "verified report + police update", ("L", -20), ("R", -10), via=1240, planned=True, lab_seg=0),
        E("I14", "P3", "D7", "offline report queue", ("L", 20), ("R", -20), via=1260, planned=True, lab_seg=0),
        E("I22", "D7", "P3", "unsent reports", ("R", 0), ("L", 60), via=1280, planned=True, lab_seg=-1, lab_c=1455),
        E("I13", "D6", "P3", "driver verification status", ("R", 20), ("B", 60), planned=True,
          pts=((1880, 980), (1880, 320), (1730, 320)), lab_seg=0, lab_c=1500),
        # P5.0 and its stores
        E("I16", "D2", "P5", "corridor cell grid", ("R", 0), ("L", -60), via=1380, planned=True, lab_seg=-1),
        E("I15", "D4", "P5", "latest risk rows", ("R", 0), ("L", -20), via=1360, planned=True, lab_seg=-1),
        E("I17", "D5", "P5", "new verified report", ("R", 10), ("L", 60), via=1340, planned=True, lab_seg=-1),
        E("I19", "P5", "D7", "risk summary (<5 KB)", ("L", 20), ("R", 20), planned=True, lab_c=1260),
        E("I18", "D6", "P5", "driver routes", ("R", -20), ("B", 0), planned=True, lab_seg=0, lab_c=1420),
    ]
    return d


# ---------------------------------------------------------------- Tab 3: sitemap

def sitemap() -> Diagram:
    d = Diagram("3_PWA_Sitemap", "sm", 3080, 820)
    T = "tree"
    W = 200  # width of a screen box in the row under the mobile app
    xs = [460 + i * 230 for i in range(7)]  # S1..S5, PROF, ALRT
    d.nodes += [
        N("ROOT", "shell", 1050, 40, 400, 80, "RouteGuard PWA (App Shell)", ("Cloud-hosted Next.js PWA, installs from the browser",)),
        # sign-in and account: one screen after the other, before the app opens
        N("AUTH", "shell", 40, 180, 360, 70, "Sign-in & Account", ("phone + OTP, no passwords",)),
        N("AU1", "screen", 80, 300, 280, 70, "Welcome + phone number", ("3 lines on what it does;", "10-digit mobile, no password")),
        N("AU2", "screen", 80, 410, 280, 70, "OTP check", ("6 digits by SMS; wrong / expired;", "resend after 30 s")),
        N("AU3", "screen", 80, 520, 280, 80, "Create account + consent", ("name, role, truck no. for drivers;", "location + alerts switches (DPDP 2023);", "police accounts added by admin")),
        # the app
        N("MOB", "screen", 1090, 180, 320, 60, "Mobile PWA, 390 px", ("5-tab bottom nav; bell + profile on top",)),
        N("DESK", "screen", 2160, 180, 320, 60, "Desktop Control Room, 1440 px", ("agents and TCU police",)),
        N("SW", "shell", 2620, 180, 400, 70, "Service Worker + <5 KB IndexedDB Sync", ("+ Offline / Stale Banner",)),
        N("S1", "screen", xs[0], 340, W, 80, "1 Risk Map", ("H3 cells, hazard pills,", "report pins")),
        N("S2", "screen", xs[1], 340, W, 80, "2 48 h Zone Strip", ("6 zones x 4 horizons",)),
        N("S3", "screen", xs[2], 340, W, 80, "3 Dispatch Advisor", ("decide.ts on the phone",)),
        N("S4", "screen", xs[3], 340, W, 80, "4 Shipment Board", ("trucks, by priority",)),
        N("S5", "screen", xs[4], 340, W, 80, "5 Report Hazard", ("3 taps, works offline",)),
        N("PROF", "screen", xs[5], 340, W, 80, "Profile & Settings", ("alert zones, offline data,", "sign out, delete account")),
        N("ALRT", "screen", xs[6], 340, W, 80, "Alerts Inbox", ("police updates, verified", "reports, high-risk zones")),
        N("C1", "screen", 2100, 340, W, 80, "Fleet + Zone Wall", ("transport agents",)),
        N("C2", "screen", 2340, 340, W, 80, "TCU Console", ("police / admin only",)),
        N("OFF", "screen", 2600, 340, W, 120, "Offline & Sync", ("Diagnostics", "Drawer", "(0.8 KB cached)")),
        N("STATES", "modal", 2840, 340, W, 120, "UI States", ("Empty + Loading", "Error / GPS denied", "Offline cached", "Queued sync")),
        N("M1", "modal", xs[0], 480, W, 80, "H3 Cell / Zone", ("Explainability Sheet", "exposure x trigger")),
        N("M2", "modal", xs[1], 480, W, 80, "Zone Sheet at that Hour", ("hazard bars + past closures",)),
        N("M3", "modal", xs[2], 480, W, 80, "Advice Card", ("+ Commit to Board",)),
        N("M4", "modal", xs[3], 480, W, 80, "Truck Detail Sheet", ("last seen, ETA, delay,", "zones on its route")),
        N("M5", "modal", xs[4], 480, W, 80, "Report Steps", ("hazard, photo + GPS,", "send / queue")),
        N("M7", "modal", xs[5], 480, W, 80, "Sign out / Delete", ("account: confirm dialog",)),
        N("M8", "modal", xs[6], 480, W, 80, "Zone Sheet", ("opens from an alert",)),
        N("M6", "modal", 2340, 480, W, 80, "Publish Advisory", ("confirm dialog: zone,", "drivers alerted")),
        N("NOTE", "note", 460, 620, 1160, 60, "", ("Dark = app shell. Solid green = screen. Dashed = modal, drawer or sheet.",
                                                   "Every screen shows the UI states box: empty, loading, error, offline, queued.")),
    ]
    mob_c = 1090 + 160
    kids = ["S1", "S2", "S3", "S4", "S5", "PROF", "ALRT"]
    offs = [-120, -80, -40, 0, 40, 80, 120]
    vias = [270, 290, 310, None, 310, 290, 270]
    d.edges += [
        E("t1", "ROOT", "AUTH", "", ("L", 0), ("T", 0), kind=T),
        E("t2", "ROOT", "MOB", "", ("B", 0), ("T", 0), kind=T),
        E("t3", "ROOT", "DESK", "", ("B", 120), ("T", 0), via=150, kind=T),
        E("t4", "ROOT", "SW", "", ("R", 0), ("T", 0), kind=T),
        E("a1", "AUTH", "AU1", "", ("B", 0), ("T", 0), kind=T),
        E("a2", "AU1", "AU2", "", ("B", 0), ("T", 0), kind=T),
        E("a3", "AU2", "AU3", "", ("B", 0), ("T", 0), kind=T),
        E("t12", "DESK", "C1", "", ("B", 2100 + W // 2 - 2320), ("T", 0), kind=T),
        E("t13", "DESK", "C2", "", ("B", 2340 + W // 2 - 2320), ("T", 0), kind=T),
        E("t5", "SW", "OFF", "", ("B", 2600 + W // 2 - 2820), ("T", 0), kind=T),
        E("t6", "SW", "STATES", "", ("B", 2840 + W // 2 - 2820), ("T", 0), kind=T),
        E("t14", "S1", "M1", "", ("B", 0), ("T", 0), kind=T),
        E("t15", "S2", "M2", "", ("B", 0), ("T", 0), kind=T),
        E("t16", "S3", "M3", "", ("B", 0), ("T", 0), kind=T),
        E("t17", "S4", "M4", "", ("B", 0), ("T", 0), kind=T),
        E("t18", "S5", "M5", "", ("B", 0), ("T", 0), kind=T),
        E("t20", "PROF", "M7", "", ("B", 0), ("T", 0), kind=T),
        E("t21", "ALRT", "M8", "", ("B", 0), ("T", 0), kind=T),
        E("t19", "C2", "M6", "", ("B", 0), ("T", 0), kind=T),
    ]
    for i, (k, o, v) in enumerate(zip(kids, offs, vias)):
        d.edges.append(E(f"m{i}", "MOB", k, "", ("B", o), ("T", 0), kind=T, **({"via": v} if v else {})))
    return d


# ---------------------------------------------------------------- Tab 4: user flows

class Swim:
    """Place nodes by absolute coordinates inside lanes; stores them lane-relative."""

    def __init__(self, d: Diagram):
        self.d = d
        self.lanes: dict[str, tuple[int, int, int, int]] = {}

    def pool(self, pid, title, x, y, w, lanes):
        self.d.nodes.append(N(pid, "pool", x, y, w, sum(h for _, _, h, _ in lanes), title))
        ly = 0
        for lid, ltitle, h, fill in lanes:
            self.d.nodes.append(N(lid, "lane", 40, ly, w - 40, h, ltitle, parent=pid, fill=fill))
            self.lanes[lid] = (x + 40, y + ly, w - 40, h)
            ly += h

    def put(self, lane, nid, kind, ax, ay, w, h, lines, title=""):
        lx, ly, _, _ = self.lanes[lane]
        self.d.nodes.append(N(nid, kind, ax - lx, ay - ly, w, h, title, tuple(lines), parent=lane))


def user_flows() -> Diagram:
    d = Diagram("4_User_Flows", "uf", 1900, 2460)
    s = Swim(d)
    S = "step"
    ph = "#EAF2EC"
    # Flow A: grower / trader decides before loading (step 2 of the Round 1 journey)
    s.pool("PA", "Flow A: pre-loading decision at the orchard", 20, 20, 1860, [
        ("A_L1", "Grower / Trader", 160, None), ("A_L2", "RouteGuard PWA (phone)", 240, ph), ("A_L3", "Agent Board", 140, None)])
    s.put("A_L1", "A1", "start", 100, 60, 140, 80, ["Lot packed", "at orchard"])
    s.put("A_L1", "A2", "action", 290, 70, 150, 60, ["Open RouteGuard", "(works offline)"])
    s.put("A_L2", "A3", "io", 270, 220, 190, 60, ["Cached risk", "summary (D7)"])
    s.put("A_L2", "A4", "decision", 500, 200, 160, 100, ["Scores older", "than 2 h?"])
    s.put("A_L1", "A6", "action", 480, 70, 200, 60, ["Enter lot: variety, tonnes,", "harvest date, truck, mandi"])
    s.put("A_L2", "A5", "action", 720, 220, 160, 60, ["Show 'stale since'", "banner"])
    s.put("A_L2", "A7", "decision", 920, 200, 160, 100, ["Lot form", "valid?"])
    s.put("A_L2", "A8", "action", 1130, 220, 180, 60, ["Inline field error,", "entries kept"])
    s.put("A_L2", "A9", "action", 1060, 330, 200, 60, ["decide(): route risk", "x truck x spoilage"])
    s.put("A_L2", "A10", "action", 1360, 330, 220, 60, ["Advice card: SEND / HOLD 6 h", "/ RAIL / DIVERT + reason"])
    s.put("A_L1", "A11", "decision", 1390, 50, 160, 100, ["Grower", "commits?"])
    s.put("A_L1", "A12", "end", 1610, 60, 220, 80, ["Lot waits at orchard / CA,", "recheck in 6 h"])
    s.put("A_L3", "A13", "action", 1370, 460, 200, 60, ["Truck added to board,", "ranked by priority"])
    s.put("A_L3", "A14", "end", 1620, 450, 180, 80, ["Agent assigns", "a driver"])
    d.edges += [
        E("a1", "A1", "A2", "", ("R", 0), ("L", 0), kind=S),
        E("a2", "A2", "A3", "", ("B", 0), ("T", 0), kind=S),
        E("a3", "A3", "A4", "", ("R", 0), ("L", 0), kind=S),
        E("a4", "A4", "A6", "no", ("T", 0), ("B", 0), kind=S, lab_c=165),
        E("a5", "A4", "A5", "yes", ("R", 0), ("L", 0), kind=S),
        E("a6", "A5", "A6", "", ("T", 0), ("B", 70), pts=((800, 170), (650, 170)), kind=S),
        E("a7", "A6", "A7", "", ("R", 0), ("T", 0), kind=S),
        E("a8", "A7", "A8", "no", ("R", 0), ("L", 0), kind=S),
        E("a9", "A8", "A6", "retry", ("T", 0), ("T", 0), pts=((1220, 40), (580, 40)), kind=S, lab_seg=1, lab_c=900),
        E("a10", "A7", "A9", "yes", ("B", 0), ("L", 0), kind=S, lab_seg=0, lab_c=330),
        E("a11", "A9", "A10", "", ("R", 0), ("L", 0), kind=S),
        E("a12", "A10", "A11", "", ("T", 0), ("B", 0), kind=S),
        E("a13", "A11", "A12", "no", ("R", 0), ("L", 0), kind=S),
        E("a14", "A11", "A13", "yes", ("L", 0), ("T", 0), pts=((1330, 100), (1330, 440), (1470, 440)), kind=S,
          lab_seg=1, lab_c=190),
        E("a15", "A13", "A14", "", ("R", 0), ("L", 0), kind=S),
    ]
    # Flow B: driver reports a hazard in the Ramban gorge (step 4)
    s.pool("PB", "Flow B: 3-tap hazard report in the gorge", 20, 600, 1860, [
        ("B_L1", "Truck Driver", 160, None), ("B_L2", "RouteGuard PWA (phone)", 220, ph),
        ("B_L3", "Server: P3.0 report intake", 220, None)])
    s.put("B_L1", "B1", "start", 100, 640, 160, 80, ["Debris at Digdol", "(zone 4)"])
    s.put("B_L1", "B2", "action", 300, 650, 160, 60, ["Tap 1:", "hazard icon"])
    s.put("B_L1", "B3", "action", 500, 650, 160, 60, ["Tap 2: photo", "+ auto GPS"])
    s.put("B_L2", "B4", "decision", 500, 780, 160, 100, ["GPS fix?"])
    s.put("B_L2", "B5", "action", 270, 800, 180, 60, ["GPS denied: pick", "zone from list"])
    s.put("B_L1", "B6", "action", 720, 650, 160, 60, ["Tap 3: send"])
    s.put("B_L2", "B7", "decision", 920, 780, 160, 100, ["Signal?"])
    s.put("B_L2", "B8", "io", 880, 920, 240, 40, ["Queued on phone (D7)"])
    s.put("B_L2", "B9", "action", 1160, 910, 180, 60, ["Auto-send when", "signal returns"])
    s.put("B_L3", "B10", "decision", 1340, 1000, 180, 100, ["Driver verified", "by agent?"])
    s.put("B_L3", "B11", "action", 1570, 1020, 170, 60, ["Shown as verified,", "push to the zone"])
    s.put("B_L3", "B12", "action", 1570, 1120, 170, 60, ["Shown 'unconfirmed',", "expires in 6 h"])
    s.put("B_L3", "B13", "end", 1770, 1010, 100, 80, ["Report", "on map"])
    d.edges += [
        E("b1", "B1", "B2", "", ("R", 0), ("L", 0), kind=S),
        E("b2", "B2", "B3", "", ("R", 0), ("L", 0), kind=S),
        E("b3", "B3", "B4", "", ("B", 0), ("T", 0), kind=S),
        E("b4", "B4", "B5", "no", ("L", 0), ("R", 0), kind=S),
        E("b5", "B4", "B6", "yes", ("R", 0), ("B", -20), kind=S, lab_seg=0),
        E("b6", "B5", "B6", "", ("B", 0), ("B", 40), pts=((360, 950), (840, 950)), kind=S),
        E("b7", "B6", "B7", "", ("R", 0), ("T", 0), kind=S),
        E("b8", "B7", "B8", "no", ("B", 0), ("T", 0), kind=S),
        E("b9", "B8", "B9", "", ("R", 0), ("L", 0), kind=S),
        E("b10", "B7", "B10", "yes", ("R", 0), ("T", 0), kind=S, lab_seg=0),
        E("b11", "B9", "B10", "", ("B", 0), ("L", 0), kind=S),
        E("b12", "B10", "B11", "yes", ("R", 0), ("L", 0), kind=S),
        E("b13", "B10", "B12", "no", ("B", 0), ("L", 0), kind=S, lab_seg=0),
        E("b14", "B11", "B13", "", ("R", 0), ("L", 0), kind=S),
        E("b15", "B12", "B13", "", ("R", 0), ("B", 0), kind=S),
    ]
    # Flow C: TCU police post an official closure / one-way update
    s.pool("PC", "Flow C: TCU official override and push", 20, 1260, 1860, [
        ("C_L1", "TCU Officer", 160, None), ("C_L2", "Server: P3.0 + P5.0", 240, ph),
        ("C_L3", "Drivers in zone", 140, None)])
    s.put("C_L1", "C1", "start", 100, 1300, 150, 80, ["TCU advisory", "issued"])
    s.put("C_L1", "C2", "action", 290, 1310, 180, 60, ["Open TCU console", "(desktop or phone)"])
    s.put("C_L2", "C3", "decision", 290, 1440, 180, 100, ["Signed in as", "police / admin?"])
    s.put("C_L2", "C4", "end", 100, 1450, 140, 80, ["Access denied", "(error state)"])
    s.put("C_L1", "C5", "action", 500, 1310, 200, 60, ["Pick zone + status, confirm", "(dialog names the zone)"])
    s.put("C_L2", "C6", "io", 700, 1460, 220, 60, ["Official update saved", "(D5, source = police)"])
    s.put("C_L2", "C7", "action", 970, 1460, 170, 60, ["Zone confidence", "set to High"])
    s.put("C_L2", "C8", "decision", 1180, 1440, 180, 100, ["Drivers routed", "via this zone?"])
    s.put("C_L2", "C9", "end", 1190, 1580, 160, 70, ["No recipients", "(empty state)"])
    s.put("C_L2", "C10", "action", 1410, 1460, 170, 60, ["Web push to", "their phones"])
    s.put("C_L3", "C11", "action", 1410, 1700, 170, 60, ["Alert shown,", "offline copy kept"])
    s.put("C_L3", "C12", "end", 1640, 1690, 180, 80, ["Drivers hold", "at Qazigund"])
    d.edges += [
        E("c1", "C1", "C2", "", ("R", 0), ("L", 0), kind=S),
        E("c2", "C2", "C3", "", ("B", 0), ("T", 0), kind=S),
        E("c3", "C3", "C4", "no", ("L", 0), ("R", 0), kind=S),
        E("c4", "C3", "C5", "yes", ("R", 0), ("B", 0), kind=S, lab_seg=0),
        E("c5", "C5", "C6", "", ("R", 0), ("T", 0), kind=S),
        E("c6", "C6", "C7", "", ("R", 0), ("L", 0), kind=S),
        E("c7", "C7", "C8", "", ("R", 0), ("L", 0), kind=S),
        E("c8", "C8", "C9", "no", ("B", 0), ("T", 0), kind=S),
        E("c9", "C8", "C10", "yes", ("R", 0), ("L", 0), kind=S),
        E("c10", "C10", "C11", "", ("B", 0), ("T", 0), kind=S),
        E("c11", "C11", "C12", "", ("R", 0), ("L", 0), kind=S),
    ]
    # Flow D: first sign-in (phone + OTP, then a short account form for new users)
    s.pool("PD", "Flow D: first sign-in and account creation", 20, 1840, 1860, [
        ("D_L1", "New user", 160, None), ("D_L2", "RouteGuard PWA (phone)", 220, ph),
        ("D_L3", "Server: Auth + D6", 200, None)])
    s.put("D_L1", "D1", "start", 100, 1880, 150, 80, ["Opens the link", "from WhatsApp"])
    s.put("D_L1", "D2", "action", 280, 1890, 180, 60, ["Reads what it does", "(welcome screen)"])
    s.put("D_L1", "D3", "action", 490, 1890, 150, 60, ["Type 10-digit", "mobile number"])
    s.put("D_L3", "D4", "action", 470, 2290, 190, 60, ["Send 6-digit OTP by", "SMS (valid 5 min)"])
    s.put("D_L1", "D5", "action", 720, 1890, 180, 60, ["Type the code", "from the SMS"])
    s.put("D_L3", "D6", "decision", 900, 2270, 180, 100, ["Code right and", "not expired?"])
    s.put("D_L2", "D7", "action", 900, 2080, 180, 60, ["'Wrong or expired",  "code', resend in 30 s"])
    s.put("D_L3", "D8", "decision", 1130, 2270, 180, 100, ["Account", "exists?"])
    s.put("D_L1", "D9", "action", 1120, 1890, 200, 60, ["Create account: name,", "role, truck no. (drivers)"])
    s.put("D_L2", "D10", "action", 1370, 2080, 200, 60, ["Ask for location + alerts,", "show data consent"])
    s.put("D_L3", "D11", "io", 1350, 2290, 240, 60, ["Save user + role (D6);", "drivers start unverified"])
    s.put("D_L2", "D12", "end", 1660, 2070, 200, 80, ["Map opens with", "this role's tabs"])
    d.edges += [
        E("d1", "D1", "D2", "", ("R", 0), ("L", 0), kind=S),
        E("d2", "D2", "D3", "", ("R", 0), ("L", 0), kind=S),
        E("d3", "D3", "D4", "", ("B", 0), ("T", 0), kind=S),
        E("d4", "D4", "D5", "", ("R", 0), ("L", 0), pts=((690, 2320), (690, 1920)), kind=S),
        E("d5", "D5", "D6", "", ("B", 0), ("L", 0), kind=S),
        E("d6", "D6", "D7", "no", ("T", 0), ("B", 0), kind=S),
        E("d7", "D7", "D5", "retry", ("T", 0), ("R", 0), kind=S, lab_seg=0),
        E("d8", "D6", "D8", "yes", ("R", 0), ("L", 0), kind=S),
        E("d9", "D8", "D9", "no", ("T", 0), ("B", 0), kind=S),
        E("d10", "D9", "D10", "", ("R", 0), ("T", 0), kind=S),
        E("d11", "D10", "D11", "", ("B", 0), ("T", 0), kind=S),
        E("d12", "D11", "D12", "", ("R", 0), ("L", 0), pts=((1620, 2320), (1620, 2110)), kind=S),
        E("d13", "D8", "D12", "yes", ("B", 0), ("B", 0), pts=((1220, 2400), (1760, 2400)), kind=S, lab_seg=1, lab_c=1480),
    ]
    return d


def all_diagrams() -> list[Diagram]:
    return [dfd_level0(), dfd_level1(), sitemap(), user_flows()]
