import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Remplace l'ancien enum Postgres figé `events_category_enum` : la liste des
// catégories doit être gérable depuis l'espace Admin sans nouveau déploiement
// (cf. règle projet "pas de valeurs en dur"). `code` est la valeur stable
// stockée sur events.category — immuable une fois créée, contrairement à
// `label`/`emoji` qui restent modifiables à tout moment.
@Entity({ name: 'categories', schema: 'events' })
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 30, unique: true })
  code: string;

  @Column({ length: 60 })
  label: string;

  @Column({ length: 8, nullable: true })
  emoji: string | null;

  @Column({ type: 'int', default: 0 })
  display_order: number;

  // Désactiver (plutôt que supprimer) préserve les événements existants qui
  // référencent encore ce code — cf. CategoryService.remove.
  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
