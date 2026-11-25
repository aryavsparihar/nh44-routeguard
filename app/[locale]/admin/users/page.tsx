import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminGate } from "@/src/ui/admin/AdminGate";
import { BackToAdmin } from "@/src/ui/admin/common";
import { RolesAdmin } from "@/src/ui/admin/RolesAdmin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.users");
  return { title: t("heading"), robots: { index: false } };
}

export default async function Page() {
  const t = await getTranslations("admin");
  return (
    <section className="flex flex-col gap-3">
      <BackToAdmin />
      <h1 className="text-2xl font-bold">{t("users.heading")}</h1>
      <Suspense fallback={<p role="status">{t("loading")}</p>}>
        <AdminGate roles={["admin"]}>{() => <RolesAdmin />}</AdminGate>
      </Suspense>
    </section>
  );
}
