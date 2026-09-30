import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Patch,
} from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { firstValueFrom } from "rxjs";
import { CurrentUser, JwtPayload } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { SetPayoutMethodDto, UpdateIbanDto } from "./dto/update-iban.dto";

interface PayoutAccount {
  payout_method: "BANK_TRANSFER" | "STRIPE";
  has_iban: boolean;
  iban_masked: string | null;
  bank_owner_name: string | null;
  iban_updated_at: string | null;
  stripe_connect_onboarded: boolean;
  kyc_status: string;
}

interface SecurityConfig {
  iban_change_payout_hold_hours: number;
  sensitive_action_reauth_minutes: number;
}

/**
 * Compte de reversement de l'organisateur : IBAN (virement bancaire, par
 * défaut) ou Stripe Connect (facultatif). Un changement d'IBAN exige le mot
 * de passe, prévient l'organisateur par email et suspend ses reversements
 * pendant iban_change_payout_hold_hours.
 */
@ApiTags("users")
@ApiBearerAuth()
@Roles("ORGANIZER")
@Controller("users/organizer")
export class PayoutAccountController {
  private readonly logger = new Logger(PayoutAccountController.name);

  constructor(
    @Inject("USER_SERVICE") private readonly userClient: ClientProxy,
    @Inject("AUTH_SERVICE") private readonly authClient: ClientProxy,
    @Inject("ADMIN_SERVICE") private readonly adminClient: ClientProxy,
    @Inject("NOTIFICATION_SERVICE") private readonly notifClient: ClientProxy,
  ) {}

  private config(): Promise<SecurityConfig> {
    return firstValueFrom(this.adminClient.send<SecurityConfig>("admin.get_platform_config", {}));
  }

  private heldUntil(ibanUpdatedAt: string | Date | null, holdHours: number): string | null {
    if (!ibanUpdatedAt) return null;
    const until = new Date(ibanUpdatedAt).getTime() + holdHours * 3_600_000;
    return until > Date.now() ? new Date(until).toISOString() : null;
  }

  @Get("payout-account")
  @ApiOperation({ summary: "Moyen de reversement (IBAN masqué, Stripe Connect)" })
  async getPayoutAccount(@CurrentUser() user: JwtPayload) {
    const [account, { has_password }, config] = await Promise.all([
      firstValueFrom(this.userClient.send<PayoutAccount>("user.get_payout_account", { user_id: user.sub })),
      firstValueFrom(this.authClient.send<{ has_password: boolean }>("auth.has_password", { user_id: user.sub })),
      this.config(),
    ]);
    return {
      ...account,
      has_password,
      iban_change_payout_hold_hours: config.iban_change_payout_hold_hours,
      payouts_held_until: this.heldUntil(account.iban_updated_at, config.iban_change_payout_hold_hours),
    };
  }

  @Patch("iban")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Enregistrer ou modifier l'IBAN (mot de passe exigé)" })
  async updateIban(@CurrentUser() user: JwtPayload, @Body() dto: UpdateIbanDto) {
    const config = await this.config();
    const { has_password } = await firstValueFrom(
      this.authClient.send<{ has_password: boolean }>("auth.verify_password", {
        user_id: user.sub,
        password: dto.current_password ?? "",
      }),
    );
    // Compte Google/Facebook sans mot de passe : connexion récente exigée.
    if (!has_password) {
      const authTime = user.auth_time ?? user.iat ?? 0;
      if (Date.now() / 1000 - authTime > config.sensitive_action_reauth_minutes * 60) {
        throw new ForbiddenException({
          statusCode: 403,
          code: "REAUTH_REQUIRED",
          message: "Pour modifier votre IBAN, confirmez d'abord votre identité en vous reconnectant.",
        });
      }
    }

    const result = await firstValueFrom(
      this.userClient.send<{ success: boolean; changed: boolean; iban_masked: string }>("user.update_iban", {
        user_id: user.sub,
        dto: { iban: dto.iban, bank_owner_name: dto.bank_owner_name },
      }),
    );
    const payoutsHeldUntil = result.changed
      ? this.heldUntil(new Date(), config.iban_change_payout_hold_hours)
      : null;
    if (result.changed) this.notifyIbanChanged(user.sub, result.iban_masked, config.iban_change_payout_hold_hours);
    return { ...result, payouts_held_until: payoutsHeldUntil };
  }

  @Patch("payout-method")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Choisir le moyen de reversement (virement ou Stripe)" })
  setPayoutMethod(@CurrentUser() user: JwtPayload, @Body() dto: SetPayoutMethodDto) {
    return firstValueFrom(
      this.userClient.send("user.set_payout_method", { user_id: user.sub, payout_method: dto.payout_method }),
    );
  }

  /** Alerte à l'organisateur : si ce n'est pas lui, il réagit avant tout virement. */
  private notifyIbanChanged(userId: string, ibanMasked: string, holdHours: number): void {
    firstValueFrom(this.authClient.send<{ email: string; first_name: string }>("auth.get_user", { id: userId }))
      .then((account) => {
        if (!account?.email) return;
        this.notifClient.emit("notification.iban_changed", {
          email: account.email,
          firstName: account.first_name,
          ibanMasked,
          changedAt: new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" }),
          holdHours,
        });
      })
      .catch((error) => this.logger.error(`Alerte de changement d'IBAN non envoyée (${userId}) : ${error?.message}`));
  }
}
