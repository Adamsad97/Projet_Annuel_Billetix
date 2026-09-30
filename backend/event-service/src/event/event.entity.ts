import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, Index } from 'typeorm';

export enum EventStatus {
  DRAFT = 'DRAFT',
  PENDING_VALIDATION = 'PENDING_VALIDATION',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
  TERMINATED = 'TERMINATED',
  ARCHIVED = 'ARCHIVED',
  SUSPENDED = 'SUSPENDED',
  // Reporté sans nouvelle date : ventes et contrôle suspendus jusqu'à ce que
  // l'organisateur fixe la nouvelle date (retour à PUBLISHED).
  POSTPONED = 'POSTPONED',
}

export enum RefundPolicy {
  NON_REFUNDABLE = 'NON_REFUNDABLE',
  REFUNDABLE = 'REFUNDABLE',
}

@Entity({ name: 'events', schema: 'events' })
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organizer_id: string;

  @Column({ length: 120 })
  title: string;

  // Adresse lisible de la page publique (/evenements/afro-vibes-festival-2026),
  // tirée du titre. Suit le titre tant que l'événement est un brouillon, puis
  // reste figée (le titre est verrouillé dès la soumission) : un lien partagé
  // ne casse jamais. Nullable le temps du remplissage des lignes existantes.
  @Index('UQ_events_slug', { unique: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  slug: string | null;

  @Column({ type: 'text' })
  description: string;

  // Code d'une catégorie gérée depuis l'espace Admin (cf. category/category.entity.ts,
  // colonne events.categories.code) — n'est plus un enum Postgres figé pour
  // permettre à l'admin d'ajouter/retirer des catégories sans déploiement.
  @Column({ type: 'varchar', length: 30 })
  category: string;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.DRAFT })
  status: EventStatus;

  @Column({ default: false })
  is_non_profit: boolean;

  @Column({ nullable: true })
  non_profit_document_url: string | null;

  // Bug corrigé : la commission 0% était accordée automatiquement dès que
  // is_non_profit=true (auto-déclaré par l'organisateur, jamais vérifié) —
  // désormais un admin doit explicitement valider le justificatif via
  // event.verify_non_profit avant que l'exonération ne s'applique à la
  // validation de l'événement (cf. EventService.computeCommissionRate).
  @Column({ default: false })
  non_profit_verified: boolean;

  @Column({ nullable: true })
  non_profit_verified_at: Date | null;

  @Column({ nullable: true })
  non_profit_verified_by: string | null;

  // Bug corrigé : un refus remettait seulement non_profit_verified à false
  // — l'état « en attente » — sans rien enregistrer : l'admin revoyait le
  // justificatif à examiner, pouvait le refuser en boucle (un email à
  // chaque fois) et l'organisateur ne savait pas pourquoi. Refus daté et
  // motivé ; effacé quand l'organisateur envoie un nouveau justificatif.
  @Column({ type: 'timestamptz', nullable: true })
  non_profit_rejected_at: Date | null;

  @Column({ type: 'text', nullable: true })
  non_profit_rejection_reason: string | null;

  @Column({ type: 'timestamptz' })
  start_date: Date;

  @Column({ type: 'timestamptz' })
  end_date: Date;

  @Column({ default: 'Europe/Paris' })
  timezone: string;

  @Column()
  venue_name: string;

  @Column()
  venue_address_line1: string;

  @Column({ nullable: true })
  venue_address_line2: string | null;

  @Column()
  venue_city: string;

  @Column()
  venue_postal_code: string;

  @Column()
  venue_country: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  venue_latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  venue_longitude: number | null;

  @Column()
  poster_url: string;

  @Column({ type: 'int' })
  total_capacity: number;

  @Column({ type: 'timestamptz' })
  sales_start_date: Date;

  @Column({ type: 'timestamptz' })
  sales_end_date: Date;

  @Column({ type: 'enum', enum: RefundPolicy })
  refund_policy: RefundPolicy;

  @Column({ type: 'int', nullable: true })
  refund_deadline_days: number | null;

  @Column({ type: 'text', nullable: true })
  access_conditions: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  commission_rate: number;

  // Workflow validation
  @Column({ nullable: true })
  validation_requested_at: Date | null;

  @Column({ nullable: true })
  validated_at: Date | null;

  @Column({ nullable: true })
  validated_by: string | null;

  @Column({ nullable: true })
  rejected_at: Date | null;

  @Column({ nullable: true })
  rejected_by: string | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @Column({ nullable: true })
  suspended_at: Date | null;

  @Column({ nullable: true })
  suspended_by: string | null;

  @Column({ type: 'text', nullable: true })
  suspension_reason: string | null;

  // Masqué par un admin : retiré du catalogue, page publique indisponible,
  // ventes bloquées. Les billets déjà vendus restent valables.
  @Column({ default: false })
  is_hidden: boolean;

  @Column({ nullable: true })
  hidden_at: Date | null;

  @Column({ nullable: true })
  hidden_by: string | null;

  @Column({ type: 'text', nullable: true })
  hidden_reason: string | null;

  @Column({ nullable: true })
  cancelled_at: Date | null;

  @Column({ nullable: true })
  cancelled_by: string | null;

  @Column({ type: 'text', nullable: true })
  cancellation_reason: string | null;

  // Report accepté par un admin. original_* : dates annoncées à l'achat ;
  // rescheduled_at : annonce de la nouvelle date, point de départ du délai
  // pendant lequel un acheteur peut demander le remboursement.
  @Column({ type: 'timestamptz', nullable: true })
  postponed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  postponement_reason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  original_start_date: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  original_end_date: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  rescheduled_at: Date | null;

  @Column({ nullable: true })
  terminated_at: Date | null;

  @Column({ nullable: true })
  archived_at: Date | null;

  // Évite de renvoyer plusieurs fois l'alerte admin "délai de validation
  // dépassé" pour le même événement — remis à false à chaque nouvelle
  // soumission ou réponse à une demande de complément d'info.
  @Column({ default: false })
  deadline_alert_sent: boolean;

  // Seuils de remplissage déjà notifiés (ex: [25, 50])
  @Column({ type: 'simple-json', default: '[]' })
  fill_thresholds_notified: number[];

  // Bug corrigé (CDC §9) : notification "première vente" à l'organisateur
  // jamais envoyée — flag posé atomiquement dès la première commande
  // effectivement payée (pas la première réservation, qui peut expirer sans
  // achat réel), cf. EventService.markFirstSale.
  @Column({ default: false })
  first_sale_notified: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
