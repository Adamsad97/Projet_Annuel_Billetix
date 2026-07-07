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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { firstValueFrom } from "rxjs";
import {
  CurrentUser,
  JwtPayload,
} from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { CreateOrganizerProfileDto } from "./dto/create-organizer-profile.dto";
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
  @Roles("ORGANIZER")
  @ApiOperation({
    summary: "Créer son profil organisateur (réservé ORGANIZER)",
  })
  createOrganizerProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrganizerProfileDto,
  ) {
    return firstValueFrom(
      this.userClient.send("user.create_organizer_profile", {
        user_id: user.sub,
        dto,
      }),
    );
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
    @Body() body: { document_url: string },
  ) {
    return firstValueFrom(
      this.userClient.send("user.update_kyc", {
        user_id: user.sub,
        dto: { kyc_status: "SUBMITTED", kyc_document_url: body.document_url },
      }),
    );
  }

  @Get("organizer/kyc")
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Consulter son statut KYC" })
  getKycStatus(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(
      this.userClient.send("user.get_organizer_profile", { user_id: user.sub }),
    ).then(
      (p: {
        kyc_status: string;
        kyc_submitted_at: Date | null;
        kyc_verified_at: Date | null;
        kyc_rejected_reason: string | null;
      }) => ({
        kyc_status: p.kyc_status,
        kyc_submitted_at: p.kyc_submitted_at,
        kyc_verified_at: p.kyc_verified_at,
        kyc_rejected_reason: p.kyc_rejected_reason,
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
