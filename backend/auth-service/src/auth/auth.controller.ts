import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { OAuthProvider, UserRole } from "../user/user.entity";
import { AuthService } from "./auth.service";
import { TwoFactorService } from "./two-factor.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @MessagePattern("auth.register")
  register(@Payload() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @MessagePattern("auth.login")
  login(@Payload() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @MessagePattern("auth.refresh")
  refresh(@Payload() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @MessagePattern("auth.logout")
  logout(@Payload() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  @MessagePattern("auth.validate_token")
  validateToken(@Payload() data: { token: string }) {
    return this.authService.validateToken(data.token);
  }

  @MessagePattern("auth.forgot_password")
  forgotPassword(@Payload() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @MessagePattern("auth.reset_password")
  resetPassword(@Payload() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @MessagePattern("auth.verify_email")
  verifyEmail(@Payload() data: { token: string }) {
    return this.authService.verifyEmail(data.token);
  }

  @MessagePattern("auth.oauth_login")
  oauthLogin(
    @Payload()
    data: {
      provider: OAuthProvider;
      oauth_id: string;
      email: string;
      first_name: string;
      last_name: string;
    },
  ) {
    return this.authService.oauthLogin(data);
  }

  // ──────────────── 2FA TOTP ────────────────

  @MessagePattern("auth.2fa.setup")
  setup2fa(@Payload() data: { user_id: string }) {
    return this.twoFactorService.setupTotp(data.user_id);
  }

  @MessagePattern("auth.2fa.confirm")
  confirm2fa(@Payload() data: { user_id: string; code: string }) {
    return this.twoFactorService.confirmTotp(data.user_id, data.code);
  }

  @MessagePattern("auth.2fa.verify")
  verify2fa(@Payload() data: { user_id: string; code: string }) {
    return this.twoFactorService.verify(data.user_id, data.code);
  }

  @MessagePattern("auth.2fa.disable")
  disable2fa(@Payload() data: { user_id: string; code: string }) {
    return this.twoFactorService.disable(data.user_id, data.code);
  }

  @MessagePattern("auth.2fa.status")
  get2faStatus(@Payload() data: { user_id: string }) {
    return this.twoFactorService.isTwoFactorRequired(data.user_id);
  }

  // ──────────────── 2FA SMS ────────────────

  @MessagePattern("auth.2fa.sms.setup")
  setupSms2fa(@Payload() data: { user_id: string; phone?: string }) {
    return this.twoFactorService.setupSms(data.user_id, data.phone);
  }

  @MessagePattern("auth.2fa.sms.confirm")
  confirmSms2fa(@Payload() data: { user_id: string; code: string }) {
    return this.twoFactorService.confirmSms(data.user_id, data.code);
  }

  @MessagePattern("auth.2fa.send_code")
  sendCode2fa(@Payload() data: { user_id: string }) {
    return this.twoFactorService.sendVerificationSms(data.user_id);
  }

  @MessagePattern("auth.get_user")
  getUser(@Payload() data: { id: string }) {
    return this.authService.getUserById(data.id);
  }

  @MessagePattern("auth.get_user_stats")
  getUserStats() {
    return this.authService.getUserStats();
  }

  // ──────────────── Administration des comptes ────────────────

  @MessagePattern("auth.suspend_user")
  suspendUser(
    @Payload() data: { id: string; admin_id: string; reason: string },
  ) {
    return this.authService.suspendUser(data.id, data.admin_id, data.reason);
  }

  @MessagePattern("auth.unsuspend_user")
  unsuspendUser(@Payload() data: { id: string; admin_id: string }) {
    return this.authService.unsuspendUser(data.id);
  }

  @MessagePattern("auth.change_role")
  changeRole(
    @Payload() data: { id: string; role: UserRole; admin_id: string },
  ) {
    return this.authService.changeRole(data.id, data.role);
  }

  @MessagePattern("auth.list_users")
  listUsers(
    @Payload()
    data: {
      q?: string;
      role?: UserRole;
      is_suspended?: boolean;
      limit?: number;
      offset?: number;
    },
  ) {
    return this.authService.listUsers(data);
  }

  @MessagePattern("auth.delete_account")
  deleteAccount(@Payload() data: { id: string; password?: string }) {
    return this.authService.deleteAccount(data.id, data.password);
  }
}
