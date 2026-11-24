"""Check that each incident's evidence_quote really appears in its source.

For every row of data/incidents.csv (or the file given), download source_url
(or archive_url if the source fails) and look for evidence_quote in the page
text, ignoring case, spacing and quote-mark style. This needs the network, so
it is run by hand before rows are verified, not in CI.

Run:
  jobs/.venv/bin/python scripts/check_incident_sources.py            # check data/incidents.csv
  jobs/.venv/bin/python scripts/check_incident_sources.py FILE.csv
  jobs/.venv/bin/python scripts/check_incident_sources.py --show URL # print a page's text

Standard library only. Exit code 1 if any quote is not found.
"""

from __future__ import annotations

import csv
import gzip
import html
import re
import sys
import time
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT = ROOT / "data" / "incidents.csv"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
SKIP_TAGS = {"script", "style", "noscript", "svg", "template"}


class _Text(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag: str, attrs) -> None:  # noqa: ANN001
        if tag in SKIP_TAGS:
            self._skip += 1
        elif tag in {"p", "br", "div", "li", "h1", "h2", "h3", "tr"}:
            self.parts.append("\n")
        if tag == "meta":
            a = dict(attrs)
            if a.get("name") in {"description"} or a.get("property") in {"og:description", "og:title"}:
                self.parts.append("\n" + (a.get("content") or "") + "\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in SKIP_TAGS and self._skip:
            self._skip -= 1

    def handle_data(self, data: str) -> None:
        if not self._skip:
            self.parts.append(data)


def fetch(url: str, timeout: int = 30) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip", "Accept-Language": "en"})
    with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310 (https URLs from our own CSV)
        body = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            body = gzip.decompress(body)
        charset = r.headers.get_content_charset() or "utf-8"
    return body.decode(charset, errors="replace")


def page_text(raw_html: str) -> str:
    p = _Text()
    p.feed(raw_html)
    text = html.unescape("".join(p.parts))
    return re.sub(r"[ \t\r\f\v]+", " ", text)


_QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", " ": " "})


def normalise(s: str) -> str:
    return re.sub(r"\s+", " ", s.translate(_QUOTES)).strip().lower()


def quote_found(quote: str, text: str) -> bool:
    return normalise(quote) in normalise(text)


def check_file(path: Path) -> int:
    rows = list(csv.DictReader(path.open(newline="", encoding="utf-8")))
    bad = 0
    cache: dict[str, str] = {}
    for row in rows:
        quote = (row.get("evidence_quote") or "").strip()
        rid = row.get("id") or "?"
        if not quote:
            print(f"--  {rid}: no evidence_quote")
            continue
        found, where = False, ""
        for col in ("source_url", "archive_url"):
            url = (row.get(col) or "").strip()
            if not url:
                continue
            try:
                if url not in cache:
                    cache[url] = page_text(fetch(url))
                    time.sleep(1)
            except Exception as e:  # noqa: BLE001 (report any download problem and try the next URL)
                where += f" {col}: {type(e).__name__}"
                continue
            if quote_found(quote, cache[url]):
                found, where = True, col
                break
            where += f" {col}: quote not in page"
        print(f"{'ok' if found else 'NO'}  {rid}: {where.strip()}")
        bad += not found
    print(f"\n{len(rows) - bad} of {len(rows)} rows: quote found in the source")
    return 1 if bad else 0


def main(argv: list[str]) -> int:
    if len(argv) == 2 and argv[0] == "--show":
        print(page_text(fetch(argv[1])))
        return 0
    return check_file(Path(argv[0]) if argv else DEFAULT)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
