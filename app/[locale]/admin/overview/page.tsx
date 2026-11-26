import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminGate } from "@/src/ui/admin/AdminGate";
import { RoadOverview } from "@/src/ui/admin/RoadOverview";
import { BackToAdmin } from "@/src/ui/admin/common";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.overview");
  return { title: t("heading"), robots: { index: false } };
}

// The road overview for TCU (see RoadOverview).
export default async function Page() {
  const t = await getTranslations("admin");
  return (
    <section className="flex flex-col gap-3">
      <BackToAdmin />
      <h1 className="text-2xl font-bold">{t("overview.heading")}</h1>
      <Suspense fallback={<p role="status">{t("loading")}</p>}>
        <AdminGate roles={["admin"]}>
          {(caller) => <RoadOverview canEditRoad={caller.role === "admin"} />}
        </AdminGate>
      </Suspense>
    </section>
  );
}
