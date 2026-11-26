"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/src/i18n/routing";
import { decide, type Advice, type Decision, type Lot, type RoadStatus, type TruckType } from "@/src/shared/decide";
import { formatDayTime, isolate } from "@/src/shared/format";
import { ASSUMPTIONS, DESTINATIONS, VARIETIES, type Destination, type Variety } from "@/src/shared/priority";
import type { RiskMeta, RiskRow } from "@/src/shared/risk";
import { getJson, type ApiList } from "@/src/ui/api";
import { Icon, type IconName } from "@/src/ui/icons";
import { LevelBadge } from "@/src/ui/risk/LevelBadge";
import { SignInLink } from "@/src/ui/SignInLink";
import { whatWouldChange } from "@/src/shared/what-if";
import { pickVoice, speechText } from "./speech";

type RoadRow = { item: string; state: RoadStatus["mughal_road"] };
// basis: the scores and road status this phone saved, used for "what would
// change the answer". Missing when the phone couldn't load them.
type Basis = { rows: RiskRow[]; run_at: string | null; road: RoadStatus };
type Result = { advice: Advice; source: "server" | "phone"; lot: Lot; basis: Basis | null };

const DECISION_STYLE: Record<Decision, { box: string; icon: IconName }> = {
  SEND: { box: "border-send-fill bg-send-bg text-send-text", icon: "decision-send" },
  HOLD: { box: "border-hold-fill bg-hold-bg text-hold-text", icon: "decision-hold" },
  RAIL: { box: "border-rail-fill bg-rail-bg text-rail-text", icon: "decision-rail" },
  DIVERT: { box: "border-divert-fill bg-divert-bg text-divert-text", icon: "decision-divert" },
};

const field = "flex flex-col gap-1";
const input = "min-h-12 rounded-md border border-border-strong bg-elevated px-3 text-base";

// The dispatch advisor (E1, L12–L14). Online it asks POST /api/v1/advice, so
// the answer comes from our server. With no signal it runs the same
// decide() on this phone with the scores it saved last, and says so.
export function AdvisorScreen() {
  const t = useTranslations("advice");
  const [lot, setLot] = useState({
    variety: "delicious" as Variety,
    days: "12",
    tonnes: "10",
    destination: "azadpur" as Destination,
    truck_type: "heavy" as TruckType,
  });
  const [errors, setErrors] = useState<{ days?: boolean; tonnes?: boolean }>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  // Scores and road status kept for the offline answer.
  const saved = useRef<{ rows: RiskRow[]; run_at: string | null; road: RoadStatus } | null>(null);

  useEffect(() => {
    Promise.all([
      getJson<ApiList<RiskRow, RiskMeta>>("/api/v1/risk"),
      getJson<ApiList<RoadRow>>("/api/v1/road-status"),
    ]).then(
      ([risk, road]) => {
        const state = (item: string) => road.data.find((r) => r.item === item)?.state ?? "unknown";
        saved.current = {
          rows: risk.data,
          run_at: risk.meta.run_at,
          road: { mughal_road: state("mughal_road"), rail_parcel: state("rail_parcel") },
        };
      },
      () => {}, // offline on arrival: the service worker's copy is used, if any
    );
  }, []);

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const days = Number(lot.days);
    const tonnes = Number(lot.tonnes);
    const bad = {
      days: lot.days.trim() === "" || !Number.isInteger(days) || days < 0 || days > 120,
      tonnes: lot.tonnes.trim() === "" || !(tonnes >= 0.1 && tonnes <= 40),
    };
    setErrors(bad);
    if (bad.days || bad.tonnes) return;

    const body: Lot = {
      variety: lot.variety,
      days_since_picking: days,
      tonnes,
      destination: lot.destination,
      truck_type: lot.truck_type,
    };
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/v1/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setResult({ advice: (await res.json()).data as Advice, source: "server", lot: body, basis: saved.current });
        return;
      }
      if (res.status < 500) throw new Error("rejected"); // our form checks match the API's
      throw new TypeError("server unavailable");
    } catch (error) {
      // No signal or server down: the same rules on this phone.
      if (error instanceof TypeError && saved.current) {
        const s = saved.current;
        setResult({ advice: decide(body, { rows: s.rows, run_at: s.run_at }, s.road), source: "phone", lot: body, basis: s });
      } else {
        setFailed(true);
      }
    } finally {
      setBusy(false);
    }
  }

  if (result) return <AdviceResult result={result} onAgain={() => setResult(null)} focusRef={resultRef} />;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <label className={field}>
        <span className="font-bold">{t("variety")}</span>
        <select
          className={input}
          value={lot.variety}
          onChange={(e) => setLot({ ...lot, variety: e.target.value as Variety })}
        >
          {VARIETIES.map((v) => (
            <option key={v} value={v}>
              {ASSUMPTIONS.varieties[v].name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className={field}>
          <span className="font-bold">{t("days")}</span>
          <input
            className={input}
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            step={1}
            dir="ltr"
            value={lot.days}
            aria-invalid={errors.days || undefined}
            aria-describedby={errors.days ? "days-error" : undefined}
            onChange={(e) => setLot({ ...lot, days: e.target.value })}
          />
          {errors.days && (
            <span id="days-error" className="text-sm text-high-text">
              {t("errDays")}
            </span>
          )}
        </label>
        <label className={field}>
          <span className="font-bold">{t("tonnes")}</span>
          <input
            className={input}
            type="number"
            inputMode="decimal"
            min={0.1}
            max={40}
            step={0.1}
            dir="ltr"
            value={lot.tonnes}
            aria-invalid={errors.tonnes || undefined}
            aria-describedby={errors.tonnes ? "tonnes-error" : undefined}
            onChange={(e) => setLot({ ...lot, tonnes: e.target.value })}
          />
          {errors.tonnes && (
            <span id="tonnes-error" className="text-sm text-high-text">
              {t("errTonnes")}
            </span>
          )}
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">{t("destination")}</legend>
        {DESTINATIONS.map((d) => (
          <label key={d} className="flex min-h-12 items-center gap-3 rounded-md border border-border-strong bg-elevated px-3 has-checked:border-primary has-checked:bg-surface">
            <input
              type="radio"
              name="destination"
              className="size-5"
              checked={lot.destination === d}
              onChange={() => setLot({ ...lot, destination: d })}
            />
            <bdi>{ASSUMPTIONS.destinations[d].name}</bdi>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">{t("truck")}</legend>
        {(["heavy", "light"] as const).map((k) => (
          <label key={k} className="flex min-h-12 items-center gap-3 rounded-md border border-border-strong bg-elevated px-3 has-checked:border-primary has-checked:bg-surface">
            <input
              type="radio"
              name="truck_type"
              className="size-5"
              checked={lot.truck_type === k}
              onChange={() => setLot({ ...lot, truck_type: k })}
            />
            {t(`truckType.${k}`)}
          </label>
        ))}
      </fieldset>

      {failed && (
        <p role="alert" className="rounded-md border border-high-fill bg-high-bg p-3 text-high-text">
          {t("errServer")}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-highway px-4 font-bold text-inverse disabled:opacity-60"
      >
        <Icon name="nav-advisor" className="size-5" />
        {busy ? t("working") : t("submit")}
      </button>
    </form>
  );
}

function AdviceResult({
  result,
  onAgain,
  focusRef,
}: {
  result: Result;
  onAgain: () => void;
  focusRef: React.RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations("advice");
  const tr = useTranslations("risk");
  const locale = useLocale() as Locale;
  const { advice, source } = result;
  const style = DECISION_STYLE[advice.decision];
  const when = (h: number) => (h === 0 ? tr("whenNow") : tr("whenLater", { hours: h }));
  const runAt = isolate(advice.risk_run_at ? formatDayTime(new Date(advice.risk_run_at), locale) : "–");
  const p = advice.priority;

  const reasonValues: Record<string, string | number> = {
    ...advice.reason_params,
    hours: advice.delay_hours ?? 0,
    when: advice.worst ? when(advice.worst.horizon) : "",
  };
  const showReason = !advice.notes.includes("no_scores");

  // The lines read aloud are the same strings shown below, in the same order.
  const decisionText = t(`decision.${advice.decision}`);
  const reasonText = showReason ? t(`reason.${advice.reason_code}`, reasonValues) : null;
  const noteTexts = advice.notes.map((note) => t(`notes.${note}`));
  const disclaimerText = t("disclaimer");

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={focusRef}
        tabIndex={-1}
        className={`flex flex-col gap-2 rounded-lg border-s-8 p-4 outline-none ${style.box}`}
        data-advice={advice.decision}
      >
        <p className="flex items-center gap-2 text-2xl font-bold">
          {/* "Send" points forward: to the left in Urdu. */}
          <Icon name={style.icon} className={advice.decision === "SEND" ? "size-7 rtl:-scale-x-100" : "size-7"} />
          {decisionText}
        </p>
        {reasonText && <p>{reasonText}</p>}
        {noteTexts.map((note) => (
          <p key={note} className="font-bold">
            {note}
          </p>
        ))}
      </div>

      <ReadAloud lines={[decisionText, reasonText, ...noteTexts, disclaimerText]} />
      <WhatIfLines result={result} />

      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-elevated p-3">
          <dt className="text-sm text-secondary">{t("delayLabel")}</dt>
          <dd className="font-bold">{t(`delay.${advice.delay_code}`, { hours: advice.delay_hours ?? 0 })}</dd>
        </div>
        <div className="rounded-lg border border-border bg-elevated p-3">
          <dt className="text-sm text-secondary">{t("priorityLabel")}</dt>
          <dd className="flex flex-col gap-1">
            <span className="font-bold">{t(`band.${p.band}`)}</span>
            <span className="text-sm">
              {t("priorityInputs", { pct: isolate(Math.round(p.shelf_used * 100)), value: isolate(p.value_lakh.toFixed(1)) })}
            </span>
          </dd>
        </div>
        {advice.worst && advice.worst.level !== "low" && (
          <div className="rounded-lg border border-border bg-elevated p-3 sm:col-span-2">
            <dt className="text-sm text-secondary">{t("worstLabel")}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span>
                {t("worstValue", {
                  zone: advice.worst.zone,
                  when: when(advice.worst.horizon),
                  level: tr(`level.${advice.worst.level}`),
                  score: advice.worst.overall.toFixed(2),
                })}
              </span>
              <LevelBadge level={advice.worst.level} />
            </dd>
          </div>
        )}
      </dl>

      <p className="text-sm text-secondary">
        {t("assumptions", {
          days: isolate(p.shelf_days),
          price: isolate(p.price_rs_per_kg),
          version: isolate(p.assumptions_version),
        })}
      </p>
      <p className="text-sm text-secondary" data-source={source}>
        {source === "server" ? t("computedServer", { time: runAt }) : t("computedPhone", { time: runAt })}
      </p>
      <p className="text-sm font-bold">{disclaimerText}</p>

      {source === "server" && <SaveLot lot={result.lot} />}

      <button type="button" onClick={onAgain} className="min-h-12 rounded-md border border-border-strong bg-elevated px-4 font-bold">
        {t("again")}
      </button>
    </div>
  );
}

// "Read aloud": the browser reads the answer in the screen's language. Hidden
// when the phone has no voice for that language (src/ui/advice/speech.ts).
function ReadAloud({ lines }: { lines: (string | null)[] }) {
  const t = useTranslations("advice");
  const locale = useLocale() as Locale;
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    // Voices load late on some phones, so listen for the list changing too.
    const load = () => setVoice(pickVoice(synth.getVoices(), locale));
    load();
    synth.addEventListener("voiceschanged", load);
    return () => {
      synth.removeEventListener("voiceschanged", load);
      synth.cancel();
    };
  }, [locale]);

  if (!voice) return null;

  function start() {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText(lines));
    utterance.voice = voice;
    utterance.lang = voice!.lang;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utterance);
  }

  function stop() {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  return (
    <button
      type="button"
      onClick={speaking ? stop : start}
      aria-pressed={speaking}
      className="min-h-12 self-start rounded-md border border-border-strong bg-elevated px-4 font-bold"
    >
      {speaking ? t("stopReading") : t("readAloud")}
    </button>
  );
}

// "What would change the answer": at most two lines, only when the same rules
// give a different decision with a nearby value the user typed
// (src/shared/what-if.ts). Shown only when this phone's saved scores give the
// same answer as the one on screen, so the lines can't contradict it.
function WhatIfLines({ result }: { result: Result }) {
  const t = useTranslations("advice");
  const { basis, lot, advice } = result;
  if (!basis) return null;
  const risk = { rows: basis.rows, run_at: basis.run_at };
  if (decide(lot, risk, basis.road).decision !== advice.decision) return null;
  const lines = whatWouldChange(lot, risk, basis.road);
  if (lines.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-elevated p-3">
      <p className="text-sm text-secondary">{t("whatIf.heading")}</p>
      <ul className="flex flex-col gap-1">
        {lines.map((line) => {
          const decision = t(`decision.${line.decision}`);
          const text =
            line.kind === "days"
              ? t(line.delta < 0 ? "whatIf.daysFewer" : "whatIf.daysMore", { count: Math.abs(line.delta), decision })
              : t(line.truck_type === "light" ? "whatIf.light" : "whatIf.heavy", { decision });
          return (
            <li key={line.kind} className="font-bold">
              {text}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// "Save this lot to my board" (D4): a grower, trader or agent keeps the lot,
// with the advice the server gives at that moment, on /board.
function SaveLot({ lot }: { lot: Lot }) {
  const t = useTranslations("advice.save");
  const [state, setState] = useState<"idle" | "busy" | "saved" | "signIn" | "wrongRole" | "needsTruck" | "error">("idle");
  // Agents must name the truck (POST /api/v1/shipments answers 422 on
  // truck_number); growers and traders save the lot without one.
  const [truck, setTruck] = useState("");

  async function save() {
    setState("busy");
    const picked = new Date(Date.now() + 330 * 60_000);
    picked.setUTCDate(picked.getUTCDate() - lot.days_since_picking);
    try {
      const res = await fetch("/api/v1/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          variety: lot.variety,
          harvest_date: picked.toISOString().slice(0, 10),
          tonnes: lot.tonnes,
          destination: lot.destination,
          truck_type: lot.truck_type,
          ...(truck.trim() ? { truck_number: truck.trim() } : {}),
        }),
      });
      if (res.status === 422) {
        const body = await res.json().catch(() => null);
        const paths: string[] = (body?.errors ?? []).map((e: { path?: string }) => e.path ?? "");
        setState(paths.includes("truck_number") ? "needsTruck" : "error");
        return;
      }
      setState(res.status === 201 ? "saved" : res.status === 401 ? "signIn" : res.status === 403 ? "wrongRole" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "saved" || state === "signIn") {
    return (
      <p role="status" className="flex flex-wrap items-center gap-2">
        {state === "saved" && <span>{t("saved")}</span>}
        <SignInLink href="/board" className="underline">
          {state === "saved" ? t("open") : t("signIn")}
        </SignInLink>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {(state === "needsTruck" || truck) && (
        <label className="flex flex-col gap-1 text-sm font-bold">
          {t("truckLabel")}
          <input
            dir="ltr"
            autoCapitalize="characters"
            maxLength={14}
            required
            aria-required="true"
            aria-invalid={state === "needsTruck"}
            value={truck}
            onChange={(e) => setTruck(e.target.value)}
            className="min-h-12 rounded-md border border-border-strong bg-elevated px-3 text-base font-normal"
          />
        </label>
      )}
      <button
        type="button"
        onClick={() => void save()}
        disabled={state === "busy"}
        className="min-h-12 rounded-md bg-highway px-4 font-bold text-inverse disabled:opacity-60"
      >
        {truck ? t("again") : t("label")}
      </button>
      {state === "needsTruck" && (
        <p role="alert" className="text-sm font-bold text-high-text">
          {t("needsTruck")}
        </p>
      )}
      {(state === "wrongRole" || state === "error") && (
        <p role="alert" className="text-sm font-bold text-high-text">
          {state === "wrongRole" ? t("wrongRole") : t("err")}
        </p>
      )}
    </div>
  );
}
