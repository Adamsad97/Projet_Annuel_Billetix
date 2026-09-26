import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Code affiché dans le QR d'un billet — valeur aléatoire éphémère (128 bits),
 * renouvelée à chaque période (platform_settings.ticket_qr_rotation_seconds).
 * Le QR ne contient QUE ce code (`BTX2.<code>`) : aucun jeton, identifiant,
 * nom ou événement — il ne prend son sens qu'à travers cette table côté
 * serveur. Conservé le temps de la synchronisation des scans hors ligne
 * (OFFLINE_SYNC_MAX_HOURS), puis effacé (QrDisplayCodeCleanupService).
 */
@Entity({ schema: 'tickets', name: 'qr_display_codes' })
export class QrDisplayCode {
  @PrimaryColumn()
  code: string;

  @Index()
  @Column()
  ticket_id: string;

  // Jeton interne du billet au moment de l'émission — jamais dans le QR.
  // Détecte un code émis avant une revente (résultat SUPERSEDED).
  @Column()
  ticket_token: string;

  @Column({ type: 'timestamptz' })
  valid_from: Date;

  @Index()
  @Column({ type: 'timestamptz' })
  valid_until: Date;

  @CreateDateColumn()
  created_at: Date;
}
