"""Checklist for the second person who verifies incident rows (section 14, rule 8).

1. Make the checklist:
     python3 scripts/incidents_checklist.py > incidents-check.local.md
2. The verifier opens each link, checks every filled field against the source,
   and ticks the row ("- [x]") only if all of it matches. Anything wrong: leave it
   unticked and write why under the row.
3. Record the ticks (fills verified_by and verified_on for ticked rows only):
     python3 scripts/incidents_checklist.py --apply incidents-check.local.md --by "Name"
   The name must be the person who did the checking, and not the row's added_by.

*.local.md files are gitignored.
"""

from __future__ import annotations

import csv
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INCIDENTS = ROOT / "data" / "incidents.csv"
SHOWN = ("event_start_date", "event_end_date", "date_basis", "zone_id", "place", "hazard_type", "hours_closed",
         "hours_basis", "vehicles_stranded", "trucks_stranded", "source_publisher", "source_published_date", "notes")


def render(rows: list[dict[str, str]]) -> str:
    out = ["# Incident rows to verify", "",
           "Open each link. Tick a row only if the quote is on the page and every field below matches the source.",
           "If something is wrong, leave it unticked and write why under it.", ""]
    for r in rows:
        if r["verified_by"]:
            continue
        out.append(f"- [ ] **{r['id']}**")
        out.append(f"  - Source: {r['source_url']}")
        if r["archive_url"]:
            out.append(f"  - Archive copy: {r['archive_url']}")
        if r["second_source_url"]:
            out.append(f"  - Second source: {r['second_source_url']}")
        out.append(f"  - Quote: “{r['evidence_quote']}”")
        out.append("  - " + "; ".join(f"{k}: {r[k]}" for k in SHOWN if r[k]))
        out.append("")
    return "\n".join(out)


def ticked_ids(markdown: str) -> set[str]:
    return set(re.findall(r"^- \[[xX]\] \*\*(inc-[^*]+)\*\*", markdown, flags=re.M))


def apply(rows: list[dict[str, str]], ids: set[str], by: str, today: date) -> int:
    n = 0
    for r in rows:
        if r["id"] in ids and not r["verified_by"]:
            if r["added_by"].lower() == by.lower():
                raise SystemExit(f"{r['id']}: the verifier must not be the person who added it ({by})")
            r["verified_by"], r["verified_on"] = by, today.isoformat()
            n += 1
    return n


def main(argv: list[str]) -> int:
    with INCIDENTS.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        header, rows = list(reader.fieldnames or []), list(reader)
    if not argv:
        print(render(rows))
        return 0
    if len(argv) == 4 and argv[0] == "--apply" and argv[2] == "--by" and argv[3].strip():
        ids = ticked_ids(Path(argv[1]).read_text(encoding="utf-8"))
        unknown = ids - {r["id"] for r in rows}
        if unknown:
            raise SystemExit(f"not in incidents.csv: {sorted(unknown)}")
        n = apply(rows, ids, argv[3].strip(), date.today())
        with INCIDENTS.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=header, lineterminator="\n")
            w.writeheader()
            w.writerows(rows)
        print(f"marked {n} rows verified by {argv[3].strip()}")
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
