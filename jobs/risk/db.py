"""Tiny Supabase (PostgREST) client over httpx.

Uses the SECRET key, which bypasses RLS. The key is only ever sent as a header;
it is never printed, logged or put in an error message.
"""

from __future__ import annotations

from typing import Any

import httpx

TIMEOUT_S = 30
CHUNK = 1000


class SupabaseWriteError(RuntimeError):
    pass


class Supabase:
    def __init__(self, url: str, key: str, client: httpx.Client | None = None):
        url = url.strip().rstrip("/")
        if not url.startswith("https://") or "supabase.co" not in url or "/dashboard" in url:
            raise ValueError("SUPABASE_URL should look like https://<project-ref>.supabase.co")
        headers = {"apikey": key.strip(), "Content-Type": "application/json"}
        if key.strip().startswith("eyJ"):  # legacy JWT service_role key also needs Authorization
            headers["Authorization"] = f"Bearer {key.strip()}"
        self.rest = f"{url}/rest/v1"
        self.client = client or httpx.Client(timeout=TIMEOUT_S, headers=headers)
        if client is not None:
            self.client.headers.update(headers)

    def close(self) -> None:
        self.client.close()

    @staticmethod
    def _check(r: httpx.Response, what: str) -> None:
        if r.status_code >= 300:
            # PostgREST error bodies hold code/message/hint, never the key
            raise SupabaseWriteError(f"Supabase rejected {what}: HTTP {r.status_code} {r.text[:300]}")

    def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        r = self.client.get(f"{self.rest}/{table}", params=params)
        self._check(r, f"read of {table}")
        return r.json()

    def upsert(self, table: str, rows: list[dict[str, Any]], on_conflict: str) -> int:
        for i in range(0, len(rows), CHUNK):
            r = self.client.post(
                f"{self.rest}/{table}",
                params={"on_conflict": on_conflict},
                json=rows[i : i + CHUNK],
                headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
            )
            self._check(r, f"upsert into {table}")
        return len(rows)

    def insert(self, table: str, rows: list[dict[str, Any]]) -> int:
        for i in range(0, len(rows), CHUNK):
            r = self.client.post(
                f"{self.rest}/{table}",
                json=rows[i : i + CHUNK],
                headers={"Prefer": "return=minimal"},
            )
            self._check(r, f"insert into {table}")
        return len(rows)
