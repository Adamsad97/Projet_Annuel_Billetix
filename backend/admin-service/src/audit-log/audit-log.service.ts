import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Repository } from 'typeorm';
import { AuditAction, AuditEntityType, AuditLog } from './audit-log.entity';

/** Action à journaliser ; performed_by vaut l'identifiant du compte, ou « system » pour une tâche automatique. */
export class LogActionDto {
  @IsEnum(AuditAction) action: AuditAction;
  @IsEnum(AuditEntityType) entity_type: AuditEntityType;
  // Identifiant de l'entité : UUID, référence, ou clé de paramètre.
  @IsOptional() @IsString() @MaxLength(200) entity_id?: string;
  @IsString() @MaxLength(100) performed_by: string;
  @IsOptional() @IsEmail() performed_by_email?: string;
  @IsOptional() @IsString() @MaxLength(5000) reason?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(100) ip_address?: string;
}

/** Filtres du journal (message interne admin.get_logs). */
export class GetLogsDto {
  @IsOptional() @IsEnum(AuditEntityType) entity_type?: AuditEntityType;
  @IsOptional() @IsString() @MaxLength(200) entity_id?: string;
  @IsOptional() @IsString() @MaxLength(100) performed_by?: string;
  @IsOptional() @IsEnum(AuditAction) action?: AuditAction;
  // Recherche libre : email de l'auteur, entité, motif, détails (référence
  // de billet, email du bénéficiaire…), action.
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  // Recherche aussi dans l'adresse IP : réservée au super admin (donnée
  // personnelle), cf. api-gateway redact-ip.
  @IsOptional() @IsBoolean() search_ip?: boolean;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
  ) {}

  async log(dto: LogActionDto): Promise<AuditLog> {
    return this.repo.save(this.repo.create(dto));
  }

  async getLogs(filters: GetLogsDto): Promise<{ logs: AuditLog[]; total: number }> {
    const queryBuilder = this.repo.createQueryBuilder('log');

    if (filters.entity_type) {
      queryBuilder.andWhere('log.entity_type = :entityType', { entityType: filters.entity_type });
    }
    if (filters.entity_id) {
      queryBuilder.andWhere('log.entity_id = :entityId', { entityId: filters.entity_id });
    }
    if (filters.performed_by) {
      queryBuilder.andWhere('log.performed_by = :performedBy', { performedBy: filters.performed_by });
    }
    if (filters.action) {
      queryBuilder.andWhere('log.action = :action', { action: filters.action });
    }
    if (filters.q?.trim()) {
      queryBuilder.andWhere(
        `(log.performed_by_email ILIKE :q OR log.entity_id ILIKE :q OR log.reason ILIKE :q
          OR log.metadata::text ILIKE :q OR log.action::text ILIKE :q${filters.search_ip ? ' OR log.ip_address ILIKE :q' : ''})`,
        { q: `%${filters.q.trim()}%` },
      );
    }
    if (filters.from) {
      queryBuilder.andWhere('log.created_at >= :from', { from: new Date(filters.from) });
    }
    if (filters.to) {
      queryBuilder.andWhere('log.created_at <= :to', { to: new Date(filters.to) });
    }

    queryBuilder.orderBy('log.created_at', 'DESC')
      .take(filters.limit ?? 50)
      .skip(filters.offset ?? 0);

    const [logs, total] = await queryBuilder.getManyAndCount();
    return { logs, total };
  }

  async getStats(): Promise<{
    total_logs: number;
    by_action: Record<string, number>;
    by_entity: Record<string, number>;
    recent: AuditLog[];
  }> {
    const [total_logs, byAction, byEntity, recent] = await Promise.all([
      this.repo.count(),

      this.repo
        .createQueryBuilder('log')
        .select('log.action', 'action')
        .addSelect('COUNT(*)', 'count')
        .groupBy('log.action')
        .getRawMany<{ action: string; count: string }>(),

      this.repo
        .createQueryBuilder('log')
        .select('log.entity_type', 'entity_type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('log.entity_type')
        .getRawMany<{ entity_type: string; count: string }>(),

      this.repo.find({ order: { created_at: 'DESC' }, take: 10 }),
    ]);

    return {
      total_logs,
      by_action: Object.fromEntries(byAction.map((row) => [row.action, parseInt(row.count)])),
      by_entity: Object.fromEntries(byEntity.map((row) => [row.entity_type, parseInt(row.count)])),
      recent,
    };
  }
}
