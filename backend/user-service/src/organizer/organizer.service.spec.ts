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
    it("refuse d'enregistrer un IBAN si la 2FA n'est pas activée", async () => {
      authClient.send.mockReturnValue(of({ two_factor_enabled: false }));

      await expect(
        service.updateIban('user-1', { iban: 'FR7612345', bank_owner_name: 'Jean Dupont' }),
      ).rejects.toThrow(RpcException);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('enregistre un IBAN chiffré quand la 2FA est activée', async () => {
      authClient.send.mockReturnValue(of({ two_factor_enabled: true }));
      repo.findOne.mockResolvedValue({ user_id: 'user-1' });

      const result = await service.updateIban('user-1', { iban: 'FR7612345', bank_owner_name: 'Jean Dupont' });

      expect(result).toEqual({ success: true });
      expect(crypto.encrypt).toHaveBeenCalledWith('FR7612345');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ iban_encrypted: 'enc', iban_iv: 'iv', iban_tag: 'tag' }),
      );
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
      // Bug corrigé (test obsolète) : VERIFIED/REJECTED n'est désormais
      // accepté que depuis SUBMITTED (workflow soumission→examen imposé),
      // et VERIFIED exige un justificatif déjà présent sur le profil —
      // REJECTED seul (sans nouvelle soumission) est justement rejeté par
      // le code depuis ce correctif. kyc_rejected_reason simule ici un
      // reliquat d'un rejet précédent sur un profil qui vient d'être
      // resoumis (la resoumission elle-même l'efface déjà, mais VERIFIED
      // doit rester défensif quel que soit l'état de ce champ).
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
