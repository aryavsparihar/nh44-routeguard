import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

// For addresses that match no route at all (the language-aware 404 is
// app/[locale]/not-found.tsx). This page skips the normal layouts, so it is
// plain and in all three languages at once.
export const metadata: Metadata = { title: "404 · NH-44 RouteGuard" };

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="p-6">
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p lang="hi">पेज नहीं मिला</p>
        <p lang="ur" dir="rtl">
          صفحہ نہیں ملا
        </p>
        <Link href="/" className="underline">
          NH-44 RouteGuard
        </Link>
      </body>
    </html>
  );
}
