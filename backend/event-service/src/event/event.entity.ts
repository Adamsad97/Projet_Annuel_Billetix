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

  // Adresse lisible tirée du titre, figée dès la soumission pour qu'un lien partagé ne casse jamais.
  @Index('UQ_events_slug', { unique: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  slug: string | null;

  @Column({ type: 'text' })
  description: string;

  // Code d'une catégorie gérée par l'admin (table events.categories).
  @Column({ type: 'varchar', length: 30 })
  category: string;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.DRAFT })
  status: EventStatus;

  @Column({ default: false })
  is_non_profit: boolean;

  @Column({ nullable: true })
  non_profit_document_url: string | null;

  // L'exonération « but non lucratif » n'est appliquée qu'après validation du justificatif par un admin.
  @Column({ default: false })
  non_profit_verified: boolean;

  @Column({ nullable: true })
  non_profit_verified_at: Date | null;

  @Column({ nullable: true })
  non_profit_verified_by: string | null;

  // Refus du justificatif daté et motivé, effacé quand l'organisateur en envoie un nouveau.
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

  // Couverture horizontale (16:9) des cartes ; à défaut, l'affiche.
  @Column({ type: 'varchar', nullable: true })
  cover_url: string | null;

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

  // Taux de TVA des billets (fraction : 0.055 pour 5,5 %), recopié depuis la
  // liste de l'admin au choix de l'organisateur ; figé après validation.
  // Défaut en expression SQL : un nombre JS ferait croire à TypeORM que la colonne diffère (ALTER à chaque démarrage).
  @Column({ type: 'decimal', precision: 6, scale: 4, default: () => '0.2' })
  vat_rate: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  vat_rate_label: string | null;

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

  // Mis « À la une » de l'accueil par un admin (null : pas à la une).
  @Column({ type: 'timestamptz', nullable: true })
  featured_at: Date | null;

  @Column({ type: 'varchar', nullable: true })
  featured_by: string | null;

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

  // Report accepté : original_* garde les dates d'achat, rescheduled_at ouvre le délai de remboursement.
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

  // Évite de renvoyer l'alerte « délai de validation dépassé » ; remis à false à chaque nouvelle soumission ou réponse.
  @Column({ default: false })
  deadline_alert_sent: boolean;

  // Seuils de remplissage déjà notifiés (ex: [25, 50])
  @Column({ type: 'simple-json', default: '[]' })
  fill_thresholds_notified: number[];

  // CDC §9 : posé atomiquement à la première commande payée pour notifier une seule fois la première vente.
  @Column({ default: false })
  first_sale_notified: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
