import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Profile, Strategy } from "passport-facebook";

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, "facebook") {
  constructor(config: ConfigService) {
    super({
      // OAuth2Strategy (base de passport-facebook) plante au démarrage si vide —
      // valeur de repli non vide pour ne jamais bloquer le boot de la gateway
      // quand Facebook OAuth n'est pas configuré ; l'échec réel se produira
      // seulement si quelqu'un utilise réellement la route /auth/facebook.
      clientID: config.get<string>("FACEBOOK_APP_ID", "") || "not_configured",
      clientSecret:
        config.get<string>("FACEBOOK_APP_SECRET", "") || "not_configured",
      callbackURL: config.get<string>(
        "FACEBOOK_CALLBACK_URL",
        "http://localhost:3000/api/v1/auth/facebook/callback",
      ),
      // passport-facebook pointe par défaut sur l'API Graph v3.2, dépréciée
      // depuis longtemps chez Meta — cause l'erreur "Invalid Scopes: email"
      // au niveau du dialogue OAuth. Version courante en 2026 : v25.0.
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
