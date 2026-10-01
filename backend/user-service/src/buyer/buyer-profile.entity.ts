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

  // Préférence (ex. « event-reminder ») → activée ou non ; sans clé, le frontend applique la valeur par défaut.
  @Column({ type: 'jsonb', nullable: true })
  notification_preferences: Record<string, boolean> | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
