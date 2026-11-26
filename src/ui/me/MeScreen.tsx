"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { LOCALE_LABELS } from "@/src/i18n/locale";
import { LOCALES, type Locale } from "@/src/i18n/routing";
import type { MeProfile } from "@/src/shared/api-types";
import { Field, Notice, buttonClass, inputClass, quietButtonClass } from "@/src/ui/admin/common";
import { useApi } from "@/src/ui/api";
import { send } from "@/src/ui/board/useShipments";
import { saveLocaleCookie } from "@/src/ui/locale-cookie";
import { outboxCount } from "@/src/ui/offline/outbox";
import { clearOfflineData } from "@/src/ui/offline/private-store";
import { saveTcuHint } from "@/src/ui/role-hint";
import { SignInLink } from "@/src/ui/SignInLink";
import { YourScreens } from "@/src/ui/YourScreens";
import { AadhaarCard } from "./AadhaarCard";
import { AlertsCard } from "./AlertsCard";
import { turnOffAlertsHere } from "./push";

const SELF_SERVICE = ["grower", "trader", "agent", "driver"] as const;
type Message = { kind: "ok" | "error"; text: string } | null;
const card = "flex flex-col gap-3 rounded-lg border border-border bg-elevated p-4";

// Your account (/me): ask for a role the first time, wait for TCU to approve
// it, then your name, language, location sharing (drivers), alerts, sign out
// and delete the account.
export function MeScreen({ pushKey = null, aadhaar = false }: { pushKey?: string | null; aadhaar?: boolean }) {
  const t = useTranslations("me");
  const [me, retry, refresh] = useApi<{ data: MeProfile }>("/api/v1/me");
  const isTcu = me.state === "ready" && me.value.data.role === "admin" && me.value.data.approval === "approved";
  // The header's "TCU desk" button follows what this page last saw.
  useEffect(() => {
    if (me.state === "ready") saveTcuHint(isTcu);
  }, [me.state, isTcu]);

  if (me.state === "loading") return <p role="status">{t("loading")}</p>;
  if (me.state === "error") {
    return (
      <div className="flex flex-col gap-2">
        <Notice kind="error">{t("err.load")}</Notice>
        <button type="button" className={quietButtonClass} onClick={retry}>
          {t("retry")}
        </button>
      </div>
    );
  }
  const profile = me.value.data;
  const approved = profile.approval === "approved";
  return (
    <div className="flex flex-col gap-5">
      {profile.onboarded && !approved && <ApprovalCard me={profile} />}
      {profile.onboarded && approved && <ApprovedTokenRefresh />}
      {profile.onboarded && approved && <YourScreens me={profile} />}
      {profile.onboarded ? <Profile me={profile} onSaved={retry} /> : <Onboarding />}
      {profile.onboarded && approved && aadhaar && (profile.role === "driver" || profile.role === "agent") && (
        <AadhaarCard me={profile} onVerified={refresh} />
      )}
      {profile.onboarded && <AlertsCard publicKey={pushKey} />}
      <Account me={profile} />
    </div>
  );
}

function Onboarding() {
  const t = useTranslations("me");
  const locale = useLocale() as Locale;
  const [role, setRole] = useState<(typeof SELF_SERVICE)[number] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!role) return;
    setBusy(true);
    setMessage(null);
    const res = await send("POST", "/api/v1/me/onboarding", {
      role,
      language: locale,
      display_name: name.trim(),
    });
    if (res.status === 200 || res.status === 201) {
      // Saved as a request; the page now shows "waiting for TCU".
      window.location.reload();
      return;
    }
    setBusy(false);
    setMessage({
      kind: "error",
      text:
        res.status === 409 ? t("err.roleTaken") : res.status === 429 ? t("err.tooMany") : res.status === 422 ? t("err.invalid") : t("err.server"),
    });
  }

  return (
    <form onSubmit={submit} noValidate className={card} aria-labelledby="onboarding">
      <h2 id="onboarding" className="text-xl font-bold">
        {t("onboarding.heading")}
      </h2>
      <p>{t("onboarding.intro")}</p>
      <ol className="flex list-decimal flex-col gap-1 ps-5 text-sm">
        <li>{t("onboarding.step1")}</li>
        <li>{t("onboarding.step2")}</li>
        <li>{t("onboarding.step3")}</li>
      </ol>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">{t("onboarding.role")}</legend>
        {SELF_SERVICE.map((r) => (
          <label
            key={r}
            className="flex min-h-12 items-start gap-3 rounded-md border border-border-strong bg-elevated p-3 has-checked:border-primary has-checked:bg-surface"
          >
            <input type="radio" name="role" className="mt-1 size-5" checked={role === r} onChange={() => setRole(r)} />
            <span className="flex flex-col">
              <span className="font-bold">{t(`role.${r}`)}</span>
              <span className="text-sm text-secondary">{t(`onboarding.what.${r}`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Field id="onboarding-name" label={t("name")} hint={t("nameHint")} invalid={false}>
        <input
          id="onboarding-name"
          className={inputClass}
          maxLength={60}
          autoComplete="name"
          required
          aria-required="true"
          value={name}
          aria-describedby="onboarding-name-hint"
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <p className="text-sm text-secondary">{t("onboarding.once")}</p>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <button type="submit" className={buttonClass} disabled={busy || !role || !name.trim()}>
        {busy ? t("saving") : t("onboarding.submit")}
      </button>
    </form>
  );
}

// Waiting for TCU, or turned down (with TCU's reason). The public map, the
// 48 h strip and the advisor work for everyone in the meantime.
function ApprovalCard({ me }: { me: MeProfile }) {
  const t = useTranslations("me");
  const rejected = me.approval === "rejected";
  return (
    <section
      className={`flex flex-col gap-2 rounded-lg border-s-4 p-4 ${rejected ? "border-high-fill bg-high-bg text-high-text" : "border-hold-fill bg-hold-bg text-hold-text"}`}
      aria-labelledby="approval"
      role="status"
    >
      <h2 id="approval" className="text-xl font-bold">
        {rejected ? t("approval.rejectedHeading") : t("approval.pendingHeading")}
      </h2>
      <p>
        {rejected
          ? t("approval.rejectedText", { role: me.role ? t(`role.${me.role}`) : "–" })
          : t("approval.pendingText", { role: me.role ? t(`role.${me.role}`) : "–" })}
      </p>
      {rejected && me.review_note && (
        <p>
          <span className="font-bold">{t("approval.reason")}</span> <bdi>{me.review_note}</bdi>
        </p>
      )}
      <p className="text-sm">{rejected ? t("approval.rejectedNext") : t("approval.meanwhile")}</p>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/" className="underline">
          {t("approval.map")}
        </Link>
        <Link href="/advisor" className="underline">
          {t("approval.advisor")}
        </Link>
      </p>
    </section>
  );
}

// After TCU approves, the role reaches the session token when it next
// refreshes (about a minute). Opening /me asks for a fresh token at once, so
// the board and the report screen open straight away.
function ApprovedTokenRefresh() {
  const { getToken } = useAuth();
  useEffect(() => {
    void getToken({ skipCache: true }).catch(() => null);
  }, [getToken]);
  return null;
}

function Profile({ me, onSaved }: { me: MeProfile; onSaved: () => void }) {
  const t = useTranslations("me");
  const tb = useTranslations("board");
  const current = useLocale() as Locale;
  const [name, setName] = useState(me.display_name ?? "");
  const [language, setLanguage] = useState<Locale>((me.language as Locale) ?? current);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [consentMessage, setConsentMessage] = useState<Message>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await send("PATCH", "/api/v1/me", { display_name: name.trim(), language });
    setBusy(false);
    if (res.status !== 200) {
      setMessage({ kind: "error", text: res.status === 422 ? t("err.invalid") : t("err.server") });
      return;
    }
    if (language !== current) {
      saveLocaleCookie(language);
      window.location.reload();
      return;
    }
    setMessage({ kind: "ok", text: t("saved") });
    onSaved();
  }

  async function setSharing(on: boolean) {
    setBusy(true);
    setConsentMessage(null);
    const res = await send("PATCH", "/api/v1/me", { location_consent: on });
    setBusy(false);
    if (res.status !== 200) {
      setConsentMessage({ kind: "error", text: t("err.server") });
      return;
    }
    setConsentMessage({ kind: "ok", text: on ? t("location.onDone") : t("location.offDone") });
    onSaved();
  }

  return (
    <>
      <div className={card}>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-secondary">{t("roleLabel")}</dt>
            <dd className="font-bold">
              {me.role ? t(`role.${me.role}`) : "–"}
              {me.approval && me.approval !== "approved" && (
                <span className="ms-2 text-sm font-normal text-secondary">({t(`approval.short.${me.approval}`)})</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-secondary">{t("levelLabel")}</dt>
            <dd className="flex flex-col">
              <span className="font-bold">{me.verification_level ? tb(`level.${me.verification_level}`) : "–"}</span>
              {me.verification_level && <span className="text-sm">{t(`levelMeans.${me.verification_level}`)}</span>}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-secondary">{t("roleChange")}</p>
        {me.approval === "approved" && (me.role === "agent" || me.role === "driver" || me.role === "grower" || me.role === "trader") && (
          <SignInLink href="/board" className="underline">
            {t("openBoard")}
          </SignInLink>
        )}
      </div>

      <form onSubmit={save} noValidate className={card} aria-labelledby="profile">
        <h2 id="profile" className="text-xl font-bold">
          {t("profile")}
        </h2>
        <Field id="me-name" label={t("name")} hint={t("nameHint")} invalid={false}>
          <input
            id="me-name"
            className={inputClass}
            maxLength={60}
            autoComplete="name"
            required
            aria-required="true"
            value={name}
            aria-describedby="me-name-hint"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field id="me-language" label={t("language")} invalid={false}>
          <select
            id="me-language"
            className={inputClass}
            value={language}
            onChange={(e) => setLanguage(e.target.value as Locale)}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l} lang={l}>
                {LOCALE_LABELS[l]}
              </option>
            ))}
          </select>
        </Field>
        {message && <Notice kind={message.kind}>{message.text}</Notice>}
        <button type="submit" className={buttonClass} disabled={busy || !name.trim()}>
          {busy ? t("saving") : t("save")}
        </button>
      </form>

      {me.role === "driver" && me.approval === "approved" && (
        <section className={card} aria-labelledby="location">
          <h2 id="location" className="text-xl font-bold">
            {t("location.heading")}
          </h2>
          <p>{t("location.what")}</p>
          <p className="font-bold">{me.location_consent ? t("location.isOn") : t("location.isOff")}</p>
          {consentMessage && <Notice kind={consentMessage.kind}>{consentMessage.text}</Notice>}
          <button
            type="button"
            className={me.location_consent ? quietButtonClass : buttonClass}
            disabled={busy}
            onClick={() => void setSharing(!me.location_consent)}
          >
            {me.location_consent ? t("location.turnOff") : t("location.turnOn")}
          </button>
          <p className="text-sm text-secondary">
            {t("location.consentNote")}{" "}
            <Link href="/privacy" className="underline">
              {t("privacyLink")}
            </Link>
          </p>
        </section>
      )}
    </>
  );
}

function Account({ me }: { me: MeProfile }) {
  const t = useTranslations("me");
  const { signOut } = useClerk();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const official = me.role === "admin";
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    void outboxCount().then(setWaiting);
  }, []);

  // Signing out (or deleting the account) also wipes what this phone kept
  // for this person: the board copy, the outbox and the service worker's
  // caches (src/ui/offline/private-store.ts).
  async function leave() {
    await turnOffAlertsHere();
    await clearOfflineData();
    saveTcuHint(false);
    await signOut({ redirectUrl: "/" }).catch(() => window.location.assign(new URL("/", window.location.origin)));
  }

  async function remove(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await send("DELETE", "/api/v1/me", { confirm: "DELETE" });
    if (res.status === 204) {
      // The Clerk account is gone; clear this browser's session as well.
      // A full page load to the start page, signed out.
      await leave();
      return;
    }
    setBusy(false);
    setMessage({
      kind: "error",
      text: res.status === 409 ? t("delete.official") : res.status === 503 ? t("delete.partly") : t("err.server"),
    });
  }

  return (
    <section className={card} aria-labelledby="account">
      <h2 id="account" className="text-xl font-bold">
        {t("account")}
      </h2>
      {waiting > 0 && <p className="text-sm">{t("signOutWaiting", { count: waiting })}</p>}
      <button type="button" className={quietButtonClass} onClick={() => void leave()}>
        {t("signOut")}
      </button>
      <details>
        <summary className="min-h-12 cursor-pointer py-3 font-bold text-high-text">{t("delete.heading")}</summary>
        {official ? (
          <p>{t("delete.official")}</p>
        ) : (
          <form onSubmit={remove} noValidate className="flex flex-col gap-3">
            <p>{t("delete.what")}</p>
            <Field id="delete-confirm" label={t("delete.type")} invalid={false}>
              <input
                id="delete-confirm"
                dir="ltr"
                autoComplete="off"
                className={inputClass}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
            {message && <Notice kind={message.kind}>{message.text}</Notice>}
            <button
              type="submit"
              className="min-h-12 rounded-md bg-high-fill px-4 font-bold text-inverse disabled:opacity-60"
              disabled={busy || confirm.trim() !== "DELETE"}
            >
              {busy ? t("saving") : t("delete.submit")}
            </button>
          </form>
        )}
      </details>
    </section>
  );
}
