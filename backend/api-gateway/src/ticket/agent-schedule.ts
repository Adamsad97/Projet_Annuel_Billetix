/** Événements qui n'occupent plus un agent (le contrôle n'aura pas lieu). */
const INACTIVE_STATUSES = ["CANCELLED", "ARCHIVED"];

export interface ScheduledEvent {
  id: string;
  title: string;
  start_date: string | Date;
  end_date: string | Date | null;
  status?: string;
}

/** Créneau d'un autre événement de l'agent qui chevauche celui visé, sinon null (se toucher n'est pas chevaucher). */
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
