import type { IconName } from "./icons";

// The bottom navigation from the Round 2 prototype: Map, 48 h, Advisor,
// Board, Report. A screen is listed here once it exists.
export type NavItem = { href: string; label: "map" | "strip" | "advisor" | "board" | "report"; icon: IconName };

export const NAV_ITEMS: NavItem[] = [{ href: "/", label: "map", icon: "nav-map" }];

// "/" is active only on the start page; "/board" also on "/board/123".
export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
