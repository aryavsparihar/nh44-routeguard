import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminGate } from "@/src/ui/admin/AdminGate";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("heading"), robots: { index: false } };
}

const LINKS = [
  { href: "/admin/updates", key: "updates", roles: ["police", "admin"] },
  { href: "/admin/reports", key: "reports", roles: ["admin"] },
  { href: "/admin/road-status", key: "roadStatus", roles: ["admin"] },
  { href: "/admin/audit", key: "audit", roles: ["admin"] },
  { href: "/admin/users", key: "users", roles: ["admin"] },
  { href: "/admin/jobs", key: "jobs", roles: ["admin"] },
] as const;

export default async function AdminPage() {
  const t = await getTranslations("admin");
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">{t("heading")}</h1>
      <p>{t("intro")}</p>
      <Suspense fallback={<p role="status">{t("loading")}</p>}>
        <AdminGate roles={["police", "admin"]}>
          {(caller) => (
            <ul className="flex flex-col gap-2">
              {LINKS.filter((l) => (l.roles as readonly string[]).includes(caller.role ?? "")).map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="flex min-h-12 flex-col rounded-lg border border-border bg-elevated p-3 hover:border-highway"
                  >
                    <span className="font-bold">{t(`links.${l.key}`)}</span>
                    <span className="text-sm text-secondary">{t(`hints.${l.key}`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AdminGate>
      </Suspense>
    </section>
  );
}
