import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { NotificationModule } from './notification/notification.module';
import { HealthModule } from './health/health.module';
import { PlatformConfigModule } from './platform-config/platform-config.module';
import { validateEnvironment } from './common/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),

    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const smtpUser = config.get<string>('SMTP_USER');
        return {
          transport: {
            host: config.get<string>('SMTP_HOST', 'mailpit'),
            port: parseInt(config.get<string>('SMTP_PORT', '1025')),
            secure: false,
            ...(smtpUser
              ? { auth: { user: smtpUser, pass: config.get<string>('SMTP_PASS') } }
              : {}),
          },
          defaults: {
            from: `"${config.get<string>('EMAIL_FROM_NAME', 'BilleTix')}" <${config.get<string>('EMAIL_FROM', 'noreply@billetix.fr')}>`,
            // Encodage explicite (pas de détection automatique de nodemailer) pour des accents toujours bien rendus.
            textEncoding: 'base64',
          },
          template: {
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: { strict: true },
          },
        };
      },
    }),

    PlatformConfigModule,
    NotificationModule,
    HealthModule,
  ],
})
export class AppModule {}
