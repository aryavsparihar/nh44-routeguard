import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminGate } from "@/src/ui/admin/AdminGate";
import { BackToAdmin } from "@/src/ui/admin/common";
import { UpdatesAdmin } from "@/src/ui/admin/UpdatesAdmin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.updates");
  return { title: t("heading"), robots: { index: false } };
}

export default async function Page() {
  const t = await getTranslations("admin");
  return (
    <section className="flex flex-col gap-3">
      <BackToAdmin />
      <h1 className="text-2xl font-bold">{t("updates.heading")}</h1>
      <Suspense fallback={<p role="status">{t("loading")}</p>}>
        <AdminGate roles={["admin"]}>{() => <UpdatesAdmin />}</AdminGate>
      </Suspense>
    </section>
  );
}
