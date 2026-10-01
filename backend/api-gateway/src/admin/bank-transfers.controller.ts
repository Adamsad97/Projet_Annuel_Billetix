import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { firstValueFrom } from "rxjs";
import { CurrentUser, JwtPayload } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ReasonDto } from "../common/dto/common.dto";
import { UuidPipe } from "../common/pipes/uuid.pipe";
import { ConfirmBankTransfersDto, SepaExportDto } from "./dto/bank-transfer.dto";
import { buildSepaCreditTransfer, sepaId, type SepaCredit } from "./sepa";

interface TransferPayout {
  id: string;
  organizer_id: string;
  event_id: string;
  net_amount: string | number;
  offset_amount: string | number;
  created_at: string;
  updated_at: string;
}

interface PayoutAccount {
  has_iban: boolean;
  iban_masked: string | null;
  bank_owner_name: string | null;
  iban_updated_at: string | null;
}

interface TransferConfig {
  iban_change_payout_hold_hours: number;
  platform_legal_name: string;
  platform_iban: string;
  platform_bic: string;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Virements des reversements : fichier SEPA à importer à la banque, puis confirmation avec référence. */
@ApiTags("admin")
@ApiBearerAuth()
@Roles("ADMIN")
@Controller("admin/bank-transfers")
export class BankTransfersController {
  private readonly logger = new Logger(BankTransfersController.name);

  constructor(
    @Inject("PAYMENT_SERVICE") private readonly paymentClient: ClientProxy,
    @Inject("USER_SERVICE") private readonly userClient: ClientProxy,
    @Inject("AUTH_SERVICE") private readonly authClient: ClientProxy,
    @Inject("EVENT_SERVICE") private readonly eventClient: ClientProxy,
    @Inject("ADMIN_SERVICE") private readonly adminClient: ClientProxy,
    @Inject("NOTIFICATION_SERVICE") private readonly notifClient: ClientProxy,
  ) {}

  private config(): Promise<TransferConfig> {
    return firstValueFrom(this.adminClient.send<TransferConfig>("admin.get_platform_config", {}));
  }

  private toTransfer(ids?: string[]): Promise<TransferPayout[]> {
    return firstValueFrom(this.paymentClient.send<TransferPayout[]>("payment.get_payouts_to_transfer", { ids }));
  }

  /** IBAN modifié récemment : aucun virement avant la fin de la suspension. */
  private heldUntil(account: PayoutAccount | undefined, holdHours: number): string | null {
    if (!account?.iban_updated_at) return null;
    const until = new Date(account.iban_updated_at).getTime() + holdHours * 3_600_000;
    return until > Date.now() ? new Date(until).toISOString() : null;
  }

  private async context(payouts: TransferPayout[]) {
    const organizerIds = [...new Set(payouts.map((payout) => payout.organizer_id))];
    const eventIds = [...new Set(payouts.map((payout) => payout.event_id))];
    const [accounts, organizers, events] = await Promise.all([
      Promise.all(
        organizerIds.map((id) =>
          firstValueFrom(this.userClient.send<PayoutAccount>("user.get_payout_account", { user_id: id }))
            .then((account) => [id, account] as const)
            .catch(() => [id, undefined] as const),
        ),
      ),
      organizerIds.length
        ? firstValueFrom(
            this.authClient.send<Array<{ id: string; first_name: string; last_name: string; email: string }>>(
              "auth.get_users_by_ids",
              { ids: organizerIds },
            ),
          ).catch(() => [])
        : Promise.resolve([]),
      eventIds.length
        ? firstValueFrom(this.eventClient.send<Array<{ id: string; title: string }>>("event.get_by_ids", { ids: eventIds })).catch(
            () => [],
          )
        : Promise.resolve([]),
    ]);
    return {
      accounts: new Map(accounts),
      organizers: new Map(organizers.map((organizer) => [organizer.id, organizer])),
      events: new Map(events.map((event) => [event.id, event])),
    };
  }

  private audit(user: JwtPayload, req: Request, action: string, entityId: string | null, reason?: string, metadata?: object) {
    this.adminClient
      .send("admin.log_action", {
        action,
        entity_type: "PAYOUT",
        entity_id: entityId,
        performed_by: user.sub,
        performed_by_email: user.email,
        reason: reason ?? null,
        metadata: metadata ?? null,
        ip_address: ((req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.ip ?? "").trim(),
      })
      .subscribe({ error: () => undefined });
  }

  @Get()
  @ApiOperation({ summary: "Reversements à virer, avec le compte bancaire de l'organisateur (IBAN masqué)" })
  async list() {
    const [payouts, config] = await Promise.all([this.toTransfer(), this.config()]);
    const { accounts, organizers, events } = await this.context(payouts);
    const data = payouts.map((payout) => {
      const account = accounts.get(payout.organizer_id);
      const organizer = organizers.get(payout.organizer_id);
      return {
        id: payout.id,
        organizer_id: payout.organizer_id,
        organizer_name: organizer ? `${organizer.first_name} ${organizer.last_name}` : "Organisateur introuvable",
        organizer_email: organizer?.email ?? null,
        event_id: payout.event_id,
        event_name: events.get(payout.event_id)?.title ?? "Événement introuvable",
        net_amount: Number(payout.net_amount),
        offset_amount: Number(payout.offset_amount),
        amount: round2(Number(payout.net_amount) - Number(payout.offset_amount)),
        bank_owner_name: account?.bank_owner_name ?? null,
        iban_masked: account?.iban_masked ?? null,
        iban_held_until: this.heldUntil(account, config.iban_change_payout_hold_hours),
        prepared_at: payout.updated_at,
      };
    });
    return {
      data,
      total: round2(data.reduce((sum, row) => sum + row.amount, 0)),
      platform_account_ready: Boolean(config.platform_iban),
    };
  }

  @Post("sepa")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Fichier de virements SEPA (pain.001) des reversements à virer" })
  async exportSepa(@CurrentUser() user: JwtPayload, @Req() req: Request, @Body() dto: SepaExportDto) {
    const config = await this.config();
    if (!config.platform_iban) {
      throw new BadRequestException(
        "Renseignez d'abord l'IBAN de la plateforme dans les paramètres (section Informations légales).",
      );
    }
    const payouts = await this.toTransfer(dto.ids);
    const { accounts, events } = await this.context(payouts);

    const credits: SepaCredit[] = [];
    const included: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];
    const ibans = new Map<string, { iban: string; bank_owner_name: string } | null>();
    for (const payout of payouts) {
      const account = accounts.get(payout.organizer_id);
      if (this.heldUntil(account, config.iban_change_payout_hold_hours)) {
        skipped.push({ id: payout.id, reason: "IBAN modifié récemment" });
        continue;
      }
      if (!ibans.has(payout.organizer_id)) {
        ibans.set(
          payout.organizer_id,
          await firstValueFrom(
            this.userClient.send<{ iban: string; bank_owner_name: string }>("user.get_iban", { user_id: payout.organizer_id }),
          ).catch(() => null),
        );
      }
      const bank = ibans.get(payout.organizer_id);
      if (!bank) {
        skipped.push({ id: payout.id, reason: "Aucun IBAN enregistré" });
        continue;
      }
      const amount = round2(Number(payout.net_amount) - Number(payout.offset_amount));
      credits.push({
        endToEndId: sepaId("BTX", payout.id),
        amount,
        creditorName: bank.bank_owner_name,
        creditorIban: bank.iban,
        remittance: `BilleTix reversement ${events.get(payout.event_id)?.title ?? ""}`,
      });
      included.push(payout.id);
    }
    if (!credits.length) {
      throw new BadRequestException("Aucun reversement ne peut être viré pour le moment.");
    }

    const now = new Date();
    const stamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const messageId = `BTX-${stamp}`;
    const xml = buildSepaCreditTransfer({
      messageId,
      createdAt: now,
      executionDate: now.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }),
      debtor: { name: config.platform_legal_name, iban: config.platform_iban, bic: config.platform_bic },
      credits,
    });
    const total = round2(credits.reduce((sum, credit) => sum + credit.amount, 0));
    this.audit(user, req, "PAYOUTS_SEPA_EXPORTED", null, undefined, { message_id: messageId, payout_ids: included, total });
    return { filename: `virements-${stamp}.xml`, message_id: messageId, xml, count: credits.length, total, included, skipped };
  }

  @Post("confirm")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirmer des virements émis (référence de la banque)" })
  async confirm(@CurrentUser() user: JwtPayload, @Req() req: Request, @Body() dto: ConfirmBankTransfersDto) {
    const confirmed: TransferPayout[] = [];
    const failed: Array<{ id: string; message: string }> = [];
    for (const id of [...new Set(dto.ids)]) {
      try {
        const payout = await firstValueFrom(
          this.paymentClient.send<TransferPayout>("payment.confirm_bank_transfer", {
            id,
            admin_id: user.sub,
            reference: dto.reference,
          }),
        );
        confirmed.push(payout);
        this.audit(user, req, "PAYOUT_TRANSFER_CONFIRMED", id, dto.reference);
      } catch (error) {
        failed.push({ id, message: (error as { message?: string })?.message ?? "Confirmation impossible" });
      }
    }
    if (confirmed.length) this.notifyPaid(confirmed, dto.reference.trim());
    return { confirmed: confirmed.map((payout) => payout.id), failed };
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Annuler un virement (rejeté par la banque) : reversement de nouveau en attente" })
  async cancel(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id", UuidPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    const result = await firstValueFrom(this.paymentClient.send("payment.release_bank_transfer", { id }));
    this.audit(user, req, "PAYOUT_TRANSFER_CANCELLED", id, dto.reason);
    return result;
  }

  /** Email « Reversement effectué » à chaque organisateur, avec la référence du virement. */
  private notifyPaid(payouts: TransferPayout[], reference: string): void {
    this.context(payouts)
      .then(({ organizers, events }) => {
        const payoutDate = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
        for (const payout of payouts) {
          const organizer = organizers.get(payout.organizer_id);
          if (!organizer?.email) continue;
          this.notifClient.emit("notification.payout_completed", {
            email: organizer.email,
            firstName: organizer.first_name,
            eventName: events.get(payout.event_id)?.title ?? "votre événement",
            amount: round2(Number(payout.net_amount) - Number(payout.offset_amount)).toFixed(2),
            payoutDate,
            reference,
          });
        }
      })
      .catch((error) => this.logger.error(`Emails de reversement non envoyés : ${error?.message}`));
  }
}
