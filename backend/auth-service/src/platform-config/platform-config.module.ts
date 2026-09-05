import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PlatformConfigCache } from './platform-config.cache';

const AdminServiceClient = ClientsModule.registerAsync([
  {
    name: 'ADMIN_SERVICE',
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
      transport: Transport.TCP,
      options: {
        host: config.get('ADMIN_SERVICE_HOST', 'admin-service'),
        port: parseInt(config.get('ADMIN_SERVICE_PORT', '3009')),
      },
    }),
  },
]);

@Global()
@Module({
  imports: [AdminServiceClient],
  providers: [PlatformConfigCache],
  // Bug corrigé : ClientsModule doit être ré-exporté explicitement pour que
  // le token ADMIN_SERVICE soit injectable ailleurs (AuthService,
  // TwoFactorService) — @Global() ne rend global que les providers listés
  // dans exports, pas les modules importés en interne.
  exports: [PlatformConfigCache, AdminServiceClient],
})
export class PlatformConfigModule {}
