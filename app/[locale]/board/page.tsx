import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { requirePageSignIn } from "@/src/server/auth/page";
import { BoardScreen, type BoardRole } from "@/src/ui/board/BoardScreen";
import { SignInLink } from "@/src/ui/SignInLink";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("board");
  return { title: t("heading") };
}

const BOARD_ROLES: BoardRole[] = ["agent", "driver", "grower", "trader", "admin"];

export default async function BoardPage() {
  const t = await getTranslations("board");
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">{t("heading")}</h1>
      <Suspense fallback={<p role="status">{t("loading")}</p>}>
        <BoardGate />
      </Suspense>
    </section>
  );
}

// Reads the session at request time, so it sits inside <Suspense>
// (cacheComponents).
async function BoardGate() {
  const t = await getTranslations("board");
  const caller = await requirePageSignIn();
  if (!caller.role) {
    return (
      <p className="rounded-md bg-surface p-3">
        {t("noRole")}{" "}
        <SignInLink href="/me" className="underline">
          {t("pickRole")}
        </SignInLink>
      </p>
    );
  }
  if (!(BOARD_ROLES as string[]).includes(caller.role)) {
    return <p className="rounded-md bg-surface p-3">{t("wrongRole")}</p>;
  }
  return (
    <>
      <p>{t(`intro.${caller.role as BoardRole}`)}</p>
      <BoardScreen role={caller.role as BoardRole} userId={caller.userId} />
    </>
  );
}
