import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { requirePageSignIn } from "@/src/server/auth/page";
import { reportsWriteEnabled } from "@/src/server/flags";
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
  return <ReportForm />;
}
