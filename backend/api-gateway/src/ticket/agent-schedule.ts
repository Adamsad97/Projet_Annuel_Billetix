/** Événements qui n'occupent plus un agent (le contrôle n'aura pas lieu). */
const INACTIVE_STATUSES = ["CANCELLED", "ARCHIVED"];

export interface ScheduledEvent {
  id: string;
  title: string;
  start_date: string | Date;
  end_date: string | Date | null;
  status?: string;
}

/**
 * Un agent ne contrôle qu'un événement à la fois : renvoie l'événement déjà
 * affecté dont le créneau recoupe celui visé (le nouveau commence avant la
 * fin de l'autre et finit après son début), sinon null. Des créneaux qui se
 * touchent (fin de l'un = début de l'autre) ne se chevauchent pas.
 */
export function findScheduleConflict(target: ScheduledEvent, assigned: ScheduledEvent[]): ScheduledEvent | null {
  const start = new Date(target.start_date).getTime();
  const end = new Date(target.end_date ?? target.start_date).getTime();
  for (const other of assigned) {
    if (other.id === target.id || INACTIVE_STATUSES.includes(other.status ?? "")) continue;
    const otherStart = new Date(other.start_date).getTime();
    const otherEnd = new Date(other.end_date ?? other.start_date).getTime();
    if (start < otherEnd && otherStart < end) return other;
  }
  return null;
}
