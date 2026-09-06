import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { CryptoService } from '../crypto/crypto.service';
import { CreateOrganizerProfileDto } from './dto/create-organizer-profile.dto';
import { UpdateIbanDto } from './dto/update-iban.dto';
import { UpdateKycDto } from './dto/update-kyc.dto';
import { UpdateOrganizerProfileDto } from './dto/update-organizer-profile.dto';
import { KycStatus, OrganizerProfile } from './organizer-profile.entity';

@Injectable()
export class OrganizerService {
  constructor(
    @InjectRepository(OrganizerProfile)
    private readonly repo: Repository<OrganizerProfile>,
    private readonly crypto: CryptoService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  async create(userId: string, dto: CreateOrganizerProfileDto): Promise<OrganizerProfile> {
    const existing = await this.repo.findOne({ where: { user_id: userId } });
    if (existing) {
      throw new RpcException({ statusCode: 409, message: 'Profil organisateur déjà existant' });
    }
    const profile = this.repo.create({ user_id: userId, ...dto });
    return this.repo.save(profile);
  }

  async getByUserId(userId: string): Promise<OrganizerProfile> {
    const profile = await this.repo.findOne({ where: { user_id: userId } });
    if (!profile) {
      throw new RpcException({ statusCode: 404, message: 'Profil organisateur introuvable' });
    }
    return profile;
  }

  async update(userId: string, dto: UpdateOrganizerProfileDto): Promise<OrganizerProfile> {
    const profile = await this.getByUserId(userId);
    Object.assign(profile, dto);
    return this.repo.save(profile);
  }

  async updateIban(userId: string, dto: UpdateIbanDto): Promise<{ success: boolean }> {
    const user = await firstValueFrom(
      this.authClient.send<{ two_factor_enabled: boolean }>('auth.get_user', { id: userId }),
    );
    if (!user?.two_factor_enabled) {
      throw new RpcException({
        statusCode: 403,
        message: 'La double authentification (2FA) doit être activée avant d\'enregistrer un IBAN',
      });
    }

    const profile = await this.getByUserId(userId);
    const { encrypted, iv, tag } = this.crypto.encrypt(dto.iban);
    profile.iban_encrypted = encrypted;
    profile.iban_iv = iv;
    profile.iban_tag = tag;
    profile.bank_owner_name = dto.bank_owner_name;
    await this.repo.save(profile);
    return { success: true };
  }

  async getDecryptedIban(userId: string): Promise<{ iban: string; bank_owner_name: string }> {
    const profile = await this.repo
      .createQueryBuilder('p')
      .addSelect(['p.iban_encrypted', 'p.iban_iv', 'p.iban_tag'])
      .where('p.user_id = :userId', { userId })
      .getOne();

    if (!profile) {
      throw new RpcException({ statusCode: 404, message: 'Profil organisateur introuvable' });
    }
    if (!profile.iban_encrypted) {
      throw new RpcException({ statusCode: 404, message: 'Aucun IBAN enregistré' });
    }

    const iban = this.crypto.decrypt(profile.iban_encrypted, profile.iban_iv!, profile.iban_tag!);
    return { iban, bank_owner_name: profile.bank_owner_name! };
  }

  /** Droit à l'effacement RGPD — efface IBAN, KYC, contact et réseaux sociaux. */
  async anonymize(userId: string): Promise<{ success: boolean }> {
    const profile = await this.repo.findOne({ where: { user_id: userId } });
    if (!profile) return { success: true };

    profile.display_name = 'Organisateur supprimé';
    profile.description = null;
    profile.logo_url = null;
    profile.website_url = null;
    profile.social_instagram = null;
    profile.social_facebook = null;
    profile.social_twitter = null;
    profile.social_youtube = null;
    profile.iban_encrypted = null;
    profile.iban_iv = null;
    profile.iban_tag = null;
    profile.bank_owner_name = null;
    profile.stripe_connect_account_id = null;
    profile.kyc_document_url = null;
    await this.repo.save(profile);
    return { success: true };
  }

  /**
   * Bug corrigé (CDC §7) : rien ne renseignait jamais ces deux champs —
   * appelé par payment-service à la création du compte Stripe Connect
   * (une seule fois par organisateur, jamais recréé).
   */
  async setStripeConnectAccount(userId: string, accountId: string): Promise<OrganizerProfile> {
    const profile = await this.getByUserId(userId);
    profile.stripe_connect_account_id = accountId;
    // Nouvelle liaison : l'onboarding Stripe n'est pas encore confirmé, même
    // si un compte existait déjà avant (ne devrait pas arriver en pratique
    // puisque payment-service ne recrée jamais un compte existant).
    profile.stripe_connect_onboarded = false;
    return this.repo.save(profile);
  }

  /**
   * Appelé depuis le webhook Stripe `account.updated` — l'identifiant
   * disponible est celui du compte Connect, pas notre user_id interne.
   * Silencieux si le compte est inconnu (jamais nos organisateurs).
   */
  async setStripeConnectOnboarded(accountId: string, onboarded: boolean): Promise<void> {
    const profile = await this.repo.findOne({ where: { stripe_connect_account_id: accountId } });
    if (!profile) return;
    profile.stripe_connect_onboarded = onboarded;
    await this.repo.save(profile);
  }

  async listKycPending(): Promise<OrganizerProfile[]> {
    return this.repo.find({
      where: { kyc_status: KycStatus.SUBMITTED },
      order: { kyc_submitted_at: 'ASC' },
    });
  }

  /**
   * Bug corrigé (même famille que la faille commission "non lucratif") :
   * l'admin pouvait approuver le KYC d'un organisateur (VERIFIED) sans
   * qu'aucun justificatif n'ait jamais été soumis (kyc_document_url vide),
   * et même transitionner VERIFIED/REJECTED depuis n'importe quel statut
   * (y compris PENDING, jamais soumis) — le workflow "soumission → examen"
   * n'était en réalité jamais imposé.
   */
  async updateKyc(userId: string, dto: UpdateKycDto): Promise<OrganizerProfile> {
    const profile = await this.getByUserId(userId);

    if (dto.kyc_status === KycStatus.VERIFIED || dto.kyc_status === KycStatus.REJECTED) {
      if (profile.kyc_status !== KycStatus.SUBMITTED) {
        throw new RpcException({
          statusCode: 400,
          message: 'Aucun justificatif KYC en attente d\'examen pour cet organisateur',
        });
      }
      if (dto.kyc_status === KycStatus.VERIFIED && !profile.kyc_document_url) {
        throw new RpcException({
          statusCode: 400,
          message: 'Impossible de valider le KYC : aucun justificatif fourni par l\'organisateur',
        });
      }
    }

    profile.kyc_status = dto.kyc_status;

    if (dto.kyc_status === KycStatus.SUBMITTED) {
      if (!dto.kyc_document_url) {
        throw new RpcException({
          statusCode: 400,
          message: 'Un justificatif est requis pour soumettre le KYC',
        });
      }
      profile.kyc_submitted_at = new Date();
    }
    if (dto.kyc_status === KycStatus.VERIFIED) {
      profile.kyc_verified_at = new Date();
      profile.kyc_rejected_reason = null;
    }
    if (dto.kyc_status === KycStatus.REJECTED) {
      profile.kyc_rejected_reason = dto.kyc_rejected_reason ?? null;
    }
    if (dto.kyc_document_url) {
      profile.kyc_document_url = dto.kyc_document_url;
    }

    return this.repo.save(profile);
  }
}
