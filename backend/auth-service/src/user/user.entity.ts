import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum UserRole {
  BUYER = "BUYER",
  ORGANIZER = "ORGANIZER",
  AGENT = "AGENT",
  ADMIN = "ADMIN",
  // Seul rôle habilité à agir sur un compte ADMIN ou SUPER_ADMIN.
  SUPER_ADMIN = "SUPER_ADMIN",
}

export enum OAuthProvider {
  GOOGLE = "GOOGLE",
  FACEBOOK = "FACEBOOK",
}

export enum TwoFactorMethod {
  TOTP = "TOTP",
}

@Entity({ name: "users", schema: "auth" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true, select: false })
  password_hash: string | null;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  // Format "YYYY-MM-DD" (type SQL date, sans heure ni fuseau). Nullable :
  // les comptes créés via Google/Facebook ne la fournissent pas.
  @Column({ type: "date", nullable: true })
  birth_date: string | null;

  @Column({ nullable: true })
  phone: string | null;

  @Column({ type: "enum", enum: UserRole, default: UserRole.BUYER })
  role: UserRole;

  // OAuth
  @Column({ type: "enum", enum: OAuthProvider, nullable: true })
  oauth_provider: OAuthProvider | null;

  @Column({ nullable: true })
  oauth_id: string | null;

  // Email verification
  @Column({ default: false })
  is_email_verified: boolean;

  @Column({ nullable: true })
  email_verified_at: Date | null;

  // 2FA
  @Column({ default: false })
  two_factor_enabled: boolean;

  @Column({ type: "enum", enum: TwoFactorMethod, nullable: true })
  two_factor_method: TwoFactorMethod | null;

  @Column({ nullable: true, select: false })
  two_factor_secret: string | null;

  // Compteur anti-bruteforce par compte (CDC §10.3), remis à zéro à la connexion réussie.
  @Column({ default: 0 })
  failed_login_attempts: number;

  @Column({ nullable: true })
  locked_until: Date | null;

  // État du compte
  @Column({ default: true })
  is_active: boolean;

  @Column({ default: false })
  is_suspended: boolean;

  @Column({ type: "text", nullable: true })
  suspension_reason: string | null;

  @Column({ nullable: true })
  suspended_at: Date | null;

  @Column({ nullable: true })
  suspended_by: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date | null;
}
