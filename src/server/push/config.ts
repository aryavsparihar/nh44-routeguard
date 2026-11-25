import "server-only";

// Web Push settings (docs/runbook.md, "Web Push"). Alerts are on when the
// three VAPID values are set and FEATURE_PUSH isn't "false".
//   VAPID_PUBLIC_KEY   public by design; the browser needs it to subscribe
//   VAPID_PRIVATE_KEY  SECRET; signs every push so services know it's us
//   VAPID_SUBJECT      mailto: or https: contact for the push services
export type PushConfig = { publicKey: string; privateKey: string; subject: string };

const KEY = /^[A-Za-z0-9_-]+$/;

export function pushConfig(): PushConfig | null {
  if (process.env.FEATURE_PUSH?.trim().toLowerCase() === "false") return null;
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() ?? "";
  if (publicKey.length !== 87 || !KEY.test(publicKey)) return null; // 65 bytes, base64url
  if (privateKey.length !== 43 || !KEY.test(privateKey)) return null; // 32 bytes
  if (!/^(mailto:|https:\/\/)\S+$/.test(subject)) return null;
  return { publicKey, privateKey, subject };
}

// Only the public key, for the /me page.
export function pushPublicKey(): string | null {
  return pushConfig()?.publicKey ?? null;
}
