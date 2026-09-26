"use client";

// QR code masqué par défaut (demande produit, sécurité) : il n'est demandé
// à l'API qu'au clic sur « Afficher mon QR code », s'affiche avec le nom du
// porteur, puis se masque tout seul après la durée réglée par l'admin
// (platform_settings.ticket_qr_display_seconds) — ou dès que l'onglet passe
// en arrière-plan. Limite les captures d'écran et les regards indiscrets.
// QR éphémère : il ne contient qu'un code aléatoire, renouvelé à chaque
// période (platform_settings.ticket_qr_rotation_seconds) tant qu'il est
// visible — une capture d'écran devient inutilisable au contrôle quelques
// secondes plus tard.

import { useEffect, useState } from "react";
import { getTicketQr } from "@/lib/api/tickets";
import { ApiError } from "@/lib/api/http-error";

export function TicketQrReveal({ ticketId, holderName }: { ticketId: string; holderName: string }) {
  const [qr, setQr] = useState<{ url: string; expiresAt: number; refreshIn: number } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!qr) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((qr.expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setQr(null);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    // Onglet masqué (changement d'application, écran verrouillé) : on cache.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") setQr(null);
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Code suivant à la fin de la période en cours.
    const refreshTimer = window.setTimeout(() => {
      getTicketQr(ticketId, true)
        .then((next) =>
          setQr((current) =>
            current ? { ...current, url: next.qr_code_url, refreshIn: next.refresh_in_seconds } : current,
          ),
        )
        .catch(() => setQr(null));
    }, qr.refreshIn * 1000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [qr, ticketId]);

  async function reveal() {
    setLoading(true);
    setError(null);
    try {
      const result = await getTicketQr(ticketId);
      setQr({
        url: result.qr_code_url,
        expiresAt: Date.now() + result.display_seconds * 1000,
        refreshIn: result.refresh_in_seconds,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'afficher le QR code, veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  if (!qr) {
    return (
      <div className="flex w-full flex-col items-center gap-3">
        <div className="flex h-40 w-40 items-center justify-center rounded-lg bg-hairline-2 text-ink-5" aria-hidden="true">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </div>
        <button
          type="button"
          onClick={reveal}
          disabled={loading}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Chargement…" : "Afficher mon QR code"}
        </button>
        <p className="max-w-xs text-center text-xs text-ink-5">
          Affichez-le seulement au moment du contrôle, et ne le partagez jamais : il permet
          d&apos;entrer à votre place.
        </p>
        {error ? <p className="text-center text-sm text-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="w-48 rounded-lg bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URI fourni à la demande par l'API, pas une image à optimiser */}
        <img src={qr.url} alt="QR code du billet" className="w-full" />
      </div>
      <p className="text-sm font-bold text-ink-1">{holderName}</p>
      <p className="text-xs font-medium text-success">
        Code dynamique : il change régulièrement, une capture d&apos;écran ne sera pas acceptée.
      </p>
      <p className="text-xs text-ink-5" aria-live="polite">
        Masqué automatiquement dans <span className="font-mono tabular-nums">{secondsLeft} s</span>
      </p>
      <button
        type="button"
        onClick={() => setQr(null)}
        className="text-xs font-medium text-link hover:text-link-hover"
      >
        Masquer maintenant
      </button>
    </div>
  );
}
