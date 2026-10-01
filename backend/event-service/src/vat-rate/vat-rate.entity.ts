import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Taux de TVA proposés à l'organisateur (liste gérée par l'admin). Le taux
 * choisi est recopié sur l'événement : modifier ou supprimer une ligne de la
 * liste ne change jamais le prix d'un événement existant.
 */
@Entity({ name: 'vat_rates', schema: 'events' })
export class VatRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Ex. « Spectacles vivants, concerts ». */
  @Column({ length: 80 })
  label: string;

  /** Fraction : 0.055 pour 5,5 %. */
  @Column({ type: 'decimal', precision: 6, scale: 4 })
  rate: string;

  /** Taux proposé par défaut (un seul à la fois). */
  @Column({ default: false })
  is_default: boolean;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'int', default: 0 })
  display_order: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
