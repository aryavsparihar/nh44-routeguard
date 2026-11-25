import type { ReactNode } from "react";

// A link to a page that sends signed-out visitors to Clerk (/board,
// /report/new, /me). It is a plain <a>, so the browser does a full page
// load: an in-app (RSC) fetch or a prefetch would follow the redirect to
// Clerk's host, which our CSP (rightly) blocks for fetches.
export function SignInLink({
  href,
  className,
  current,
  children,
}: {
  href: string;
  className?: string;
  current?: boolean;
  children: ReactNode;
}) {
  return (
    <a href={href} className={className} aria-current={current ? "page" : undefined}>
      {children}
    </a>
  );
}
