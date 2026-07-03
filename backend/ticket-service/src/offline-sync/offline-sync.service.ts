import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScanDto, ScanService } from '../scan/scan.service';
import { ScanResult } from '../scan/scan-log.entity';
import { OfflineSyncLog, SyncStatus } from './offline-sync-log.entity';

export interface OfflineScanEntry {
  qr_token: string;
  ticket_id?: string;
  scanned_at_offline: string;
  device_info?: string;
}

@Injectable()
export class OfflineSyncService {
  constructor(
    @InjectRepository(OfflineSyncLog) private readonly repo: Repository<OfflineSyncLog>,
    private readonly scanService: ScanService,
  ) {}

  async syncBatch(
    agentId: string,
    eventId: string,
    entries: OfflineScanEntry[],
  ): Promise<{ synced: number; conflicts: number; errors: number }> {
    let synced = 0;
    let conflicts = 0;
    let errors = 0;
    const syncedAt = new Date();

    for (const entry of entries) {
      let status = SyncStatus.SYNCED;
      let conflictDetail: string | null = null;
      let ticketId = entry.ticket_id ?? 'unknown';

      try {
        const scanDto: ScanDto = {
          qr_token: entry.qr_token,
          agent_id: agentId,
          event_id: eventId,
          device_info: entry.device_info,
          is_offline: true,
          scanned_at: entry.scanned_at_offline,
        };
        const res = await this.scanService.scan(scanDto);
        ticketId = res.ticket_id;

        if (res.result === ScanResult.ALREADY_USED) {
          status = SyncStatus.CONFLICT;
          conflictDetail = 'Billet déjà scanné en ligne avant la synchronisation';
          conflicts++;
        } else if (res.result === ScanResult.INVALID || res.result === ScanResult.CANCELLED) {
          status = SyncStatus.ERROR;
          conflictDetail = `Scan invalide : ${res.result}`;
          errors++;
        } else {
          synced++;
        }
      } catch {
        status = SyncStatus.ERROR;
        conflictDetail = 'Erreur lors de la synchronisation';
        errors++;
      }

      await this.repo.save(
        this.repo.create({
          agent_id: agentId,
          event_id: eventId,
          ticket_id: ticketId,
          scanned_at_offline: new Date(entry.scanned_at_offline),
          synced_at: syncedAt,
          status,
          conflict_detail: conflictDetail,
        }),
      );
    }

    return { synced, conflicts, errors };
  }

  async getLogs(eventId: string): Promise<OfflineSyncLog[]> {
    return this.repo.find({ where: { event_id: eventId }, order: { synced_at: 'DESC' } });
  }
}
