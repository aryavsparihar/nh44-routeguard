import { z } from "zod";
import { LOCALES } from "@/src/i18n/routing";

// Web Push subscriptions (BUILD_PROMPT WP-B B6). The worker sends a request
// to the endpoint, so only the browsers' own push services are allowed:
// anything else could point our server at an address of someone's choosing.
const PUSH_HOSTS = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
const PUSH_HOST_SUFFIXES = [".push.apple.com", ".notify.windows.com"];

export function isPushEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.includes(host) || PUSH_HOST_SUFFIXES.some((s) => host.endsWith(s) && host.length > s.length);
}

const base64url = (min: number, max: number) =>
  z.string().min(min).max(max).regex(/^[A-Za-z0-9_-]+={0,2}$/, "Must be base64url.");

const endpoint = z
  .string()
  .min(20)
  .max(1000)
  .refine(isPushEndpoint, "Must be an https address of a browser push service.");

// POST /api/v1/push/subscriptions: what PushSubscription.toJSON() gives, plus
// the zones to follow and the language for the alert text.
export const subscriptionBody = z
  .object({
    endpoint,
    keys: z
      .object({
        p256dh: base64url(80, 100), // a P-256 public key, 65 bytes
        auth: base64url(16, 32), // 16 bytes
      })
      .strict(),
    zones: z.array(z.number().int().min(1).max(99)).min(1).max(20),
    language: z.enum(LOCALES),
  })
  .strict();

// DELETE /api/v1/push/subscriptions: turn alerts off on this browser.
export const unsubscribeBody = z.object({ endpoint: z.string().min(20).max(1000) }).strict();

export type SubscriptionInput = z.infer<typeof subscriptionBody>;
