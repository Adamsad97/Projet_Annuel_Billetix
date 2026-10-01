import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import { CryptoService } from '../crypto/crypto.service';
import { KycStatus, OrganizerProfile } from './organizer-profile.entity';
import { OrganizerService } from './organizer.service';

describe('OrganizerService', () => {
  let service: OrganizerService;
  let repo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; find: jest.Mock };
  let crypto: { encrypt: jest.Mock; decrypt: jest.Mock };
  let authClient: { send: jest.Mock };

  beforeEach(async () => {
    repo = { findOne: jest.fn(), save: jest.fn().mockImplementation((profile) => Promise.resolve(profile)), create: jest.fn(), find: jest.fn() };
    crypto = { encrypt: jest.fn().mockReturnValue({ encrypted: 'enc', iv: 'iv', tag: 'tag' }), decrypt: jest.fn() };
    authClient = { send: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        OrganizerService,
        { provide: getRepositoryToken(OrganizerProfile), useValue: repo },
        { provide: CryptoService, useValue: crypto },
        { provide: 'AUTH_SERVICE', useValue: authClient },
      ],
    }).compile();

    service = module.get(OrganizerService);
  });

  describe('updateIban', () => {
    const IBAN = 'FR76 3000 6000 0112 3456 7890 189';
    let qb: { addSelect: jest.Mock; where: jest.Mock; getOne: jest.Mock };

    beforeEach(() => {
      qb = { addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn() };
      (repo as unknown as { createQueryBuilder: jest.Mock }).createQueryBuilder = jest.fn().mockReturnValue(qb);
    });

    it('enregistre un IBAN valide, chiffré, sans exiger la 2FA ; le changement est daté', async () => {
      qb.getOne.mockResolvedValue({ user_id: 'user-1', iban_encrypted: null });
      const result = await service.updateIban('user-1', { iban: IBAN, bank_owner_name: ' Jean Dupont ' });
      expect(result).toEqual({ success: true, changed: true, iban_masked: 'FR76 •••• •••• 0189' });
      expect(crypto.encrypt).toHaveBeenCalledWith('FR7630006000011234567890189');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ iban_encrypted: 'enc', bank_owner_name: 'Jean Dupont', iban_updated_at: expect.any(Date) }),
      );
      expect(authClient.send).not.toHaveBeenCalled();
    });

    it('refuse un IBAN dont la clé de contrôle est fausse', async () => {
      await expect(service.updateIban('user-1', { iban: 'FR7630006000011234567890188', bank_owner_name: 'Jean' })).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("même IBAN ré-enregistré : pas de nouvelle date de changement", async () => {
      crypto.decrypt.mockReturnValue('FR7630006000011234567890189');
      qb.getOne.mockResolvedValue({ user_id: 'user-1', iban_encrypted: 'x', iban_iv: 'i', iban_tag: 't', iban_updated_at: null });
      const result = await service.updateIban('user-1', { iban: IBAN, bank_owner_name: 'Jean Dupont' });
      expect(result.changed).toBe(false);
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ iban_updated_at: null }));
    });
  });

  describe('updateKyc', () => {
    it('horodate la soumission KYC', async () => {
      repo.findOne.mockResolvedValue({ user_id: 'user-1', kyc_status: KycStatus.PENDING });

      // Bug corrigé (test obsolète) : un justificatif est désormais
      // obligatoire pour soumettre (cf. OrganizerService.updateKyc).
      const result = await service.updateKyc('user-1', {
        kyc_status: KycStatus.SUBMITTED,
        kyc_document_url: 'https://minio.example.com/kbis.pdf',
      });

      expect(result.kyc_status).toBe(KycStatus.SUBMITTED);
      expect(result.kyc_submitted_at).toBeInstanceOf(Date);
    });

    it('efface le motif de rejet précédent quand le KYC est validé', async () => {
      // VERIFIED seulement depuis SUBMITTED avec justificatif ; kyc_rejected_reason simule un reliquat de rejet.
      repo.findOne.mockResolvedValue({
        user_id: 'user-1',
        kyc_status: KycStatus.SUBMITTED,
        kyc_document_url: 'https://minio.example.com/kbis.pdf',
        kyc_rejected_reason: 'Document illisible',
      });

      const result = await service.updateKyc('user-1', { kyc_status: KycStatus.VERIFIED });

      expect(result.kyc_status).toBe(KycStatus.VERIFIED);
      expect(result.kyc_rejected_reason).toBeNull();
      expect(result.kyc_verified_at).toBeInstanceOf(Date);
    });
  });

  describe('anonymize — droit à l\'effacement RGPD', () => {
    it("n'échoue pas si l'utilisateur n'a jamais créé de profil organisateur", async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.anonymize('user-sans-profil');

      expect(result).toEqual({ success: true });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('efface IBAN, KYC et réseaux sociaux', async () => {
      repo.findOne.mockResolvedValue({
        user_id: 'user-1',
        display_name: 'Mon Association',
        iban_encrypted: 'enc',
        iban_iv: 'iv',
        iban_tag: 'tag',
        bank_owner_name: 'Jean Dupont',
        stripe_connect_account_id: 'acct_123',
        kyc_document_url: 'https://minio/doc.pdf',
        social_instagram: '@jean',
      });

      const result = await service.anonymize('user-1');

      expect(result).toEqual({ success: true });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          iban_encrypted: null,
          iban_iv: null,
          iban_tag: null,
          bank_owner_name: null,
          stripe_connect_account_id: null,
          kyc_document_url: null,
          social_instagram: null,
        }),
      );
    });
  });
});
