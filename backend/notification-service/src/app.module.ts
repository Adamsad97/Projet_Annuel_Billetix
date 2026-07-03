import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // À venir : MailerModule, EmailTemplatesModule, ScheduleModule (rappels J-1)
  ],
})
export class AppModule {}
