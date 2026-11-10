"""Load the shared risk settings from lib/risk/config.json.

The same file will be read by the Next.js app, so both sides use the same numbers.
All values in it are our own starting values, not sourced figures.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = REPO_ROOT / "lib" / "risk" / "config.json"

HAZARDS = ("landslide", "rockfall", "flash_flood", "snow_ice")


def load_config(path: Path = CONFIG_PATH) -> dict[str, Any]:
    cfg = json.loads(path.read_text())
    missing = [h for h in HAZARDS if h not in cfg["triggers"]]
    if missing:
        raise ValueError(f"config.json is missing triggers for: {missing}")
    for zone, row in cfg["exposure"].items():
        if zone.startswith("_"):
            continue
        for h in HAZARDS:
            v = row[h]
            if not 0 <= v <= 1:
                raise ValueError(f"exposure[{zone}][{h}] = {v} is outside 0-1")
    return cfg


def exposure(cfg: dict[str, Any], zone_id: int, hazard: str) -> float:
    return float(cfg["exposure"][str(zone_id)][hazard])
