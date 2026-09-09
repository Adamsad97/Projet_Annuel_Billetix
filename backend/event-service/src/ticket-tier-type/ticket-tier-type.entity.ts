import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Liste des noms de catégorie de billet ("Standard", "VIP"...) gérée depuis
// l'espace Admin — évite les doublons/variantes libres saisies par les
// organisateurs (ex: "Std", "VIP2" trouvés en base avant ce correctif).
// `label` est la valeur stable stockée directement sur
// ticket_categories.name (pas de code séparé : contrairement aux catégories
// d'événement, rien d'autre ne référence ce nom une fois la catégorie de
// billet créée — renommer ici n'affecte que les futures sélections).
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
