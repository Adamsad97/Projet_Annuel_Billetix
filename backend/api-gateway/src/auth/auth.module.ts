import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { FacebookStrategy } from "./strategies/facebook.strategy";
import { GoogleStrategy } from "./strategies/google.strategy";

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [GoogleStrategy, FacebookStrategy],
})
export class AuthModule {}
