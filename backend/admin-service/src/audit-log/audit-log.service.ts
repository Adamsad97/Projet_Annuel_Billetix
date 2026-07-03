import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditEntityType, AuditLog } from './audit-log.entity';

export interface LogActionDto {
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id?: string;
  performed_by: string;
  performed_by_email?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
}

export interface GetLogsDto {
  entity_type?: AuditEntityType;
  entity_id?: string;
  performed_by?: string;
  action?: AuditAction;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
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
    const qb = this.repo.createQueryBuilder('log');

    if (filters.entity_type) {
      qb.andWhere('log.entity_type = :et', { et: filters.entity_type });
    }
    if (filters.entity_id) {
      qb.andWhere('log.entity_id = :eid', { eid: filters.entity_id });
    }
    if (filters.performed_by) {
      qb.andWhere('log.performed_by = :pb', { pb: filters.performed_by });
    }
    if (filters.action) {
      qb.andWhere('log.action = :action', { action: filters.action });
    }
    if (filters.from) {
      qb.andWhere('log.created_at >= :from', { from: new Date(filters.from) });
    }
    if (filters.to) {
      qb.andWhere('log.created_at <= :to', { to: new Date(filters.to) });
    }

    qb.orderBy('log.created_at', 'DESC')
      .take(filters.limit ?? 50)
      .skip(filters.offset ?? 0);

    const [logs, total] = await qb.getManyAndCount();
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
      by_action: Object.fromEntries(byAction.map((r) => [r.action, parseInt(r.count)])),
      by_entity: Object.fromEntries(byEntity.map((r) => [r.entity_type, parseInt(r.count)])),
      recent,
    };
  }
}
