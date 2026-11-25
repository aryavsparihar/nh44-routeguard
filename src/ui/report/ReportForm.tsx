"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import rules from "@/config/report-rules.json";
import type { PublicReport } from "@/src/shared/api-types";
import { Field, Notice, buttonClass, inputClass, quietButtonClass } from "@/src/ui/admin/common";
import { Icon, type IconName } from "@/src/ui/icons";

type Hazard = PublicReport["hazard_type"];
const HAZARDS: Hazard[] = ["landslide", "rockfall", "flash_flood", "snow_ice", "accident", "other"];
const HAZARD_ICON: Partial<Record<Hazard, IconName>> = {
  landslide: "hazard-landslide",
  rockfall: "hazard-rockfall",
  flash_flood: "hazard-flash-flood",
  snow_ice: "hazard-snow-ice",
};
const MAX_PHOTO_MB = rules.photo.max_bytes / (1024 * 1024);

type Position = { lat: number; lng: number; accuracy: number };
type Outcome = "created" | "repeat" | "merged";
type Sent = { outcome: Outcome; status: string };

const chip =
  "inline-flex min-h-12 items-center gap-1.5 rounded-full border border-border-strong bg-elevated px-4 text-sm font-bold aria-checked:border-primary aria-checked:bg-primary aria-checked:text-inverse";

// The report screen (B2): what is on the road, where you are, an optional
// photo and note. The phone makes one Idempotency-Key per report, so pressing
// Send twice (or a retry on a bad connection) can't post it twice.
export function ReportForm() {
  const t = useTranslations("report");
  const th = useTranslations("reports.hazard");
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [hazard, setHazard] = useState<Hazard | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<"denied" | "unavailable" | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const [sent, setSent] = useState<Sent | null>(null);

  function locate() {
    if (!("geolocation" in navigator)) {
      setLocateError("unavailable");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
        setLocating(false);
      },
      (e) => {
        setLocateError(e.code === e.PERMISSION_DENIED ? "denied" : "unavailable");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  function choosePhoto(file: File | null) {
    setError(null);
    if (file && file.size > rules.photo.max_bytes) {
      setPhoto(null);
      setError(t("err.photoTooBig", { mb: MAX_PHOTO_MB }));
      return;
    }
    setPhoto(file);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!hazard || !position || !consent) return;
    setSending(true);
    setError(null);
    setFields([]);

    const form = new FormData();
    form.set("hazard_type", hazard);
    form.set("lat", position.lat.toFixed(6));
    form.set("lng", position.lng.toFixed(6));
    if (note.trim()) form.set("note", note.trim());
    if (photo) form.set("photo", photo);

    let res: Response;
    try {
      res = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "Idempotency-Key": key, Accept: "application/json" },
        body: form,
      });
    } catch {
      setSending(false);
      setError(t("err.offline"));
      return;
    }
    const json = (await res.json().catch(() => null)) as
      | { data?: Sent; errors?: { path: string }[] }
      | null;
    setSending(false);
    if (res.ok && json?.data) {
      setSent(json.data);
      return;
    }
    const paths = (json?.errors ?? []).map((x) => x.path);
    setFields(paths);
    setError(errorText(res.status, paths));
  }

  function errorText(status: number, paths: string[]): string {
    if (status === 422 && (paths.includes("lat") || paths.includes("lng"))) return t("err.offCorridor");
    if (status === 422 && paths.includes("photo")) return t("err.photo");
    if (status === 422) return t("err.invalid");
    if (status === 413) return t("err.photoTooBig", { mb: MAX_PHOTO_MB });
    if (status === 401) return t("err.signedOut");
    if (status === 403) return t("err.forbidden");
    if (status === 409) return t("err.conflict");
    if (status === 429) return t("err.tooMany");
    if (status === 503) return t("err.paused");
    return t("err.server");
  }

  function another() {
    setKey(crypto.randomUUID());
    setHazard(null);
    setPhoto(null);
    setNote("");
    setSent(null);
    setError(null);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-3">
        <Notice kind="ok">
          {t(`sent.${sent.outcome}`)} {sent.status === "confirmed" ? t("sent.live") : t("sent.waiting")}
        </Notice>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className={`${buttonClass} inline-flex items-center`}>
            {t("seeMap")}
          </Link>
          <button type="button" className={quietButtonClass} onClick={another}>
            {t("another")}
          </button>
        </div>
      </div>
    );
  }

  const ready = hazard !== null && position !== null && consent && !sending;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-bold">{t("what")}</legend>
        <div role="radiogroup" aria-label={t("what")} className="flex flex-wrap gap-2">
          {HAZARDS.map((h) => {
            const icon = HAZARD_ICON[h];
            return (
              <button
                key={h}
                type="button"
                role="radio"
                aria-checked={hazard === h}
                className={chip}
                onClick={() => setHazard(h)}
              >
                {icon && <Icon name={icon} className="size-5" />}
                {th(h)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <p className="font-bold">{t("where")}</p>
        <p className="text-sm text-secondary">{t("whereHint")}</p>
        <button type="button" className={quietButtonClass} onClick={locate} disabled={locating}>
          {locating ? t("locating") : position ? t("locateAgain") : t("locate")}
        </button>
        {position && (
          <p role="status" className="text-sm">
            <bdi dir="ltr">
              {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
            </bdi>{" "}
            · {t("accuracy", { metres: Math.round(position.accuracy) })}
          </p>
        )}
        {locateError && <Notice kind="error">{t(`locateError.${locateError}`)}</Notice>}
      </div>

      <Field id="report-photo" label={t("photo")} hint={t("photoHint", { mb: MAX_PHOTO_MB })} invalid={fields.includes("photo")}>
        <input
          id="report-photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          aria-describedby="report-photo-hint"
          aria-invalid={fields.includes("photo")}
          className="text-sm"
          onChange={(e) => choosePhoto(e.target.files?.[0] ?? null)}
        />
      </Field>

      <Field id="report-note" label={t("note")} hint={t("noteHint")} invalid={fields.includes("note")}>
        <textarea
          id="report-note"
          className={`${inputClass} min-h-24 py-2`}
          maxLength={rules.note_max_chars}
          value={note}
          aria-describedby="report-note-hint"
          aria-invalid={fields.includes("note")}
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="text-end text-xs text-secondary">
          <bdi dir="ltr">
            {note.length}/{rules.note_max_chars}
          </bdi>
        </p>
      </Field>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>{t("consent")}</span>
      </label>

      {error && <Notice kind="error">{error}</Notice>}

      <button type="submit" className={buttonClass} disabled={!ready}>
        {sending ? t("sending") : t("send")}
      </button>
      {!ready && !sending && <p className="text-sm text-secondary">{t("needs")}</p>}
    </form>
  );
}
