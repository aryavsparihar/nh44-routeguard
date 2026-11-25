import type { IconName } from "./icons";

// The bottom navigation from the Round 2 prototype: Map, 48 h, Advisor,
// Board, Report. A screen is listed here once it exists.
// signIn: the page sends signed-out visitors to Clerk. Those are plain <a>
// links (a full page load): an in-app fetch or prefetch would follow the
// redirect to Clerk's host, which our CSP (rightly) blocks for fetches.
export type NavItem = {
  href: string;
  label: "map" | "strip" | "advisor" | "board" | "report";
  icon: IconName;
  signIn?: true;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "map", icon: "nav-map" },
  { href: "/strip", label: "strip", icon: "nav-strip" },
  { href: "/advisor", label: "advisor", icon: "nav-advisor" },
  { href: "/board", label: "board", icon: "nav-board", signIn: true },
  { href: "/report/new", label: "report", icon: "nav-report", signIn: true },
];

// "/" is active only on the start page; "/board" also on "/board/123".
export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
