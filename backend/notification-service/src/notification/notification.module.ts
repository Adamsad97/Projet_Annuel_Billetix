import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { NotificationController } from './notification.controller';

@Module({
  imports: [MailModule],
  controllers: [NotificationController],
})
export class NotificationModule {}
