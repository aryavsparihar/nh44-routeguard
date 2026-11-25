// Browser side of Web Push alerts: the service worker's push subscription.

// The VAPID public key (base64url) as the bytes pushManager.subscribe wants.
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function currentSubscription(): Promise<{ reg: ServiceWorkerRegistration | null; sub: PushSubscription | null }> {
  if (!pushSupported()) return { reg: null, sub: null };
  const reg = (await navigator.serviceWorker.getRegistration()) ?? null;
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return { reg, sub };
}

// Sign-out on a shared phone: this browser stops getting the account's
// alerts. Best effort; the server drops it anyway once the push service
// says it's gone.
export async function turnOffAlertsHere(): Promise<void> {
  try {
    const { sub } = await currentSubscription();
    if (!sub) return;
    await fetch("/api/v1/push/subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => null);
    await sub.unsubscribe();
  } catch {
    // nothing to do: signing out goes ahead
  }
}
