import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScanModule } from '../scan/scan.module';
import { OfflineSyncLog } from './offline-sync-log.entity';
import { OfflineSyncController } from './offline-sync.controller';
import { OfflineSyncService } from './offline-sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([OfflineSyncLog]), ScanModule],
  controllers: [OfflineSyncController],
  providers: [OfflineSyncService],
})
export class OfflineSyncModule {}
