import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum ScanResult {
  // QR dynamique authentique mais périmé (capture d'écran, code d'une
  // autre période) — le porteur doit afficher le code en direct.
  EXPIRED = 'EXPIRED',
  // Ancien QR fixe (PDF, capture d'avant le QR dynamique) : seul le code
  // éphémère affiché en direct dans l'application est accepté.
  STATIC_REFUSED = 'STATIC_REFUSED',
  SUCCESS = 'SUCCESS',
  ALREADY_USED = 'ALREADY_USED',
  INVALID = 'INVALID',
  CANCELLED = 'CANCELLED',
  // Billet valide et non utilisé, mais présenté au contrôle d'un autre
  // événement — distinct d'INVALID (faux/falsifié) : retour orange dédié
  // côté application de contrôle, cf. CDC section 6.2.
  WRONG_EVENT = 'WRONG_EVENT',
  // Signature cryptographique authentique (donc pas un faux code — un
  // ticketId/eventId totalement inventé échoue plus tôt, en INVALID), mais
  // ce n'est plus le QR actuellement valide pour ce billet — cas concret :
  // le vendeur présente son ancien email après avoir revendu son billet
  // (transferToNewBuyer régénère le token). Distinct d'INVALID pour que
  // l'agent voie "billet revendu" plutôt qu'un rejet générique opaque.
  // Même résultat après un transfert (billet offert) : l'ancien titulaire
  // ne peut plus entrer avec.
  SUPERSEDED = 'SUPERSEDED',
}

@Entity({ name: 'scan_logs', schema: 'tickets' })
export class ScanLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ticket_id: string;

  @Column()
  agent_id: string;

  @Column()
  event_id: string;

  @Column({ type: 'timestamptz' })
  scanned_at: Date;

  @Column({ type: 'enum', enum: ScanResult })
  result: ScanResult;

  @Column({ nullable: true })
  device_info: string | null;

  @Column({ default: false })
  is_offline: boolean;

  @CreateDateColumn()
  created_at: Date;
}
