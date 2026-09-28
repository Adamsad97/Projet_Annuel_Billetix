import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { AuthService } from "./auth.service";
import { TwoFactorService } from "./two-factor.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResendVerificationDto } from "./dto/resend-verification.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { AdminActionOnUserPayload, ChangePasswordPayload, ChangeRolePayload, CodePayload, DeleteAccountPayload, EmailPayload, IdPayload, IdsPayload, ListUsersPayload, OAuthBirthDatePayload, OAuthExchangePayload, OAuthLoginPayload, OAuthTwoFactorPayload, ResetTwoFactorByAdminPayload, SuspendUserPayload, TokenPayload, TwoFactorCodePayload, UserIdPayload } from '../common/payloads';

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

  @MessagePattern("auth.session_policy")
  getSessionPolicy() {
    return this.authService.getSessionPolicy();
  }

  @MessagePattern("auth.registration_policy")
  getRegistrationPolicy() {
    return this.authService.getRegistrationPolicy();
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
  validateToken(@Payload() data: TokenPayload) {
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

  @MessagePattern("auth.change_password")
  changePassword(@Payload() data: ChangePasswordPayload) {
    return this.authService.changePassword(data.user_id, data.dto);
  }

  @MessagePattern("auth.verify_email")
  verifyEmail(@Payload() data: TokenPayload) {
    return this.authService.verifyEmail(data.token);
  }

  @MessagePattern("auth.resend_verification_email")
  resendVerificationEmail(@Payload() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto);
  }

  @MessagePattern("auth.oauth_login")
  oauthLogin(
    @Payload()
    data: OAuthLoginPayload,
  ) {
    return this.authService.oauthLogin(data);
  }

  @MessagePattern("auth.create_oauth_exchange_code")
  createOAuthExchangeCode(
    @Payload() data: OAuthExchangePayload,
  ) {
    // La classe décrit les trois formes possibles avec des champs facultatifs ;
    // le service attend l'union exacte (session, 2FA ou date de naissance).
    return this.authService.createOAuthExchangeCode(data as Parameters<AuthService["createOAuthExchangeCode"]>[0]);
  }

  @MessagePattern("auth.exchange_oauth_code")
  exchangeOAuthCode(@Payload() data: CodePayload) {
    return this.authService.exchangeOAuthCode(data.code);
  }

  @MessagePattern("auth.oauth_complete_birth_date")
  completeOAuthBirthDate(@Payload() data: OAuthBirthDatePayload) {
    return this.authService.completeOAuthBirthDate(data.pending_token, data.birth_date);
  }

  @MessagePattern("auth.oauth_verify_2fa")
  verifyOauth2fa(@Payload() data: OAuthTwoFactorPayload) {
    return this.authService.verifyOauth2fa(data.pending_token, data.code);
  }

  // ──────────────── 2FA TOTP ────────────────

  @MessagePattern("auth.2fa.setup")
  setup2fa(@Payload() data: UserIdPayload) {
    return this.twoFactorService.setupTotp(data.user_id);
  }

  @MessagePattern("auth.2fa.confirm")
  confirm2fa(@Payload() data: TwoFactorCodePayload) {
    return this.twoFactorService.confirmTotp(data.user_id, data.code);
  }

  @MessagePattern("auth.2fa.verify")
  verify2fa(@Payload() data: TwoFactorCodePayload) {
    return this.twoFactorService.verify(data.user_id, data.code);
  }

  @MessagePattern("auth.2fa.disable")
  disable2fa(@Payload() data: TwoFactorCodePayload) {
    return this.twoFactorService.disable(data.user_id, data.code);
  }

  @MessagePattern("auth.2fa.status")
  get2faStatus(@Payload() data: UserIdPayload) {
    return this.twoFactorService.isTwoFactorRequired(data.user_id);
  }

  // Bug corrigé : la route gateway POST /admin/users/:id/reset-2fa appelait
  // déjà ce pattern, mais aucun handler n'existait ici — timeout RPC garanti.
  @MessagePattern("auth.2fa.reset_by_admin")
  reset2faByAdmin(
    @Payload() data: ResetTwoFactorByAdminPayload,
  ) {
    return this.twoFactorService.resetByAdmin(
      data.user_id,
      data.admin_id,
      data.actor_role,
    );
  }

  @MessagePattern("auth.get_user")
  getUser(@Payload() data: IdPayload) {
    return this.authService.getUserById(data.id);
  }

  @MessagePattern("auth.find_by_email")
  findByEmail(@Payload() data: EmailPayload) {
    return this.authService.findByEmail(data.email);
  }

  @MessagePattern("auth.get_users_by_ids")
  getUsersByIds(@Payload() data: IdsPayload) {
    return this.authService.getUsersByIds(data.ids);
  }

  @MessagePattern("auth.get_user_stats")
  getUserStats() {
    return this.authService.getUserStats();
  }

  // ──────────────── Administration des comptes ────────────────

  @MessagePattern("auth.suspend_user")
  suspendUser(
    @Payload()
    data: SuspendUserPayload,
  ) {
    return this.authService.suspendUser(
      data.id,
      data.admin_id,
      data.reason,
      data.actor_role,
    );
  }

  @MessagePattern("auth.unsuspend_user")
  unsuspendUser(
    @Payload() data: AdminActionOnUserPayload,
  ) {
    return this.authService.unsuspendUser(data.id, data.admin_id, data.actor_role);
  }

  // Bug corrigé : les routes gateway correspondantes appelaient déjà ces
  // patterns, mais aucun handler n'existait ici — timeout RPC garanti.
  @MessagePattern("auth.unlock_account")
  unlockAccount(
    @Payload() data: AdminActionOnUserPayload,
  ) {
    return this.authService.unlockAccount(data.id, data.admin_id, data.actor_role);
  }

  @MessagePattern("auth.activate_account")
  activateAccount(
    @Payload() data: AdminActionOnUserPayload,
  ) {
    return this.authService.activateAccount(data.id, data.admin_id, data.actor_role);
  }

  @MessagePattern("auth.change_role")
  changeRole(
    @Payload()
    data: ChangeRolePayload,
  ) {
    return this.authService.changeRole(
      data.id,
      data.role,
      data.admin_id,
      data.actor_role,
    );
  }

  @MessagePattern("auth.self_upgrade_to_organizer")
  selfUpgradeToOrganizer(@Payload() data: UserIdPayload) {
    return this.authService.selfUpgradeToOrganizer(data.user_id);
  }

  @MessagePattern("auth.list_users")
  listUsers(
    @Payload()
    data: ListUsersPayload,
  ) {
    return this.authService.listUsers(data);
  }

  @MessagePattern("auth.delete_account")
  deleteAccount(@Payload() data: DeleteAccountPayload) {
    return this.authService.deleteAccount(data.id, data.password);
  }
}
