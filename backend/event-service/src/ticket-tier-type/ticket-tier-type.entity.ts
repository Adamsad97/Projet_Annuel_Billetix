import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Noms de catégories de billet gérés par l'admin ; label est recopié tel quel sur ticket_categories.name.
@Entity({ name: 'ticket_tier_types', schema: 'events' })
export class TicketTierType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 60, unique: true })
  label: string;

  @Column({ length: 8, nullable: true })
  emoji: string | null;

  @Column({ type: 'int', default: 0 })
  display_order: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
