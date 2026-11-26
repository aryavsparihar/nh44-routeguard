// "Share" for the low-signal text summary (improves Round 1 feature 7, offline
// mode: "text summary under 5 KB"). The phone's own share sheet when there is
// one (WhatsApp, SMS), otherwise a copy to the clipboard.
// Runs in the browser: no server-only imports here.

// The same limit as the summary itself (src/server/risk/summary.ts).
export const SHARE_MAX_BYTES = 5 * 1024;

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

// The summary as the API sends it (title, data time, one line per horizon,
// the "not an official police service" line), then the link to the strip.
export function shareText(summary: string, link: string): string {
  return `${summary.trimEnd()}\n${link}\n`;
}

// The parts of `navigator` we use, so tests can pass a fake.
export type ShareNavigator = {
  share?: (data: { title?: string; text?: string }) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

export async function shareSummary(nav: ShareNavigator, title: string, text: string): Promise<ShareResult> {
  if (typeof nav.share === "function") {
    try {
      await nav.share({ title, text });
      return "shared";
    } catch (error) {
      // The person closed the share sheet: do nothing else.
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
      // Not allowed here (some desktop browsers): fall back to copying.
    }
  }
  if (nav.clipboard && typeof nav.clipboard.writeText === "function") {
    try {
      await nav.clipboard.writeText(text);
      return "copied";
    } catch {
      return "failed";
    }
  }
  return "failed";
}
