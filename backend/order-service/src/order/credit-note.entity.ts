import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Avoir : annule tout ou partie de la facture d'une commande remboursée.
 * Numéro continu et sans trou (séquence orders.credit_note_seq), jamais
 * modifié ni supprimé une fois émis — seul le PDF est rattaché ensuite.
 */
@Entity({ name: 'credit_notes', schema: 'orders' })
export class CreditNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  number: string;

  @Index()
  @Column()
  order_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount_ht: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  tva_amount: number;

  // Part des frais « billets gratuits » de la facture (hors TVA), au prorata.
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  fees_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount_ttc: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', nullable: true })
  pdf_url: string | null;

  @CreateDateColumn()
  created_at: Date;
}
