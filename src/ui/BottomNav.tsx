"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon } from "./icons";
import { NAV_ITEMS, isActive } from "./nav";

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  return (
    <nav aria-label={t("label")} className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-elevated">
      <ul className="mx-auto flex max-w-2xl">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                prefetch={item.signIn ? false : undefined}
                aria-current={active ? "page" : undefined}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs text-secondary aria-[current=page]:font-bold aria-[current=page]:text-highway"
              >
                <Icon name={item.icon} />
                <span>{t(item.label)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
