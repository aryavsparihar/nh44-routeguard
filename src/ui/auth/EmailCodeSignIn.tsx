"use client";

import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Field, Notice, buttonClass, inputClass, quietButtonClass } from "@/src/ui/admin/common";

type Step = { kind: "email" } | { kind: "code"; email: string; flow: "signIn" | "signUp" };

// Where to go after signing in: the page that sent you here (Clerk adds
// ?redirect_url=), but only a path on this site; otherwise your account page.
export function safeRedirect(raw: string | null, origin: string): string {
  if (!raw) return "/me";
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin || url.pathname.startsWith("/sign-in")) return "/me";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/me";
  }
}

function clerkCode(error: unknown): string {
  const e = error as { code?: string; errors?: { code?: string }[] } | null;
  return e?.errors?.[0]?.code ?? e?.code ?? "unknown";
}

// Sign in, or create an account, with a one-time code sent by email (no
// password; BUILD_PROMPT section 8). Built with Clerk's hooks so every word
// comes from our messages files, in English, Hindi and Urdu.
export function EmailCodeSignIn() {
  const t = useTranslations("auth");
  const { signIn, fetchStatus: signInStatus } = useSignIn();
  const { signUp, fetchStatus: signUpStatus } = useSignUp();
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const busy = signInStatus === "fetching" || signUpStatus === "fetching";

  function errorText(codeName: string): string {
    if (codeName === "form_identifier_not_found") return t("err.noAccount");
    if (codeName === "form_param_format_invalid" || codeName === "form_param_nil") return t("err.email");
    if (codeName === "form_code_incorrect" || codeName === "verification_failed") return t("err.code");
    if (codeName === "verification_expired") return t("err.expired");
    if (codeName === "too_many_requests" || codeName === "rate_limit_exceeded") return t("err.tooMany");
    if (codeName === "captcha_invalid" || codeName === "captcha_unavailable") return t("err.captcha");
    return t("err.other");
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const address = email.trim();
    const { error: createError } = await signIn.create({ identifier: address });
    if (!createError) {
      const { error: sendError } = await signIn.emailCode.sendCode();
      if (sendError) return setError(errorText(clerkCode(sendError)));
      setStep({ kind: "code", email: address, flow: "signIn" });
      return;
    }
    if (clerkCode(createError) !== "form_identifier_not_found") return setError(errorText(clerkCode(createError)));

    // No account with this email yet: create one, with the same code step.
    const { error: upError } = await signUp.create({ emailAddress: address });
    if (upError) return setError(errorText(clerkCode(upError)));
    const { error: upSendError } = await signUp.verifications.sendEmailCode();
    if (upSendError) return setError(errorText(clerkCode(upSendError)));
    setStep({ kind: "code", email: address, flow: "signUp" });
  }

  async function finish(finalize: (args: { navigate: (a: { decorateUrl: (u: string) => string }) => void }) => Promise<unknown>) {
    const target = safeRedirect(new URLSearchParams(window.location.search).get("redirect_url"), window.location.origin);
    await finalize({
      navigate: ({ decorateUrl }) => {
        // A full page load, so the server pages see the new session.
        window.location.href = decorateUrl(target);
      },
    });
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (step.kind !== "code") return;
    setError(null);
    const value = code.replace(/\s/g, "");
    if (step.flow === "signIn") {
      const { error: verifyError } = await signIn.emailCode.verifyCode({ code: value });
      if (verifyError) return setError(errorText(clerkCode(verifyError)));
      if (signIn.status === "complete") return finish((a) => signIn.finalize(a));
    } else {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code: value });
      if (verifyError) return setError(errorText(clerkCode(verifyError)));
      if (signUp.status === "complete") return finish((a) => signUp.finalize(a));
    }
    // Anything else (a second factor, missing sign-up fields) is not set up for
    // RouteGuard, so it would be a dashboard setting we don't use.
    setError(t("err.other"));
  }

  async function resend() {
    if (step.kind !== "code") return;
    setError(null);
    const { error: resendError } =
      step.flow === "signIn" ? await signIn.emailCode.sendCode() : await signUp.verifications.sendEmailCode();
    if (resendError) return setError(errorText(clerkCode(resendError)));
    setSent(true);
  }

  if (step.kind === "email") {
    return (
      <form onSubmit={sendCode} noValidate className="flex flex-col gap-4">
        <Field id="signin-email" label={t("email")} hint={t("emailHint")} invalid={false}>
          <input
            id="signin-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            required
            className={inputClass}
            value={email}
            aria-describedby="signin-email-hint"
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        {/* Clerk's bot check (a Cloudflare challenge) appears here when a new account is made. */}
        <div id="clerk-captcha" />
        {error && <Notice kind="error">{error}</Notice>}
        <button type="submit" className={buttonClass} disabled={busy || !email.includes("@")}>
          {busy ? t("working") : t("sendCode")}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} noValidate className="flex flex-col gap-4">
      <p role="status">
        {t("codeSent")} <bdi dir="ltr" className="font-bold">{step.email}</bdi>
      </p>
      <Field id="signin-code" label={t("code")} hint={t("codeHint")} invalid={false}>
        <input
          id="signin-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          maxLength={8}
          className={`${inputClass} font-mono tracking-widest`}
          value={code}
          aria-describedby="signin-code-hint"
          onChange={(e) => setCode(e.target.value)}
        />
      </Field>
      {error && <Notice kind="error">{error}</Notice>}
      {sent && !error && <Notice kind="ok">{t("resent")}</Notice>}
      <button type="submit" className={buttonClass} disabled={busy || code.replace(/\s/g, "").length < 6}>
        {busy ? t("working") : step.flow === "signIn" ? t("signIn") : t("createAccount")}
      </button>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={quietButtonClass} onClick={() => void resend()} disabled={busy}>
          {t("resend")}
        </button>
        <button
          type="button"
          className={quietButtonClass}
          onClick={() => {
            setStep({ kind: "email" });
            setCode("");
            setError(null);
            setSent(false);
          }}
        >
          {t("otherEmail")}
        </button>
      </div>
    </form>
  );
}
