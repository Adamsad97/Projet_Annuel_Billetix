import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'buyer_profiles', schema: 'users' })
export class BuyerProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  user_id: string;

  @Column({ nullable: true })
  billing_address_line1: string | null;

  @Column({ nullable: true })
  billing_address_line2: string | null;

  @Column({ nullable: true })
  billing_city: string | null;

  @Column({ nullable: true })
  billing_postal_code: string | null;

  @Column({ nullable: true })
  billing_country: string | null;

  // Clé = id de préférence (ex. "event-reminder"), valeur = activée ou non.
  // Absence de clé -> valeur par défaut appliquée côté frontend. Les
  // préférences verrouillées (locked, ex. "order-confirmation") ne sont pas
  // désactivables et ne sont donc jamais lues ici en pratique.
  @Column({ type: 'jsonb', nullable: true })
  notification_preferences: Record<string, boolean> | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
