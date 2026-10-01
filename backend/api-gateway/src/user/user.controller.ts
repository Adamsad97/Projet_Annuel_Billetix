import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { assertOwnDocumentUrl } from "../upload/document-url";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { firstValueFrom } from "rxjs";
import {
  CurrentUser,
  JwtPayload,
} from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { CreateOrganizerProfileDto } from "./dto/create-organizer-profile.dto";
import { SubmitKycDto } from "./dto/submit-kyc.dto";
import { UpdateBuyerProfileDto } from "./dto/update-buyer-profile.dto";
import { UpdateNotificationPrefsDto } from "./dto/update-notification-prefs.dto";
import { UpdateOrganizerProfileDto } from "./dto/update-organizer-profile.dto";
import { DeleteAccountDto } from "./dto/delete-account.dto";
import { AdminRecipients } from "../admin-alerts/admin-recipients.service";

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    @Inject("USER_SERVICE") private readonly userClient: ClientProxy,
    @Inject("AUTH_SERVICE") private readonly authClient: ClientProxy,
    @Inject("EVENT_SERVICE") private readonly eventClient: ClientProxy,
    @Inject("PAYMENT_SERVICE") private readonly paymentClient: ClientProxy,
    @Inject("ADMIN_SERVICE") private readonly adminClient: ClientProxy,
    private readonly config: ConfigService,
    private readonly adminRecipients: AdminRecipients,
  ) {}

  // --- Profil acheteur ---

  @Get("buyer/profile")
  @ApiOperation({ summary: "Récupérer son profil acheteur" })
  getBuyerProfile(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(
      this.userClient.send("user.get_buyer_profile", { user_id: user.sub }),
    );
  }

  @Patch("buyer/profile")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Mettre à jour son profil acheteur (adresse de facturation)",
  })
  updateBuyerProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateBuyerProfileDto,
  ) {
    return firstValueFrom(
      this.userClient.send("user.update_buyer_profile", {
        user_id: user.sub,
        dto,
      }),
    );
  }

  @Get("buyer/notification-prefs")
  @ApiOperation({ summary: "Récupérer ses préférences de notification" })
  getNotificationPrefs(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(
      this.userClient.send("user.get_notification_prefs", { user_id: user.sub }),
    );
  }

  @Patch("buyer/notification-prefs")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mettre à jour ses préférences de notification" })
  updateNotificationPrefs(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateNotificationPrefsDto,
  ) {
    return firstValueFrom(
      this.userClient.send("user.update_notification_prefs", {
        user_id: user.sub,
        dto,
      }),
    );
  }

  // --- Profil organisateur ---

  @Post("organizer/profile")
  @Roles("BUYER", "ORGANIZER")
  @ApiOperation({
    summary:
      "Créer son profil organisateur — bascule automatiquement un compte Acheteur en Organisateur (self-service)",
  })
  async createOrganizerProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrganizerProfileDto,
  ) {
    const profile = await firstValueFrom(
      this.userClient.send("user.create_organizer_profile", {
        user_id: user.sub,
        dto,
      }),
    );

    // Bascule self-service en organisateur, avec de nouveaux jetons.
    if (user.role === "BUYER") {
      const { access_token, refresh_token, user: updatedUser } =
        await firstValueFrom(
          this.authClient.send("auth.self_upgrade_to_organizer", {
            user_id: user.sub,
          }),
        );
      return { profile, access_token, refresh_token, user: updatedUser };
    }

    return { profile };
  }

  @Get("organizer/profile")
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Récupérer son profil organisateur" })
  getOrganizerProfile(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(
      this.userClient.send("user.get_organizer_profile", { user_id: user.sub }),
    );
  }

  @Patch("organizer/profile")
  @HttpCode(HttpStatus.OK)
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Mettre à jour son profil organisateur" })
  updateOrganizerProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateOrganizerProfileDto,
  ) {
    return firstValueFrom(
      this.userClient.send("user.update_organizer_profile", {
        user_id: user.sub,
        dto,
      }),
    );
  }

  // IBAN et moyen de reversement : PayoutAccountController.

  @Post("organizer/kyc")
  @HttpCode(HttpStatus.OK)
  @Roles("ORGANIZER")
  @ApiOperation({
    summary:
      "Soumettre le KYC — fournir l'URL du document uploadé via POST /upload/document",
  })
  async submitKyc(
    @CurrentUser() user: JwtPayload,
    @Body() body: SubmitKycDto,
  ) {
    assertOwnDocumentUrl(body.document_url, user.sub, this.config.get("MINIO_BUCKET_DOCUMENTS", "documents"));
    const profile = await firstValueFrom(
      this.userClient.send<{ display_name: string }>("user.update_kyc", {
        user_id: user.sub,
        dto: { kyc_status: "SUBMITTED", kyc_document_url: body.document_url },
      }),
    );
    // Les admins sont prévenus : les reversements de l'organisateur
    // attendent cette vérification.
    this.authClient
      .send<{ first_name: string; last_name: string; email: string } | null>("auth.get_user", { id: user.sub })
      .subscribe({
        next: (account) =>
          this.adminRecipients.noticeInBackground({
            subject: `Nouvelle vérification d'identité — ${profile.display_name}`,
            headline: "Vérification d'identité à examiner",
            intro:
              "Un organisateur a envoyé sa pièce d'identité. Ses reversements restent bloqués tant qu'elle n'est pas validée.",
            details: [
              `Organisateur : ${profile.display_name}`,
              ...(account ? [`Titulaire du compte : ${account.first_name} ${account.last_name}`, `Email : ${account.email}`] : []),
            ],
            ctaLabel: "Examiner la demande",
            ctaPath: `/admin/utilisateurs/${user.sub}`,
          }),
        error: () => undefined,
      });
    return profile;
  }

  /** CDC §7 : onboarding Stripe Connect, réutilisable pour reprendre un lien expiré. */
  @Post("organizer/stripe-connect/onboard")
  @HttpCode(HttpStatus.OK)
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Démarrer/reprendre l'onboarding Stripe Connect" })
  async onboardStripeConnect(@CurrentUser() user: JwtPayload) {
    const profile = (await firstValueFrom(
      this.userClient.send("user.get_organizer_profile", { user_id: user.sub }),
    )) as { stripe_connect_account_id: string | null };

    const frontendUrl = this.config.get<string>("FRONTEND_URL", "http://localhost:3000");
    const result = await firstValueFrom(
      this.paymentClient.send("payment.create_connect_onboarding_link", {
        organizer_id: user.sub,
        email: user.email,
        existing_account_id: profile.stripe_connect_account_id,
        // Bug corrigé : ces adresses pointaient vers des pages inexistantes
        // (/organizer/stripe-connect/...) — retour sur la page Paiements.
        refresh_url: `${frontendUrl}/dashboard/paiements?stripe=relancer`,
        return_url: `${frontendUrl}/dashboard/paiements?stripe=retour`,
      }),
    );
    return result;
  }

  /** Statut du compte lu chez Stripe ; seuls la banque et les 4 derniers chiffres sont renvoyés. */
  @Get("organizer/stripe-connect/status")
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Statut du compte de reversement (Stripe Connect)" })
  async getStripeConnectStatus(@CurrentUser() user: JwtPayload) {
    const profile = (await firstValueFrom(
      this.userClient.send("user.get_organizer_profile", { user_id: user.sub }),
    )) as { stripe_connect_account_id: string | null; stripe_connect_onboarded: boolean };
    const accountId = profile.stripe_connect_account_id;
    if (!accountId) {
      return { connected: false, onboarded: false, details_submitted: false, payouts_enabled: false, requirements_due: 0, bank: null };
    }

    try {
      const status = (await firstValueFrom(
        this.paymentClient.send("payment.get_connect_status", { account_id: accountId }),
      )) as {
        details_submitted: boolean;
        payouts_enabled: boolean;
        onboarded: boolean;
        requirements_due: number;
        bank: { bank_name: string | null; last4: string } | null;
      };
      if (status.onboarded !== profile.stripe_connect_onboarded) {
        await firstValueFrom(
          this.userClient.send("user.set_stripe_connect_onboarded", { account_id: accountId, onboarded: status.onboarded }),
        );
      }
      return { connected: true, ...status };
    } catch (err) {
      // Stripe injoignable : dernier état connu, sans détail.
      this.logger.warn(`Statut Stripe Connect indisponible (${accountId}) : ${(err as Error)?.message}`);
      return {
        connected: true,
        onboarded: profile.stripe_connect_onboarded,
        details_submitted: profile.stripe_connect_onboarded,
        payouts_enabled: profile.stripe_connect_onboarded,
        requirements_due: 0,
        bank: null,
      };
    }
  }

  /** Espace Stripe de l'organisateur (compte bancaire, virements reçus). */
  @Post("organizer/stripe-connect/dashboard")
  @HttpCode(HttpStatus.OK)
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Lien vers l'espace Stripe de l'organisateur" })
  async stripeConnectDashboard(@CurrentUser() user: JwtPayload) {
    const profile = (await firstValueFrom(
      this.userClient.send("user.get_organizer_profile", { user_id: user.sub }),
    )) as { stripe_connect_account_id: string | null };
    if (!profile.stripe_connect_account_id) {
      throw new BadRequestException("Aucun compte de reversement connecté.");
    }
    return firstValueFrom(
      this.paymentClient.send("payment.create_connect_login_link", { account_id: profile.stripe_connect_account_id }),
    );
  }

  @Get("organizer/kyc")
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Consulter son statut KYC" })
  getKycStatus(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(
      this.userClient.send("user.get_organizer_profile", { user_id: user.sub }),
    ).then(
      (organizerProfile: {
        kyc_status: string;
        kyc_submitted_at: Date | null;
        kyc_verified_at: Date | null;
        kyc_rejected_reason: string | null;
      }) => ({
        kyc_status: organizerProfile.kyc_status,
        kyc_submitted_at: organizerProfile.kyc_submitted_at,
        kyc_verified_at: organizerProfile.kyc_verified_at,
        kyc_rejected_reason: organizerProfile.kyc_rejected_reason,
      }),
    );
  }

  // --- Droit à l'effacement (RGPD) ---

  @Delete("me")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Supprimer définitivement son compte (droit à l'effacement RGPD)",
  })
  async deleteMyAccount(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Body() dto: DeleteAccountDto,
  ) {
    // Suppression du compte impossible tant qu'il reste des obligations en cours.
    if (user.role === "ORGANIZER") {
      const events = (await firstValueFrom(
        this.eventClient.send("event.list_by_organizer", {
          organizer_id: user.sub,
        }),
      )) as Array<{ status: string; start_date: string }>;

      const now = new Date();
      const hasUpcomingPublished = events.some(
        (event) =>
          event.status === "PUBLISHED" && new Date(event.start_date) > now,
      );
      if (hasUpcomingPublished) {
        throw new BadRequestException(
          "Impossible de supprimer votre compte : vous avez un événement publié à venir. Annulez-le ou attendez qu'il soit passé.",
        );
      }

      const balance = await firstValueFrom(
        this.paymentClient.send("payment.get_organizer_balance", {
          organizer_id: user.sub,
        }),
      ).catch(() => ({ pending_balance: 0 }));
      if ((balance as { pending_balance: number }).pending_balance > 0) {
        throw new BadRequestException(
          "Impossible de supprimer votre compte : un reversement est en attente. Contactez le support une fois celui-ci versé.",
        );
      }
    }

    await firstValueFrom(
      this.authClient.send("auth.delete_account", {
        id: user.sub,
        password: dto?.password,
      }),
    );

    const anonymizePattern =
      user.role === "ORGANIZER"
        ? "user.anonymize_organizer_profile"
        : "user.anonymize_buyer_profile";
    this.userClient.send(anonymizePattern, { user_id: user.sub }).subscribe();

    this.adminClient
      .send("admin.log_action", {
        action: "USER_DELETED",
        entity_type: "USER",
        entity_id: user.sub,
        performed_by: user.sub,
        performed_by_email: user.email,
        reason: "Suppression de compte à la demande de l'utilisateur (RGPD)",
        metadata: null,
        ip_address:
          (req.headers["x-forwarded-for"] as string)?.split(",")[0] ??
          req.ip ??
          "",
      })
      .subscribe();

    return { success: true };
  }
}
