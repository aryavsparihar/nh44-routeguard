"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AADHAAR_CONSENT_VERSION } from "@/src/shared/aadhaar";
import type { MeProfile } from "@/src/shared/api-types";
import { Notice, buttonClass, quietButtonClass } from "@/src/ui/admin/common";
import { send } from "@/src/ui/board/useShipments";

// Optional Aadhaar Secure QR check (BUILD_PROMPT section 11). The QR is read
// on this phone (camera or a picture chosen here); only its digits go to our
// server, which checks UIDAI's signature and the name. No picture is ever
// uploaded and nobody types an Aadhaar number.

type Result = { verdict: "verified" | "manual_review" | "rejected"; reason: string | null; test_key: boolean };
type Step = "intro" | "scanning" | "checking" | "done";
const card = "flex flex-col gap-3 rounded-lg border border-border bg-elevated p-4";

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

async function decodeFrame(source: HTMLVideoElement | ImageBitmap, canvas: HTMLCanvasElement): Promise<string | null> {
  if (window.BarcodeDetector) {
    try {
      const found = await new window.BarcodeDetector({ formats: ["qr_code"] }).detect(source);
      if (found[0]?.rawValue) return found[0].rawValue;
    } catch {
      // fall through to jsQR
    }
  }
  const w = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const h = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  if (!w || !h) return null;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  const { default: jsQR } = await import("jsqr");
  const img = ctx.getImageData(0, 0, w, h);
  const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
  ctx.clearRect(0, 0, w, h); // don't keep the picture around
  return code?.data ?? null;
}

export function AadhaarCard({ me, onVerified }: { me: MeProfile; onVerified: () => void }) {
  const t = useTranslations("me.aadhaar");
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState<Step>("intro");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  };
  useEffect(() => stopCamera, []);

  async function check(text: string) {
    stopCamera();
    if (!/^\d{100,16000}$/.test(text)) {
      setStep("intro");
      setError(t("notSecureQr"));
      return;
    }
    setStep("checking");
    const res = await send<Result>("POST", "/api/v1/verify/aadhaar-qr", {
      qr: text,
      consent: true,
      consent_version: AADHAAR_CONSENT_VERSION,
    });
    if (res.status === 200 && res.data) {
      setResult(res.data);
      setStep("done");
      if (res.data.verdict === "verified") onVerified();
      return;
    }
    setStep("intro");
    setError(res.status === 429 ? t("tooMany") : res.status === 404 || res.status === 503 ? t("off") : t("error"));
  }

  // The scan loop. Frames are read one at a time and never saved.
  useEffect(() => {
    if (step !== "scanning") return;
    let live = true;
    (async () => {
      try {
        stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        if (live) {
          setStep("intro");
          setError(t("noCamera"));
        }
        return;
      }
      const v = video.current;
      if (!live || !v) return stopCamera();
      v.srcObject = stream.current;
      await v.play().catch(() => null);
      while (live && stream.current) {
        const text = canvas.current ? await decodeFrame(v, canvas.current) : null;
        if (text && live) return void check(text);
        await new Promise((r) => setTimeout(r, 250));
      }
    })();
    return () => {
      live = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function fromPicture(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !canvas.current) return;
    setError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const text = await decodeFrame(bitmap, canvas.current);
      bitmap.close();
      if (text) await check(text);
      else setError(t("notFound"));
    } catch {
      setError(t("notFound"));
    }
  }

  const heading = (
    <h2 id="aadhaar" className="text-xl font-bold">
      {t("heading")}
    </h2>
  );

  if (me.verification_level === "aadhaar_qr" || me.verification_level === "official") {
    return (
      <section className={card} aria-labelledby="aadhaar">
        {heading}
        <p>{t("alreadyDone")}</p>
      </section>
    );
  }

  return (
    <section className={card} aria-labelledby="aadhaar">
      {heading}
      <p>{t("what")}</p>
      <canvas ref={canvas} hidden />

      {step === "done" && result && (
        <div className="flex flex-col gap-2" role="status">
          {result.test_key && (
            <p className="w-fit rounded-md border border-border-strong px-2 py-1 text-sm font-bold">{t("testKey")}</p>
          )}
          <Notice kind={result.verdict === "verified" ? "ok" : "error"}>
            {result.verdict === "verified"
              ? t("verified")
              : result.verdict === "manual_review"
                ? t("close")
                : t(`reason.${result.reason === "name" || result.reason === "signature" ? result.reason : "unreadable"}`)}
          </Notice>
          {result.verdict !== "verified" && (
            <button type="button" className={quietButtonClass} onClick={() => setStep("intro")}>
              {t("again")}
            </button>
          )}
        </div>
      )}

      {step === "intro" && (
        <>
          <details className="rounded-md border border-border p-3">
            <summary className="cursor-pointer font-bold">{t("consentHeading")}</summary>
            <ul className="mt-2 flex list-disc flex-col gap-1 ps-5 text-sm">
              <li>{t("consent.read")}</li>
              <li>{t("consent.keep")}</li>
              <li>{t("consent.never")}</li>
              <li>{t("consent.optional")}</li>
            </ul>
          </details>
          <label className="flex min-h-12 items-start gap-3 rounded-md border border-border-strong p-3 has-checked:border-primary">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{t("agree")}</span>
          </label>
          {error && <Notice kind="error">{error}</Notice>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass}
              disabled={!consent}
              onClick={() => {
                setError(null);
                setStep("scanning");
              }}
            >
              {t("scan")}
            </button>
            <label className={`${quietButtonClass} ${consent ? "cursor-pointer" : "pointer-events-none opacity-50"}`}>
              {t("picture")}
              <input type="file" accept="image/*" className="sr-only" disabled={!consent} onChange={(e) => void fromPicture(e)} />
            </label>
          </div>
          <p className="text-sm text-secondary">{t("pictureNote")}</p>
        </>
      )}

      {step === "scanning" && (
        <div className="flex flex-col gap-2">
          <video ref={video} className="aspect-square w-full rounded-md bg-black object-cover" muted playsInline aria-label={t("cameraLabel")} />
          <p role="status">{t("pointCamera")}</p>
          <button
            type="button"
            className={quietButtonClass}
            onClick={() => {
              stopCamera();
              setStep("intro");
            }}
          >
            {t("cancel")}
          </button>
        </div>
      )}

      {step === "checking" && <p role="status">{t("checking")}</p>}
    </section>
  );
}
