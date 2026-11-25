"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { Locale } from "@/src/i18n/routing";
import type { Zone } from "@/src/shared/api-types";
import { Notice, buttonClass, quietButtonClass } from "@/src/ui/admin/common";
import { getJson, useApi, type ApiList } from "@/src/ui/api";
import { send } from "@/src/ui/board/useShipments";
import { currentSubscription, keyBytes, pushSupported } from "./push";

type Message = { kind: "ok" | "error"; text: string } | null;
type Mine = { endpoint: string; zones: number[] };
const card = "flex flex-col gap-3 rounded-lg border border-border bg-elevated p-4";

// Opt-in to Web Push alerts (BUILD_PROMPT WP-B B6): pick zones, then the
// browser asks for permission. Nothing is asked before the button is pressed.
export function AlertsCard({ publicKey }: { publicKey: string | null }) {
  const t = useTranslations("me.alerts");
  const tr = useTranslations("risk");
  const locale = useLocale() as Locale;
  const [zones] = useApi<ApiList<Zone>>("/api/v1/zones");
  const [supported] = useState(pushSupported);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [follow, setFollow] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    if (!supported || !publicKey) return;
    let live = true;
    (async () => {
      const { sub } = await currentSubscription();
      if (!live || !sub) return;
      const mine = await getJson<ApiList<Mine>>("/api/v1/push/subscriptions").catch(() => null);
      const row = mine?.data.find((m) => m.endpoint === sub.endpoint);
      if (!live) return;
      // Subscribed in the browser but not on our side (e.g. after another
      // person used it): treat as off.
      if (row) {
        setEndpoint(sub.endpoint);
        setFollow(row.zones);
      }
    })();
    return () => {
      live = false;
    };
  }, [supported, publicKey]);

  const heading = (
    <h2 id="alerts" className="text-xl font-bold">
      {t("heading")}
    </h2>
  );
  if (!publicKey || !supported) {
    return (
      <section className={card} aria-labelledby="alerts">
        {heading}
        <p>{t("what")}</p>
        <p className="text-sm text-secondary">{publicKey ? t("unsupported") : t("notSetUp")}</p>
      </section>
    );
  }

  async function save(turningOn: boolean) {
    if (follow.length === 0) {
      setMessage({ kind: "error", text: t("pickZone") });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { reg, sub: existing } = await currentSubscription();
      if (!reg) {
        setMessage({ kind: "error", text: t("notReady") });
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage({ kind: "error", text: t("blocked") });
        return;
      }
      const sub =
        existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey!) }));
      const json = sub.toJSON();
      const res = await send("POST", "/api/v1/push/subscriptions", {
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        zones: follow,
        language: locale,
      });
      if (res.status !== 200 && res.status !== 201) {
        setMessage({ kind: "error", text: res.status === 503 ? t("notSetUp") : t("error") });
        return;
      }
      setEndpoint(sub.endpoint);
      setMessage({ kind: "ok", text: turningOn ? t("onDone") : t("saved") });
    } catch {
      setMessage({ kind: "error", text: t("error") });
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    try {
      const { sub } = await currentSubscription();
      const target = sub?.endpoint ?? endpoint;
      if (target) {
        const res = await send("DELETE", "/api/v1/push/subscriptions", { endpoint: target });
        if (res.status !== 204) {
          setMessage({ kind: "error", text: t("error") });
          return;
        }
      }
      await sub?.unsubscribe();
      setEndpoint(null);
      setMessage({ kind: "ok", text: t("offDone") });
    } catch {
      setMessage({ kind: "error", text: t("error") });
    } finally {
      setBusy(false);
    }
  }

  const on = endpoint !== null;
  const toggle = (id: number) => setFollow((f) => (f.includes(id) ? f.filter((z) => z !== id) : [...f, id].sort((a, b) => a - b)));

  return (
    <section className={card} aria-labelledby="alerts">
      {heading}
      <p>{t("what")}</p>
      <p className="font-bold">{on ? t("isOn") : t("isOff")}</p>
      {zones.state === "ready" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-bold">{t("zones")}</legend>
          {zones.value.data.map((z) => (
            <label key={z.id} className="flex min-h-12 items-center gap-3 rounded-md border border-border-strong p-3 has-checked:border-primary">
              <input type="checkbox" className="size-5" checked={follow.includes(z.id)} onChange={() => toggle(z.id)} />
              <bdi>{t("zone", { zone: z.id, name: z.name })}</bdi>
            </label>
          ))}
        </fieldset>
      )}
      {zones.state === "error" && <Notice kind="error">{tr("loadError")}</Notice>}
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={busy} onClick={() => void save(!on)}>
          {on ? t("save") : t("turnOn")}
        </button>
        {on && (
          <button type="button" className={quietButtonClass} disabled={busy} onClick={() => void turnOff()}>
            {t("turnOff")}
          </button>
        )}
      </div>
    </section>
  );
}
