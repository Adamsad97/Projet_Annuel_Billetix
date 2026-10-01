import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Profile, Strategy } from "passport-google-oauth20";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(config: ConfigService) {
    super({
      // Valeur de repli pour démarrer même si Google OAuth n'est pas configuré.
      clientID: config.get<string>("GOOGLE_CLIENT_ID", "") || "not_configured",
      clientSecret:
        config.get<string>("GOOGLE_CLIENT_SECRET", "") || "not_configured",
      // Callback par défaut sur la gateway (port 4000), seule à exposer /api/v1/auth.
      callbackURL: config.get<string>(
        "GOOGLE_CALLBACK_URL",
        "http://localhost:4000/api/v1/auth/google/callback",
      ),
      scope: ["email", "profile"],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): {
    provider: "GOOGLE";
    oauth_id: string;
    email: string;
    first_name: string;
    last_name: string;
  } {
    return {
      provider: "GOOGLE",
      oauth_id: profile.id,
      email: profile.emails?.[0]?.value ?? "",
      first_name: profile.name?.givenName ?? "",
      last_name: profile.name?.familyName ?? "",
    };
  }
}
