// Statut d'un événement vu par l'appareil de contrôle (agent, organisateur) :
// l'état décidé par l'organisation passe avant le calendrier.

export interface StatusSource {
  status?: string;
  is_hidden?: boolean;
  start_date: string;
  end_date?: string | null;
}

export type ScanEventStatusKey =
  | "CANCELLED"
  | "SUSPENDED"
  | "POSTPONED"
  | "UNAVAILABLE"
  | "PENDING"
  | "ENDED"
  | "ONGOING"
  | "UPCOMING";

export interface ScanEventStatus {
  key: ScanEventStatusKey;
  label: string;
  /** Classes du badge (fond clair). */
  badge: string;
  /** Aucun contrôle possible : l'organisation l'a fermé ou pas encore ouvert. */
  closed: boolean;
}

const STATUSES: Record<ScanEventStatusKey, Omit<ScanEventStatus, "key">> = {
  CANCELLED: { label: "Annulé", badge: "bg-red-500/15 text-red-600", closed: true },
  SUSPENDED: { label: "Suspendu", badge: "bg-amber-500/15 text-amber-600", closed: true },
  POSTPONED: { label: "Reporté", badge: "bg-amber-500/15 text-amber-600", closed: true },
  UNAVAILABLE: { label: "Indisponible", badge: "bg-amber-500/15 text-amber-600", closed: true },
  PENDING: { label: "En attente de validation", badge: "bg-hairline-2 text-ink-3", closed: true },
  ENDED: { label: "Terminé", badge: "bg-hairline-2 text-ink-4", closed: false },
  ONGOING: { label: "En cours", badge: "bg-emerald-500/15 text-emerald-600", closed: false },
  UPCOMING: { label: "À venir", badge: "bg-blue-500/15 text-blue-600", closed: false },
};

export function scanEventStatus(event: StatusSource, now = Date.now()): ScanEventStatus {
  const key: ScanEventStatusKey = (() => {
    if (event.status === "CANCELLED") return "CANCELLED";
    if (event.status === "SUSPENDED") return "SUSPENDED";
    if (event.status === "POSTPONED") return "POSTPONED";
    if (event.is_hidden) return "UNAVAILABLE";
    if (event.status === "DRAFT" || event.status === "PENDING_VALIDATION") return "PENDING";
    const start = new Date(event.start_date).getTime();
    const end = new Date(event.end_date ?? event.start_date).getTime();
    if (event.status === "TERMINATED" || event.status === "ARCHIVED" || end < now) return "ENDED";
    return start <= now ? "ONGOING" : "UPCOMING";
  })();
  return { key, ...STATUSES[key] };
}

/** Consigne affichée à l'agent quand l'événement est fermé au contrôle. */
export function closedEventNotice(
  status: ScanEventStatusKey,
  reason?: string | null,
): { title: string; text: string; reason: string | null } | null {
  const motive = reason?.trim() || null;
  switch (status) {
    case "CANCELLED":
      return { title: "Événement annulé", text: "Aucun contrôle à effectuer : les participants sont remboursés.", reason: motive };
    case "SUSPENDED":
      return { title: "Événement suspendu", text: "Les entrées sont bloquées jusqu'à nouvel ordre de l'organisation.", reason: motive };
    case "POSTPONED":
      return {
        title: "Événement reporté",
        text: "Nouvelle date à venir : le contrôle reprendra à la date fixée par l'organisateur.",
        reason: motive,
      };
    case "UNAVAILABLE":
      return { title: "Événement indisponible", text: "L'administration a retiré l'événement : les entrées sont bloquées.", reason: null };
    case "PENDING":
      return { title: "Événement pas encore publié", text: "Aucun billet n'est encore vendu : rien à contrôler pour l'instant.", reason: null };
    default:
      return null;
  }
}
