import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Profile, Strategy } from "passport-facebook";

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, "facebook") {
  constructor(config: ConfigService) {
    super({
      // Valeur de repli pour démarrer même si Facebook OAuth n'est pas configuré.
      clientID: config.get<string>("FACEBOOK_APP_ID", "") || "not_configured",
      clientSecret:
        config.get<string>("FACEBOOK_APP_SECRET", "") || "not_configured",
      callbackURL: config.get<string>(
        "FACEBOOK_CALLBACK_URL",
        "http://localhost:3000/api/v1/auth/facebook/callback",
      ),
      // API Graph v25.0 : la v3.2 par défaut provoque « Invalid Scopes: email ».
      graphAPIVersion: "v21.0",
      profileFields: ["id", "emails", "name"],
      scope: ["public_profile", "email"],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): {
    provider: "FACEBOOK";
    oauth_id: string;
    email: string;
    first_name: string;
    last_name: string;
  } {
    return {
      provider: "FACEBOOK",
      oauth_id: profile.id,
      email: profile.emails?.[0]?.value ?? "",
      first_name: profile.name?.givenName ?? "",
      last_name: profile.name?.familyName ?? "",
    };
  }
}
