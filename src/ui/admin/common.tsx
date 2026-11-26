"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, type ReactNode } from "react";

// Shared bits of the admin screens: the back link, labelled fields that
// show when the server marked them wrong, and the error text for a status.

export const inputClass =
  "min-h-12 w-full min-w-0 rounded-md border border-border-strong bg-elevated px-3 text-base text-primary aria-[invalid=true]:border-high-fill";
export const buttonClass =
  "min-h-12 rounded-md bg-highway px-4 font-bold text-inverse disabled:opacity-60";
export const quietButtonClass =
  "min-h-12 rounded-md border border-border-strong bg-elevated px-4 text-primary disabled:opacity-60";

export function BackToAdmin() {
  const t = useTranslations("admin");
  return (
    <Link href="/admin" className="inline-flex min-h-12 items-center self-start text-sm font-bold underline">
      {t("back")}
    </Link>
  );
}

export function Field({
  id,
  label,
  hint,
  invalid,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  invalid: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("admin");
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="font-bold">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-secondary">
          {hint}
        </p>
      )}
      {children}
      {invalid && (
        <p id={`${id}-error`} className="text-sm font-bold text-high-text">
          {t("fieldInvalid")}
        </p>
      )}
    </div>
  );
}

// The message for a failed request (status 0 = no connection).
export function useErrorText() {
  const t = useTranslations("admin.err");
  // Stable between renders, so screens can list it in effect dependencies.
  return useCallback(
    (status: number): string => {
      if (status === 422 || status === 400) return t("invalid");
      if (status === 401) return t("signedOut");
      if (status === 403) return t("forbidden");
      if (status === 404) return t("notFound");
      if (status === 409) return t("conflict");
      return t("server");
    },
    [t],
  );
}

export function Notice({ kind, children }: { kind: "ok" | "error"; children: ReactNode }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={
        kind === "error"
          ? "rounded-md border border-high-fill bg-high-bg p-3 text-high-text"
          : "rounded-md border border-send-fill bg-send-bg p-3 text-send-text"
      }
    >
      {children}
    </p>
  );
}

// <input type="datetime-local"> holds a time without a zone. These screens
// always mean India time, like every time the app shows.
const IST_OFFSET_MS = 330 * 60_000;

export function toIstInput(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}

export function fromIstInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  return new Date(`${value}:00+05:30`).toISOString();
}
