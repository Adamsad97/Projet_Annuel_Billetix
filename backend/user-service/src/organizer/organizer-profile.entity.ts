import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum KycStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

@Entity({ name: 'organizer_profiles', schema: 'users' })
export class OrganizerProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  user_id: string;

  @Column()
  display_name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ nullable: true })
  logo_url: string | null;

  @Column({ nullable: true })
  website_url: string | null;

  @Column({ nullable: true })
  social_instagram: string | null;

  @Column({ nullable: true })
  social_facebook: string | null;

  @Column({ nullable: true })
  social_twitter: string | null;

  @Column({ nullable: true })
  social_youtube: string | null;

  // IBAN chiffré AES-256-GCM (3 colonnes : données + iv + tag)
  @Column({ nullable: true, select: false })
  iban_encrypted: string | null;

  @Column({ nullable: true, select: false })
  iban_iv: string | null;

  @Column({ nullable: true, select: false })
  iban_tag: string | null;

  @Column({ nullable: true })
  bank_owner_name: string | null;

  @Column({ nullable: true })
  stripe_connect_account_id: string | null;

  @Column({ default: false })
  stripe_connect_onboarded: boolean;

  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING })
  kyc_status: KycStatus;

  @Column({ nullable: true })
  kyc_submitted_at: Date | null;

  @Column({ nullable: true })
  kyc_verified_at: Date | null;

  @Column({ type: 'text', nullable: true })
  kyc_rejected_reason: string | null;

  @Column({ nullable: true })
  kyc_document_url: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
