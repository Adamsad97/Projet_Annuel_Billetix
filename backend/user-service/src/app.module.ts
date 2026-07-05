import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BuyerProfile } from './buyer/buyer-profile.entity';
import { BuyerModule } from './buyer/buyer.module';
import { OrganizerProfile } from './organizer/organizer-profile.entity';
import { OrganizerModule } from './organizer/organizer.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        schema: 'users',
        entities: [BuyerProfile, OrganizerProfile],
        synchronize: config.get('NODE_ENV') !== 'production',
        migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
        migrationsRun: config.get('NODE_ENV') === 'production',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),

    BuyerModule,
    OrganizerModule,
    HealthModule,
  ],
})
export class AppModule {}
