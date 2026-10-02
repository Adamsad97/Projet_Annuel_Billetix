"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredUser } from "@/lib/auth/session";
import { time } from "@/lib/format/dates";
import { t } from "@/lib/i18n/translate";
import {
  connectRealtime,
  useRealtimeEvent,
  type AdminAlertMessage,
  type TicketScannedMessage,
} from "@/lib/realtime/socket";

interface Notice {
  id: number;
  tone: "success" | "warning" | "critical";
  title: string;
  text: string;
  href?: string;
}

const DISPLAY_MS = 10_000;
let nextId = 1;

function alertNotice(alert: AdminAlertMessage): Omit<Notice, "id"> {
  const { count = 0, threshold = 0, event_id } = alert.data;
  if (alert.type === "mass_refunds") {
    return {
      tone: "critical",
      title: t("Alerte : remboursements massifs"),
      text: t("{count} remboursements sur les dernières 24 h (seuil d'alerte : {threshold}).", { count, threshold }),
      href: "/admin/audit-trail",
    };
  }
  if (alert.type === "dispute_spike") {
    return {
      tone: "warning",
      title: t("Alerte : litiges en hausse"),
      text: t("{count} litiges ouverts (seuil d'alerte : {threshold}).", { count, threshold }),
      href: "/admin/litiges",
    };
  }
  return {
    tone: "warning",
    title: t("Alerte : double scan"),
    text: t("Un billet déjà utilisé a été présenté de nouveau à l'entrée : possible fraude."),
    href: event_id ? `/admin/evenements/${event_id}` : undefined,
  };
}

/** Notifications temps réel : billet scanné (titulaire) et alertes de seuil (admins), sur toutes les pages. */
export function RealtimeNotifier() {
  const pathname = usePathname();
  const [notices, setNotices] = useState<Notice[]>([]);

  // Connexion dès qu'une session existe (y compris juste après une connexion).
  useEffect(() => {
    connectRealtime();
  }, [pathname]);

  function push(notice: Omit<Notice, "id">) {
    const id = nextId++;
    setNotices((current) => [...current.slice(-2), { ...notice, id }]);
    setTimeout(() => setNotices((current) => current.filter((item) => item.id !== id)), DISPLAY_MS);
  }

  useRealtimeEvent<TicketScannedMessage>("ticket:scanned", (ticket) => {
    push({
      tone: "success",
      title: t("Billet scanné ✓"),
      text: t("Votre billet {category} pour « {event} » vient d'être validé à l'entrée à {time}.", {
        category: ticket.ticket_category_name,
        event: ticket.event_name,
        time: time.format(new Date(ticket.scanned_at)),
      }),
      href: `/billets/${ticket.ticket_id}`,
    });
  });

  useRealtimeEvent<AdminAlertMessage>("admin:alert", (alert) => {
    const role = getStoredUser()?.role;
    if (role === "ADMIN" || role === "SUPER_ADMIN") push(alertNotice(alert));
  });

  if (notices.length === 0) return null;

  const tones: Record<Notice["tone"], string> = {
    success: "border-emerald-500/40 bg-card",
    warning: "border-amber-500/50 bg-card",
    critical: "border-red-500/60 bg-card",
  };
  const dots: Record<Notice["tone"], string> = { success: "bg-emerald-500", warning: "bg-amber-500", critical: "bg-red-500" };

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
    >
      {notices.map((notice) => (
        <div key={notice.id} className={`pointer-events-auto rounded-2xl border p-4 shadow-xl shadow-black/15 ${tones[notice.tone]}`}>
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dots[notice.tone]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-1">{notice.title}</p>
              <p className="mt-0.5 text-sm text-ink-3">{notice.text}</p>
              {notice.href ? (
                <Link href={notice.href} className="mt-2 inline-block text-xs font-semibold text-link hover:text-link-hover">
                  {t("Voir le détail →")}
                </Link>
              ) : null}
            </div>
            <button
              type="button"
              aria-label={t("Fermer la notification")}
              onClick={() => setNotices((current) => current.filter((item) => item.id !== notice.id))}
              className="rounded-full p-1 text-ink-5 transition-colors hover:bg-hairline-1 hover:text-ink-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
