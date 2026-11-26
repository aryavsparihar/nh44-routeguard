// Whether to show the "TCU console" button in the header. The header is the
// same for everyone (pages are cached per language), so it can't ask the
// server; /me leaves this hint after it loads an approved TCU profile, and
// signing out removes it. A wrong hint only shows or hides a link: /admin and
// its API check the role on every request.
export const ROLE_HINT_KEY = "rg_tcu";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(): Store | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // private mode or storage switched off
  }
}

export function saveTcuHint(isTcu: boolean, s: Store | null = store()): void {
  if (!s) return;
  if (isTcu) s.setItem(ROLE_HINT_KEY, "1");
  else s.removeItem(ROLE_HINT_KEY);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("rg:role"));
}

export function readTcuHint(s: Store | null = store()): boolean {
  return s?.getItem(ROLE_HINT_KEY) === "1";
}
