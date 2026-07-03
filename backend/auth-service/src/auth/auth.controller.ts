import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OAuthProvider } from '../user/user.entity';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @MessagePattern('auth.register')
  register(@Payload() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @MessagePattern('auth.login')
  login(@Payload() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @MessagePattern('auth.refresh')
  refresh(@Payload() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @MessagePattern('auth.logout')
  logout(@Payload() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  @MessagePattern('auth.validate_token')
  validateToken(@Payload() data: { token: string }) {
    return this.authService.validateToken(data.token);
  }

  @MessagePattern('auth.forgot_password')
  forgotPassword(@Payload() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @MessagePattern('auth.reset_password')
  resetPassword(@Payload() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @MessagePattern('auth.verify_email')
  verifyEmail(@Payload() data: { token: string }) {
    return this.authService.verifyEmail(data.token);
  }

  @MessagePattern('auth.oauth_login')
  oauthLogin(@Payload() data: {
    provider: OAuthProvider;
    oauth_id: string;
    email: string;
    first_name: string;
    last_name: string;
  }) {
    return this.authService.oauthLogin(data);
  }

  // ──────────────── 2FA TOTP ────────────────

  @MessagePattern('auth.2fa.setup')
  setup2fa(@Payload() data: { user_id: string }) {
    return this.twoFactorService.setupTotp(data.user_id);
  }

  @MessagePattern('auth.2fa.confirm')
  confirm2fa(@Payload() data: { user_id: string; code: string }) {
    return this.twoFactorService.confirmTotp(data.user_id, data.code);
  }

  @MessagePattern('auth.2fa.verify')
  verify2fa(@Payload() data: { user_id: string; code: string }) {
    return this.twoFactorService.verifyTotp(data.user_id, data.code);
  }

  @MessagePattern('auth.2fa.disable')
  disable2fa(@Payload() data: { user_id: string; code: string }) {
    return this.twoFactorService.disable(data.user_id, data.code);
  }

  @MessagePattern('auth.2fa.status')
  get2faStatus(@Payload() data: { user_id: string }) {
    return this.twoFactorService.isTwoFactorRequired(data.user_id);
  }
}
