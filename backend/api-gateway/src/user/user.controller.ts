import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
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
import { UpdateIbanDto } from "./dto/update-iban.dto";

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UserController {
  constructor(
    @Inject("USER_SERVICE") private readonly userClient: ClientProxy,
    @Inject("AUTH_SERVICE") private readonly authClient: ClientProxy,
    @Inject("EVENT_SERVICE") private readonly eventClient: ClientProxy,
    @Inject("PAYMENT_SERVICE") private readonly paymentClient: ClientProxy,
    @Inject("ADMIN_SERVICE") private readonly adminClient: ClientProxy,
    private readonly config: ConfigService,
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

    // Bug corrigé : un acheteur ne pouvait devenir organisateur que par
    // intervention d'un admin (auth.change_role) — aucune bascule
    // self-service n'existait. On la déclenche ici, juste après la
    // création réussie du profil, et on renvoie les nouveaux tokens (rôle
    // à jour) pour que le client n'ait pas besoin de se reconnecter.
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
    @Body() dto: CreateOrganizerProfileDto,
  ) {
    return firstValueFrom(
      this.userClient.send("user.update_organizer_profile", {
        user_id: user.sub,
        dto,
      }),
    );
  }

  @Patch("organizer/iban")
  @HttpCode(HttpStatus.OK)
  @Roles("ORGANIZER")
  @ApiOperation({
    summary: "Enregistrer ou mettre à jour l'IBAN (chiffré AES-256)",
  })
  updateIban(@CurrentUser() user: JwtPayload, @Body() dto: UpdateIbanDto) {
    return firstValueFrom(
      this.userClient.send("user.update_iban", { user_id: user.sub, dto }),
    );
  }

  @Post("organizer/kyc")
  @HttpCode(HttpStatus.OK)
  @Roles("ORGANIZER")
  @ApiOperation({
    summary:
      "Soumettre le KYC — fournir l'URL du document uploadé via POST /upload/document",
  })
  submitKyc(
    @CurrentUser() user: JwtPayload,
    @Body() body: SubmitKycDto,
  ) {
    return firstValueFrom(
      this.userClient.send("user.update_kyc", {
        user_id: user.sub,
        dto: { kyc_status: "SUBMITTED", kyc_document_url: body.document_url },
      }),
    );
  }

  /**
   * Bug corrigé (CDC §7) : aucun flux ne permettait jamais à un
   * organisateur de connecter un compte Stripe — sans ça,
   * stripe_connect_account_id/onboarded restaient éternellement vides et
   * aucun reversement automatique n'était jamais possible pour personne.
   * Réutilisable pour reprendre un onboarding interrompu (Stripe expire
   * les liens après quelques minutes) : ne recrée jamais le compte Connect
   * si un existe déjà, génère juste un nouveau lien.
   */
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
        refresh_url: `${frontendUrl}/organizer/stripe-connect/refresh`,
        return_url: `${frontendUrl}/organizer/stripe-connect/return`,
      }),
    );
    return result;
  }

  @Get("organizer/stripe-connect/status")
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Statut de l'onboarding Stripe Connect" })
  async getStripeConnectStatus(@CurrentUser() user: JwtPayload) {
    const profile = (await firstValueFrom(
      this.userClient.send("user.get_organizer_profile", { user_id: user.sub }),
    )) as { stripe_connect_account_id: string | null; stripe_connect_onboarded: boolean };
    return {
      connected: !!profile.stripe_connect_account_id,
      onboarded: profile.stripe_connect_onboarded,
    };
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
    @Body() dto: { password?: string },
  ) {
    // Un organisateur avec des obligations en cours ne peut pas supprimer son
    // compte tant qu'elles ne sont pas résolues (événements à venir déjà
    // publiés, ou reversement en attente de versement).
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
