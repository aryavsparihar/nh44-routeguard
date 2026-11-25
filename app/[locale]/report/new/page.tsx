import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/src/server/db";
import { requirePageSignIn } from "@/src/server/auth/page";
import { aadhaarQrEnabled, reportsWriteEnabled } from "@/src/server/flags";
import { findUser } from "@/src/server/users/users.repository";
import { isVerifiedLevel } from "@/src/shared/verification";
import type { Role } from "@/src/server/http/caller";
import { ReportForm } from "@/src/ui/report/ReportForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("report");
  return { title: t("heading") };
}

const CAN_REPORT: Role[] = ["driver", "agent", "police", "admin"];

export default async function ReportPage() {
  const t = await getTranslations("report");
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">{t("heading")}</h1>
      <p>{t("intro")}</p>
      <Suspense fallback={<p role="status">{t("loading")}</p>}>
        <ReportGate />
      </Suspense>
    </section>
  );
}

// Reads the session and the FEATURE_REPORTS_WRITE switch at request time, so
// it sits inside <Suspense> (cacheComponents). The API checks both again.
async function ReportGate() {
  const t = await getTranslations("report");
  const caller = await requirePageSignIn();
  if (!reportsWriteEnabled()) {
    return <p className="rounded-md border border-hold-fill bg-hold-bg p-3 text-hold-text">{t("paused")}</p>;
  }
  if (!caller.role) return <p className="rounded-md bg-surface p-3">{t("noRole")}</p>;
  if (!CAN_REPORT.includes(caller.role)) return <p className="rounded-md bg-surface p-3">{t("wrongRole")}</p>;
  if (caller.role === "driver") {
    const me = await findUser(await getDb(), caller.userId);
    if (!isVerifiedLevel(me?.verification_level)) return <GetVerified aadhaar={aadhaarQrEnabled()} />;
  }
  return <ReportForm userId={caller.userId} driver={caller.role === "driver"} />;
}

// Drivers post only once verified (docs/decisions.md, 26 Nov 2026): a vouch
// from their agent, or the optional Aadhaar QR check when it is switched on.
async function GetVerified({ aadhaar }: { aadhaar: boolean }) {
  const t = await getTranslations("report.verify");
  const link = "inline-flex min-h-12 items-center self-start rounded-md border border-border-strong bg-elevated px-4 font-bold";
  return (
    <section aria-labelledby="get-verified" className="flex flex-col gap-3 rounded-lg border-s-4 border-hold-fill bg-hold-bg p-3 text-hold-text">
      <h2 id="get-verified" className="text-lg font-bold">
        {t("heading")}
      </h2>
      <p>{t("why")}</p>
      <p>{t("vouch")}</p>
      <Link href="/board" className={link}>
        {t("board")}
      </Link>
      {aadhaar && (
        <>
          <p>{t("aadhaar")}</p>
          <Link href="/me#aadhaar" className={link}>
            {t("account")}
          </Link>
        </>
      )}
      <p className="text-sm">{t("meanwhile")}</p>
    </section>
  );
}
