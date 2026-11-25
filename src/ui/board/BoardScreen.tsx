"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import type { Locale } from "@/src/i18n/routing";
import type { AgentInvite, FleetDriver, Shipment, ShipmentStatus } from "@/src/shared/api-types";
import type { Decision } from "@/src/shared/decide";
import { formatDayTime, isolate } from "@/src/shared/format";
import { ASSUMPTIONS, DESTINATIONS, VARIETIES, type Destination, type Variety } from "@/src/shared/priority";
import { Field, Notice, buttonClass, fromIstInput, inputClass, quietButtonClass, toIstInput } from "@/src/ui/admin/common";
import { useApi, type ApiList } from "@/src/ui/api";
import { send, useShipments, type Live } from "./useShipments";

export type BoardRole = "agent" | "driver" | "grower" | "trader" | "admin";

const STATUSES: ShipmentStatus[] = ["planned", "holding", "moving", "stuck", "on_rail", "diverted", "delivered"];
const DECISION_BOX: Record<Decision, string> = {
  SEND: "border-send-fill bg-send-bg text-send-text",
  HOLD: "border-hold-fill bg-hold-bg text-hold-text",
  RAIL: "border-rail-fill bg-rail-bg text-rail-text",
  DIVERT: "border-divert-fill bg-divert-bg text-divert-text",
};
const card = "flex flex-col gap-2 rounded-lg border border-border bg-elevated p-3";

// The board (D4). One screen, four views:
//   agent:  their trucks (new, status, driver), invite codes and drivers;
//   driver: the trucks they drive, location sharing, joining an agent;
//   grower, trader: the lots they saved;
//   admin:  every shipment, read only.
// Changes from other people show up by themselves (useShipments).
export function BoardScreen({ role }: { role: BoardRole }) {
  return role === "agent" ? <AgentBoard /> : <BoardBody role={role} fleet={[]} />;
}

function AgentBoard() {
  const [drivers, retryDrivers] = useApi<ApiList<FleetDriver>>("/api/v1/agents/drivers");
  const fleet = drivers.state === "ready" ? drivers.value.data : [];
  return (
    <BoardBody role="agent" fleet={fleet}>
      <Fleet drivers={drivers} onRetry={retryDrivers} onChanged={retryDrivers} />
    </BoardBody>
  );
}

function BoardBody({ role, fleet, children }: { role: BoardRole; fleet: FleetDriver[]; children?: ReactNode }) {
  const t = useTranslations("board");
  const { list, live, reload } = useShipments();

  return (
    <div className="flex flex-col gap-5">
      <LiveState live={live} onReload={reload} />

      {role === "driver" && <JoinFleet onJoined={reload} />}
      {(role === "agent" || role === "grower" || role === "trader") && (
        <NewShipment drivers={fleet} canAssign={role === "agent"} onCreated={reload} />
      )}

      <section aria-labelledby="board-list" className="flex flex-col gap-3">
        <h2 id="board-list" className="text-xl font-bold">
          {role === "driver" ? t("list.driver") : role === "agent" || role === "admin" ? t("list.agent") : t("list.lots")}
        </h2>
        {list.state === "loading" && <p role="status">{t("loading")}</p>}
        {list.state === "error" && (
          <div className="flex flex-col gap-2">
            <Notice kind="error">{list.status === 401 ? t("err.signedOut") : t("err.load")}</Notice>
            <button type="button" className={quietButtonClass} onClick={reload}>
              {t("reload")}
            </button>
          </div>
        )}
        {list.state === "ready" && list.value.length === 0 && <p className="rounded-md bg-surface p-3">{t(`empty.${role}`)}</p>}
        {list.state === "ready" && list.value.length > 0 && (
          <ul className="flex flex-col gap-3">
            {list.value.map((s) => (
              <li key={s.id}>
                <ShipmentCard shipment={s} role={role} drivers={fleet} onChanged={reload} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {children}
    </div>
  );
}

function LiveState({ live, onReload }: { live: Live; onReload: () => void }) {
  const t = useTranslations("board");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <p role="status" className="flex items-center gap-2">
        <span
          aria-hidden
          className={`inline-block size-2.5 rounded-full ${live === "live" ? "bg-send-fill" : "bg-border-strong"}`}
        />
        {t(`live.${live}`)}
      </p>
      <button type="button" className="min-h-12 px-2 underline" onClick={onReload}>
        {t("reload")}
      </button>
    </div>
  );
}

function ShipmentCard({
  shipment: s,
  role,
  drivers,
  onChanged,
}: {
  shipment: Shipment;
  role: BoardRole;
  drivers: FleetDriver[];
  onChanged: () => void;
}) {
  const t = useTranslations("board");
  const ta = useTranslations("advice");
  const locale = useLocale() as Locale;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const variety = ASSUMPTIONS.varieties[s.variety as Variety]?.name ?? s.variety;
  const destination = ASSUMPTIONS.destinations[s.destination as Destination]?.name ?? s.destination;
  const decision = s.advice?.decision;

  async function patch(change: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    const res = await send("PATCH", `/api/v1/shipments/${s.id}`, change);
    setBusy(false);
    if (res.status === 200) {
      setMessage({ kind: "ok", text: t("saved") });
      onChanged();
    } else if (res.status === 422 && res.paths.includes("driver_id")) {
      setMessage({ kind: "error", text: t("err.driver") });
    } else {
      setMessage({ kind: "error", text: errorText(t, res.status) });
    }
  }

  function shareLocation() {
    if (!("geolocation" in navigator)) {
      setMessage({ kind: "error", text: t("err.noGps") });
      return;
    }
    setBusy(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const res = await send("POST", `/api/v1/shipments/${s.id}/location`, {
          lat: Number(p.coords.latitude.toFixed(5)),
          lng: Number(p.coords.longitude.toFixed(5)),
        });
        setBusy(false);
        if (res.status === 200) {
          setMessage({ kind: "ok", text: t("locationSent") });
          onChanged();
        } else if (res.status === 409) {
          setMessage({ kind: "error", text: t("err.consent") });
        } else if (res.status === 422) {
          setMessage({ kind: "error", text: t("err.outside") });
        } else {
          setMessage({ kind: "error", text: errorText(t, res.status) });
        }
      },
      () => {
        setBusy(false);
        setMessage({ kind: "error", text: t("err.noGps") });
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 120_000 },
    );
  }

  return (
    <article className={card} aria-labelledby={`ship-${s.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={`ship-${s.id}`} className="font-bold">
          {s.truck_number ? <bdi dir="ltr">{s.truck_number}</bdi> : variety}
        </h3>
        <span className="rounded-full border border-border-strong px-3 py-1 text-sm font-bold">{t(`status.${s.status}`)}</span>
      </div>
      <p>
        {t("lot", { variety, tonnes: isolate(s.tonnes), destination })}
        {s.cold_stored && ` · ${t("coldStored")}`}
        {s.is_demo && ` · ${t("demo")}`}
      </p>
      {decision && (
        <p className={`rounded-md border-s-4 px-3 py-1 text-sm ${DECISION_BOX[decision]}`}>
          {t("adviceAtSave", { decision: ta(`decision.${decision}`) })}
        </p>
      )}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        {role !== "grower" && role !== "trader" && (
          <div>
            <dt className="inline text-secondary">{t("driver")}: </dt>
            <dd className="inline">{s.driver_id ? (s.driver_name ?? t("driverHidden")) : t("noDriver")}</dd>
          </div>
        )}
        <div>
          <dt className="inline text-secondary">{t("harvested")}: </dt>
          <dd className="inline">
            <bdi dir="ltr">{s.harvest_date}</bdi>
          </dd>
        </div>
        {s.eta && (
          <div>
            <dt className="inline text-secondary">{t("eta")}: </dt>
            <dd className="inline">{isolate(formatDayTime(new Date(s.eta), locale))}</dd>
          </div>
        )}
        {s.last_seen_at && (
          <div>
            <dt className="inline text-secondary">{t("lastSeen")}: </dt>
            <dd className="inline">
              {isolate(formatDayTime(new Date(s.last_seen_at), locale))}
              {s.last_lat !== null && s.last_lng !== null && (
                <>
                  {" · "}
                  <bdi dir="ltr">
                    {s.last_lat.toFixed(2)}, {s.last_lng.toFixed(2)}
                  </bdi>
                </>
              )}
            </dd>
          </div>
        )}
      </dl>

      {role === "agent" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field id={`status-${s.id}`} label={t("changeStatus")} invalid={false}>
            <select
              id={`status-${s.id}`}
              className={inputClass}
              value={s.status}
              disabled={busy}
              onChange={(e) => void patch({ status: e.target.value })}
            >
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {t(`status.${st}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`driver-${s.id}`} label={t("assignDriver")} invalid={false}>
            <select
              id={`driver-${s.id}`}
              className={inputClass}
              value={s.driver_id ?? ""}
              disabled={busy}
              onChange={(e) => void patch({ driver_id: e.target.value || null })}
            >
              <option value="">{t("noDriver")}</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.display_name ?? t("unnamed")}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`eta-${s.id}`} label={t("eta")} invalid={false}>
            <input
              id={`eta-${s.id}`}
              type="datetime-local"
              dir="ltr"
              className={inputClass}
              defaultValue={s.eta ? toIstInput(new Date(s.eta)) : ""}
              disabled={busy}
              onBlur={(e) => {
                const value = e.target.value ? fromIstInput(e.target.value) : null;
                if ((value ?? null) !== (s.eta ? new Date(s.eta).toISOString() : null)) void patch({ eta: value });
              }}
            />
          </Field>
        </div>
      )}

      {role === "driver" && s.status !== "delivered" && (
        <button type="button" className={quietButtonClass} onClick={shareLocation} disabled={busy}>
          {busy ? t("sending") : t("shareLocation")}
        </button>
      )}

      {message && <Notice kind={message.kind}>{message.text}</Notice>}
    </article>
  );
}

type Translate = ReturnType<typeof useTranslations<"board">>;

function errorText(t: Translate, status: number): string {
  if (status === 0) return t("err.offline");
  if (status === 401) return t("err.signedOut");
  if (status === 403) return t("err.forbidden");
  if (status === 404) return t("err.notFound");
  if (status === 409) return t("err.conflict");
  if (status === 422 || status === 400) return t("err.invalid");
  if (status === 429) return t("err.tooMany");
  return t("err.server");
}

function istDaysAgo(days: number): string {
  const d = new Date(Date.now() + 330 * 60_000);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function NewShipment({
  drivers,
  canAssign,
  onCreated,
}: {
  drivers: FleetDriver[];
  canAssign: boolean;
  onCreated: () => void;
}) {
  const t = useTranslations("board");
  const ta = useTranslations("advice");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    variety: "delicious" as Variety,
    harvest_date: istDaysAgo(0),
    tonnes: "10",
    destination: "azadpur" as Destination,
    truck_type: "heavy" as "heavy" | "light",
    truck_number: "",
    driver_id: "",
    cold_stored: false,
  });
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<string[]>([]);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setFields([]);
    const res = await send<{ advice: { decision: Decision } }>("POST", "/api/v1/shipments", {
      variety: form.variety,
      harvest_date: form.harvest_date,
      tonnes: Number(form.tonnes),
      destination: form.destination,
      truck_type: form.truck_type,
      cold_stored: form.cold_stored,
      ...(form.truck_number.trim() ? { truck_number: form.truck_number.trim() } : {}),
      ...(canAssign && form.driver_id ? { driver_id: form.driver_id } : {}),
    });
    setBusy(false);
    if (res.status === 201 && res.data) {
      setMessage({ kind: "ok", text: t("created", { decision: ta(`decision.${res.data.advice.decision}`) }) });
      setForm({ ...form, truck_number: "", driver_id: "" });
      onCreated();
      return;
    }
    setFields(res.paths);
    if (res.status === 409) setMessage({ kind: "error", text: t("err.truckActive") });
    else setMessage({ kind: "error", text: errorText(t, res.status) });
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" className={buttonClass} onClick={() => setOpen(true)}>
          {canAssign ? t("new.openAgent") : t("new.openLot")}
        </button>
        {message && <Notice kind={message.kind}>{message.text}</Notice>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={`${card} gap-4`} aria-labelledby="new-shipment">
      <h2 id="new-shipment" className="text-xl font-bold">
        {canAssign ? t("new.headingAgent") : t("new.headingLot")}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id="ns-variety" label={ta("variety")} invalid={fields.includes("variety")}>
          <select
            id="ns-variety"
            className={inputClass}
            value={form.variety}
            onChange={(e) => setForm({ ...form, variety: e.target.value as Variety })}
          >
            {VARIETIES.map((v) => (
              <option key={v} value={v}>
                {ASSUMPTIONS.varieties[v].name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ns-harvest" label={t("new.harvest")} invalid={fields.includes("harvest_date")}>
          <input
            id="ns-harvest"
            type="date"
            dir="ltr"
            className={inputClass}
            max={istDaysAgo(0)}
            min={istDaysAgo(120)}
            value={form.harvest_date}
            aria-invalid={fields.includes("harvest_date")}
            onChange={(e) => setForm({ ...form, harvest_date: e.target.value })}
          />
        </Field>
        <Field id="ns-tonnes" label={ta("tonnes")} invalid={fields.includes("tonnes")}>
          <input
            id="ns-tonnes"
            type="number"
            inputMode="decimal"
            min={0.1}
            max={40}
            step={0.1}
            dir="ltr"
            className={inputClass}
            value={form.tonnes}
            aria-invalid={fields.includes("tonnes")}
            onChange={(e) => setForm({ ...form, tonnes: e.target.value })}
          />
        </Field>
        <Field id="ns-destination" label={ta("destination")} invalid={fields.includes("destination")}>
          <select
            id="ns-destination"
            className={inputClass}
            value={form.destination}
            onChange={(e) => setForm({ ...form, destination: e.target.value as Destination })}
          >
            {DESTINATIONS.map((d) => (
              <option key={d} value={d}>
                {ASSUMPTIONS.destinations[d].name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ns-truck-type" label={ta("truck")} invalid={fields.includes("truck_type")}>
          <select
            id="ns-truck-type"
            className={inputClass}
            value={form.truck_type}
            onChange={(e) => setForm({ ...form, truck_type: e.target.value as "heavy" | "light" })}
          >
            <option value="heavy">{ta("truckType.heavy")}</option>
            <option value="light">{ta("truckType.light")}</option>
          </select>
        </Field>
        <Field id="ns-truck" label={t("new.truckNumber")} hint={t("new.truckHint")} invalid={fields.includes("truck_number")}>
          <input
            id="ns-truck"
            dir="ltr"
            autoCapitalize="characters"
            className={inputClass}
            maxLength={14}
            value={form.truck_number}
            aria-describedby="ns-truck-hint"
            aria-invalid={fields.includes("truck_number")}
            onChange={(e) => setForm({ ...form, truck_number: e.target.value })}
          />
        </Field>
        {canAssign && (
          <Field id="ns-driver" label={t("assignDriver")} invalid={fields.includes("driver_id")}>
            <select
              id="ns-driver"
              className={inputClass}
              value={form.driver_id}
              aria-invalid={fields.includes("driver_id")}
              onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
            >
              <option value="">{t("noDriver")}</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.display_name ?? t("unnamed")}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          className="size-5"
          checked={form.cold_stored}
          onChange={(e) => setForm({ ...form, cold_stored: e.target.checked })}
        />
        {t("coldStored")}
      </label>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={buttonClass} disabled={busy}>
          {busy ? t("sending") : t("new.save")}
        </button>
        <button type="button" className={quietButtonClass} onClick={() => setOpen(false)}>
          {t("new.close")}
        </button>
      </div>
    </form>
  );
}

function JoinFleet({ onJoined }: { onJoined: () => void }) {
  const t = useTranslations("board");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await send<{ outcome: "joined" | "repeat" }>("POST", "/api/v1/agents/invites/accept", { code });
    setBusy(false);
    if (res.status === 200 && res.data) {
      setMessage({ kind: "ok", text: t(`join.${res.data.outcome}`) });
      setCode("");
      onJoined();
    } else if (res.status === 404 || res.status === 422) {
      setMessage({ kind: "error", text: t("join.unknown") });
    } else if (res.status === 409) {
      setMessage({ kind: "error", text: t("join.used") });
    } else {
      setMessage({ kind: "error", text: errorText(t, res.status) });
    }
  }

  return (
    <form onSubmit={submit} noValidate className={card} aria-labelledby="join-fleet">
      <h2 id="join-fleet" className="text-lg font-bold">
        {t("join.heading")}
      </h2>
      <Field id="join-code" label={t("join.code")} hint={t("join.hint")} invalid={false}>
        <input
          id="join-code"
          dir="ltr"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={20}
          className={`${inputClass} font-mono tracking-widest`}
          value={code}
          aria-describedby="join-code-hint"
          onChange={(e) => setCode(e.target.value)}
        />
      </Field>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <button type="submit" className={buttonClass} disabled={busy || code.trim().length < 8}>
        {busy ? t("sending") : t("join.submit")}
      </button>
    </form>
  );
}

function Fleet({
  drivers,
  onRetry,
  onChanged,
}: {
  drivers: ReturnType<typeof useApi<ApiList<FleetDriver>>>[0];
  onRetry: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations("board");
  const locale = useLocale() as Locale;
  const [invites, retryInvites] = useApi<ApiList<AgentInvite>>("/api/v1/agents/invites");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<{ code: string; expires_at: string } | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function newInvite() {
    setBusy(true);
    setMessage(null);
    const res = await send<{ code: string; expires_at: string }>("POST", "/api/v1/agents/invites", {});
    setBusy(false);
    if (res.status === 201 && res.data) {
      setFresh(res.data);
      retryInvites();
    } else {
      setMessage({ kind: "error", text: res.status === 429 ? t("fleet.tooMany") : errorText(t, res.status) });
    }
  }

  async function vouch(driver: FleetDriver) {
    setBusy(true);
    setMessage(null);
    const res = await send<{ outcome: "vouched" | "repeat" }>("POST", `/api/v1/agents/drivers/${driver.id}/vouch`);
    setBusy(false);
    if (res.status === 200 && res.data) {
      setMessage({ kind: "ok", text: t(`fleet.${res.data.outcome}`, { name: driver.display_name ?? t("unnamed") }) });
      onChanged();
    } else {
      setMessage({ kind: "error", text: errorText(t, res.status) });
    }
  }

  return (
    <section aria-labelledby="fleet" className="flex flex-col gap-3">
      <h2 id="fleet" className="text-xl font-bold">
        {t("fleet.heading")}
      </h2>
      <div className={card}>
        <p>{t("fleet.inviteHint")}</p>
        <button type="button" className={buttonClass} onClick={() => void newInvite()} disabled={busy}>
          {t("fleet.newInvite")}
        </button>
        {fresh && (
          <p role="status" className="flex flex-col gap-1">
            <span>{t("fleet.giveCode")}</span>
            <bdi dir="ltr" className="font-mono text-2xl font-bold tracking-widest">
              {fresh.code}
            </bdi>
            <span className="text-sm text-secondary">
              {t("fleet.expires", { time: isolate(formatDayTime(new Date(fresh.expires_at), locale)) })}
            </span>
          </p>
        )}
        {invites.state === "ready" && invites.value.data.length > 0 && (
          <details>
            <summary className="min-h-12 cursor-pointer py-3">{t("fleet.codes", { count: invites.value.data.length })}</summary>
            <ul className="flex flex-col gap-1 text-sm">
              {invites.value.data.map((inv) => (
                <li key={inv.code}>
                  <bdi dir="ltr" className="font-mono">
                    {inv.code}
                  </bdi>{" "}
                  ·{" "}
                  {inv.accepted_at
                    ? t("fleet.usedBy", { name: inv.accepted_by_name ?? t("unnamed") })
                    : new Date(inv.expires_at) < new Date()
                      ? t("fleet.expired")
                      : t("fleet.open")}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {drivers.state === "loading" && <p role="status">{t("loading")}</p>}
      {drivers.state === "error" && (
        <div className="flex flex-col gap-2">
          <Notice kind="error">{t("err.load")}</Notice>
          <button type="button" className={quietButtonClass} onClick={onRetry}>
            {t("reload")}
          </button>
        </div>
      )}
      {drivers.state === "ready" && drivers.value.data.length === 0 && (
        <p className="rounded-md bg-surface p-3">{t("fleet.noDrivers")}</p>
      )}
      {drivers.state === "ready" && drivers.value.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {drivers.value.data.map((d) => (
            <li key={d.id} className={`${card} sm:flex-row sm:items-center sm:justify-between`}>
              <div>
                <p className="font-bold">{d.display_name ?? t("unnamed")}</p>
                <p className="text-sm text-secondary">
                  {t(`level.${d.verification_level}`)} · {d.location_consent ? t("fleet.sharesLocation") : t("fleet.noLocation")}
                </p>
              </div>
              {(d.verification_level === "none" || d.verification_level === "email") && (
                <button type="button" className={quietButtonClass} onClick={() => void vouch(d)} disabled={busy}>
                  {t("fleet.vouch")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <p className="text-sm text-secondary">
        {t("fleet.vouchHint")} <Link href="/privacy" className="underline">{t("fleet.privacy")}</Link>
      </p>
    </section>
  );
}
