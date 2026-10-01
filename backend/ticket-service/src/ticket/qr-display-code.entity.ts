import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/** Code aléatoire éphémère affiché dans le QR (BTX2.code), seul contenu du QR, renouvelé à chaque période. */
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
