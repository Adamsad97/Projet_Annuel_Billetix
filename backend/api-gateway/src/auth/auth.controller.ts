import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ClientProxy } from "@nestjs/microservices";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { firstValueFrom } from "rxjs";
import { ConfigService } from "@nestjs/config";
import {
  CurrentUser,
  JwtPayload,
} from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  private readonly frontendUrl: string;

  constructor(
    @Inject("AUTH_SERVICE") private readonly authClient: ClientProxy,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = this.config.get("FRONTEND_URL", "http://localhost");
  }

  @Public()
  @Post("register")
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: "Inscription (acheteur ou organisateur)" })
  @ApiResponse({ status: 201, description: "Compte créé, tokens retournés" })
  @ApiResponse({ status: 409, description: "Email déjà utilisé" })
  register(@Body() dto: RegisterDto) {
    return firstValueFrom(this.authClient.send("auth.register", dto));
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: "Connexion avec email et mot de passe" })
  @ApiResponse({
    status: 200,
    description: "Connexion réussie, tokens retournés",
  })
  @ApiResponse({ status: 401, description: "Identifiants invalides" })
  login(@Body() dto: LoginDto) {
    return firstValueFrom(this.authClient.send("auth.login", dto));
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Renouveler l'access token via le refresh token" })
  @ApiResponse({
    status: 200,
    description: "Nouvel access token ET nouveau refresh token (rotation — l'ancien est révoqué, à remplacer côté client)",
  })
  refresh(@Body() dto: RefreshTokenDto) {
    return firstValueFrom(this.authClient.send("auth.refresh", dto));
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Déconnexion (révocation du refresh token)" })
  logout(@Body() dto: RefreshTokenDto) {
    return firstValueFrom(this.authClient.send("auth.logout", dto));
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: "Demande de réinitialisation de mot de passe" })
  @ApiResponse({ status: 200, description: "Email envoyé si le compte existe" })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return firstValueFrom(this.authClient.send("auth.forgot_password", dto));
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Réinitialisation du mot de passe via token email" })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return firstValueFrom(this.authClient.send("auth.reset_password", dto));
  }

  @Public()
  @Get("verify-email")
  @ApiOperation({
    summary: "Vérification de l'adresse email via lien reçu par email",
  })
  @ApiQuery({ name: "token", required: true })
  @ApiResponse({ status: 200, description: "Email vérifié avec succès" })
  verifyEmail(@Query("token") token: string) {
    return firstValueFrom(this.authClient.send("auth.verify_email", { token }));
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Récupérer le profil de l'utilisateur connecté" })
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }

  // ──────────────── OAuth Google ────────────────

  @Public()
  @Get("google")
  @UseGuards(AuthGuard("google"))
  @ApiOperation({ summary: "Redirection vers Google pour connexion OAuth" })
  googleAuth() {
    // Passport redirige vers Google — ce handler ne s'exécute pas
  }

  @Public()
  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  @ApiOperation({
    summary: "Callback Google OAuth — retourne les tokens JWT via redirection",
  })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const oauthUser = req.user as {
      provider: "GOOGLE";
      oauth_id: string;
      email: string;
      first_name: string;
      last_name: string;
    };

    const result = await firstValueFrom(
      this.authClient.send("auth.oauth_login", oauthUser),
    );

    // Jamais les tokens en clair dans l'URL (historique, logs, Referer) —
    // un code d'échange opaque, court et à usage unique à la place.
    const code = await firstValueFrom(
      this.authClient.send("auth.create_oauth_exchange_code", {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      }),
    );

    res.redirect(`${this.frontendUrl}/auth/callback?code=${code}`);
  }

  // ──────────────── OAuth Facebook ────────────────

  @Public()
  @Get("facebook")
  @UseGuards(AuthGuard("facebook"))
  @ApiOperation({ summary: "Redirection vers Facebook pour connexion OAuth" })
  facebookAuth() {
    // Passport redirige vers Facebook — ce handler ne s'exécute pas
  }

  @Public()
  @Get("facebook/callback")
  @UseGuards(AuthGuard("facebook"))
  @ApiOperation({
    summary: "Callback Facebook OAuth — retourne les tokens JWT via redirection",
  })
  async facebookCallback(@Req() req: Request, @Res() res: Response) {
    const oauthUser = req.user as {
      provider: "FACEBOOK";
      oauth_id: string;
      email: string;
      first_name: string;
      last_name: string;
    };

    const result = await firstValueFrom(
      this.authClient.send("auth.oauth_login", oauthUser),
    );

    const code = await firstValueFrom(
      this.authClient.send("auth.create_oauth_exchange_code", {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      }),
    );

    res.redirect(`${this.frontendUrl}/auth/callback?code=${code}`);
  }

  @Public()
  @Post("oauth/exchange")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Échanger le code obtenu après callback OAuth contre les tokens (usage unique, ~60s)",
  })
  exchangeOAuthCode(@Body() dto: { code: string }) {
    return firstValueFrom(
      this.authClient.send("auth.exchange_oauth_code", { code: dto.code }),
    );
  }

  // ──────────────── 2FA TOTP ────────────────

  @Post("2fa/setup")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Initialiser la 2FA TOTP — retourne QR code + secret",
  })
  setup2fa(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(
      this.authClient.send("auth.2fa.setup", { user_id: user.sub }),
    );
  }

  @Post("2fa/confirm")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Confirmer la 2FA avec un code TOTP — active la 2FA et retourne les codes de secours",
  })
  confirm2fa(@CurrentUser() user: JwtPayload, @Body() body: { code: string }) {
    return firstValueFrom(
      this.authClient.send("auth.2fa.confirm", {
        user_id: user.sub,
        code: body.code,
      }),
    );
  }

  @Post("2fa/verify")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Vérifier un code 2FA TOTP (lors de la connexion si 2FA activée)",
  })
  verify2fa(@CurrentUser() user: JwtPayload, @Body() body: { code: string }) {
    return firstValueFrom(
      this.authClient.send("auth.2fa.verify", {
        user_id: user.sub,
        code: body.code,
      }),
    );
  }

  @Delete("2fa")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Désactiver la 2FA (code TOTP requis)" })
  disable2fa(@CurrentUser() user: JwtPayload, @Body() body: { code: string }) {
    return firstValueFrom(
      this.authClient.send("auth.2fa.disable", {
        user_id: user.sub,
        code: body.code,
      }),
    );
  }

  @Get("2fa/status")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Vérifier si la 2FA est activée pour l'utilisateur connecté",
  })
  get2faStatus(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(
      this.authClient.send("auth.2fa.status", { user_id: user.sub }),
    );
  }
}
