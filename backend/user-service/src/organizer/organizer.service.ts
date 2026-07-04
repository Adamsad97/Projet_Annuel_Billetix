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

  async listKycPending(): Promise<OrganizerProfile[]> {
    return this.repo.find({
      where: { kyc_status: KycStatus.SUBMITTED },
      order: { kyc_submitted_at: 'ASC' },
    });
  }

  async updateKyc(userId: string, dto: UpdateKycDto): Promise<OrganizerProfile> {
    const profile = await this.getByUserId(userId);
    profile.kyc_status = dto.kyc_status;

    if (dto.kyc_status === KycStatus.SUBMITTED) {
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
