import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { SmsModule } from '../sms/sms.module';
import { NotificationController } from './notification.controller';

@Module({
  imports: [MailModule, SmsModule],
  controllers: [NotificationController],
})
export class NotificationModule {}
