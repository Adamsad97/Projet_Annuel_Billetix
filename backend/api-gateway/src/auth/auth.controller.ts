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
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { firstValueFrom } from 'rxjs';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { OAuthLoginDto } from './dto/oauth-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Inscription (acheteur ou organisateur)' })
  @ApiResponse({ status: 201, description: 'Compte créé, tokens retournés' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  register(@Body() dto: RegisterDto) {
    return firstValueFrom(this.authClient.send('auth.register', dto));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Connexion avec email et mot de passe' })
  @ApiResponse({ status: 200, description: 'Connexion réussie, tokens retournés' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides' })
  login(@Body() dto: LoginDto) {
    return firstValueFrom(this.authClient.send('auth.login', dto));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renouveler l\'access token via le refresh token' })
  @ApiResponse({ status: 200, description: 'Nouvel access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return firstValueFrom(this.authClient.send('auth.refresh', dto));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Déconnexion (révocation du refresh token)' })
  logout(@Body() dto: RefreshTokenDto) {
    return firstValueFrom(this.authClient.send('auth.logout', dto));
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Demande de réinitialisation de mot de passe' })
  @ApiResponse({ status: 200, description: 'Email envoyé si le compte existe' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return firstValueFrom(this.authClient.send('auth.forgot_password', dto));
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Réinitialisation du mot de passe via token email' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return firstValueFrom(this.authClient.send('auth.reset_password', dto));
  }

  @Public()
  @Get('verify-email')
  @ApiOperation({ summary: 'Vérification de l\'adresse email via lien reçu par email' })
  @ApiQuery({ name: 'token', required: true })
  @ApiResponse({ status: 200, description: 'Email vérifié avec succès' })
  verifyEmail(@Query('token') token: string) {
    return firstValueFrom(this.authClient.send('auth.verify_email', { token }));
  }

  @Public()
  @Post('oauth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion / inscription via OAuth (Google, Facebook)' })
  oauthLogin(@Body() dto: OAuthLoginDto) {
    return firstValueFrom(this.authClient.send('auth.oauth_login', dto));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer le profil de l\'utilisateur connecté' })
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }

  // ──────────────── 2FA TOTP ────────────────

  @Post('2fa/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initialiser la 2FA TOTP — retourne QR code + secret' })
  setup2fa(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(this.authClient.send('auth.2fa.setup', { user_id: user.sub }));
  }

  @Post('2fa/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirmer la 2FA avec un code TOTP — active la 2FA et retourne les codes de secours' })
  confirm2fa(@CurrentUser() user: JwtPayload, @Body() body: { code: string }) {
    return firstValueFrom(this.authClient.send('auth.2fa.confirm', { user_id: user.sub, code: body.code }));
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vérifier un code TOTP (lors de la connexion si 2FA activée)' })
  verify2fa(@CurrentUser() user: JwtPayload, @Body() body: { code: string }) {
    return firstValueFrom(this.authClient.send('auth.2fa.verify', { user_id: user.sub, code: body.code }));
  }

  @Delete('2fa')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Désactiver la 2FA (code TOTP requis)' })
  disable2fa(@CurrentUser() user: JwtPayload, @Body() body: { code: string }) {
    return firstValueFrom(this.authClient.send('auth.2fa.disable', { user_id: user.sub, code: body.code }));
  }

  @Get('2fa/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vérifier si la 2FA est activée pour l\'utilisateur connecté' })
  get2faStatus(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(this.authClient.send('auth.2fa.status', { user_id: user.sub }));
  }
}
