"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

const DECODE_INTERVAL_MS = 200;
const MAX_FRAME_WIDTH = 640; // image réduite : décodage plus rapide, suffisant pour un QR

function cameraErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === "NotAllowedError") return "Accès à la caméra refusé : autorisez-le dans les réglages du navigateur.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Aucune caméra détectée sur cet appareil.";
  if (name === "NotReadableError") return "La caméra est déjà utilisée par une autre application.";
  return "Impossible d'ouvrir la caméra.";
}

/**
 * Caméra arrière de l'appareil et décodage des QR codes image par image.
 * `onCode` reçoit le texte de chaque QR lu ; `paused` suspend le décodage
 * (affichage d'un résultat) sans couper la caméra.
 */
export function CameraScanner({ onCode, paused }: { onCode: (text: string) => void; paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const pausedRef = useRef(paused);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onCodeRef.current = onCode;
    pausedRef.current = paused;
  }, [onCode, paused]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("La caméra n'est accessible qu'en connexion sécurisée (https).");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (err) {
        if (!cancelled) setError(cameraErrorMessage(err));
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setReady(true);

      timer = setInterval(() => {
        if (pausedRef.current || !context || video.readyState < video.HAVE_ENOUGH_DATA) return;
        const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" });
        if (code?.data) onCodeRef.current(code.data);
      }, DECODE_INTERVAL_MS);
    }

    void start();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
      {/* Cadre de visée */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-white">
          {error}
        </div>
      ) : !ready ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Ouverture de la caméra…</div>
      ) : null}
    </div>
  );
}
