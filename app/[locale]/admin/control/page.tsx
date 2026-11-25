import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminGate } from "@/src/ui/admin/AdminGate";
import { ControlRoom } from "@/src/ui/admin/ControlRoom";
import { BackToAdmin } from "@/src/ui/admin/common";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.control");
  return { title: t("heading"), robots: { index: false } };
}

// The control room for the police and admin accounts (see ControlRoom).
export default async function Page() {
  const t = await getTranslations("admin");
  return (
    <section className="flex flex-col gap-3">
      <BackToAdmin />
      <h1 className="text-2xl font-bold">{t("control.heading")}</h1>
      <Suspense fallback={<p role="status">{t("loading")}</p>}>
        <AdminGate roles={["police", "admin"]}>
          {(caller) => <ControlRoom canEditRoad={caller.role === "admin"} />}
        </AdminGate>
      </Suspense>
    </section>
  );
}
