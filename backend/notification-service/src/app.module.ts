import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { NotificationModule } from './notification/notification.module';
import { HealthModule } from './health/health.module';
import { PlatformConfigModule } from './platform-config/platform-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

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
            from: `"${config.get<string>('EMAIL_FROM_NAME', 'BilletiX')}" <${config.get<string>('EMAIL_FROM', 'noreply@billetix.fr')}>`,
            // Encodage explicite plutôt que la détection automatique de
            // nodemailer (quoted-printable par défaut) — élimine tout risque
            // d'accents mal rendus selon le contenu, indépendamment de la
            // façon dont il a été saisi.
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
