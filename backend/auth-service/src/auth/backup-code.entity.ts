import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'backup_codes', schema: 'auth' })
export class BackupCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  user_id: string;

  // Haché (bcrypt) — jamais stocké en clair, à l'image de password_hash.
  @Column()
  code_hash: string;

  @Column({ nullable: true })
  used_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
