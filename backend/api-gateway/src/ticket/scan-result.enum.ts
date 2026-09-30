export enum ScanResult {
  SUCCESS = "SUCCESS",
  ALREADY_USED = "ALREADY_USED",
  INVALID = "INVALID",
  CANCELLED = "CANCELLED",
  WRONG_EVENT = "WRONG_EVENT",
  SUPERSEDED = "SUPERSEDED",
  EXPIRED = "EXPIRED",
  STATIC_REFUSED = "STATIC_REFUSED",
  // Événement annulé, suspendu, masqué ou non publié.
  EVENT_UNAVAILABLE = "EVENT_UNAVAILABLE",
  // Hors de la fenêtre de contrôle (réglages admin).
  TOO_EARLY = "TOO_EARLY",
  TOO_LATE = "TOO_LATE",
  // Billet mis en revente par son titulaire.
  FOR_RESALE = "FOR_RESALE",
}
