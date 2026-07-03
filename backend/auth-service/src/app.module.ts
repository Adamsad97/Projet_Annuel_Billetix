import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // À venir : TypeOrmModule, AuthModule, JwtModule
  ],
})
export class AppModule {}
