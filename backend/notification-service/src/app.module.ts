import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const smtpUser = config.get<string>('SMTP_USER');
        return {
          transport: {
            host: config.get<string>('SMTP_HOST', 'mailhog'),
            port: parseInt(config.get<string>('SMTP_PORT', '1025')),
            secure: false,
            ...(smtpUser
              ? { auth: { user: smtpUser, pass: config.get<string>('SMTP_PASS') } }
              : {}),
          },
          defaults: {
            from: `"${config.get<string>('EMAIL_FROM_NAME', 'BilletiX')}" <${config.get<string>('EMAIL_FROM', 'noreply@billetix.fr')}>`,
          },
          template: {
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: { strict: true },
          },
        };
      },
    }),

    NotificationModule,
  ],
})
export class AppModule {}
