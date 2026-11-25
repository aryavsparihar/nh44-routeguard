import { notFound } from "next/navigation";

// Any page path we don't have shows the translated 404 (not-found.tsx).
export default function CatchAll() {
  notFound();
}
