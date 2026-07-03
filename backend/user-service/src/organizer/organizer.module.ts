import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoModule } from '../crypto/crypto.module';
import { OrganizerProfile } from './organizer-profile.entity';
import { OrganizerController } from './organizer.controller';
import { OrganizerService } from './organizer.service';

@Module({
  imports: [TypeOrmModule.forFeature([OrganizerProfile]), CryptoModule],
  controllers: [OrganizerController],
  providers: [OrganizerService],
  exports: [OrganizerService],
})
export class OrganizerModule {}
