import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlatformSetting } from './platform-config.entity';
import { DEFAULTS, PlatformConfigService } from './platform-config.service';

describe('PlatformConfigService', () => {
  let service: PlatformConfigService;
  let repo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; find: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((setting) => Promise.resolve(setting)),
      create: jest.fn().mockImplementation((setting) => setting),
      find: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };

    const module = await Test.createTestingModule({
      providers: [
        PlatformConfigService,
        { provide: getRepositoryToken(PlatformSetting), useValue: repo },
      ],
    }).compile();

    service = module.get(PlatformConfigService);
  });

  describe('onModuleInit', () => {
    it('ne recrée pas un paramètre déjà présent en base (pas de valeur écrasée)', async () => {
      repo.find.mockResolvedValue([{ key: 'stripe_fee_percent' }]);

      await service.onModuleInit();

      const [inserted] = repo.save.mock.calls[0];
      expect(inserted.map((setting: { key: string }) => setting.key)).not.toContain('stripe_fee_percent');
    });

    it("n'écrit rien quand tous les paramètres existent déjà", async () => {
      repo.find.mockResolvedValue(DEFAULTS.map((setting) => ({ key: setting.key })));

      await service.onModuleInit();

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('insère les paramètres manquants avec leur valeur par défaut, en une seule écriture', async () => {
      repo.find.mockResolvedValue([]);

      await service.onModuleInit();

      expect(repo.find).toHaveBeenCalledTimes(1);
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.save.mock.calls[0][0]).toContainEqual(
        expect.objectContaining({ key: 'fill_thresholds', value: '[25,50,75,100]' }),
      );
    });

    it("supprime les réglages retirés du produit (QR fixe : plus d'option « rotation activée »)", async () => {
      repo.find.mockResolvedValue([]);

      await service.onModuleInit();

      const [criteria] = repo.delete.mock.calls[0];
      expect(criteria.key.value).toContain('ticket_qr_rotation_enabled');
    });
  });

  describe('getAll', () => {
    it('lit les seuils de remplissage depuis la base — jamais une valeur figée dans le code', async () => {
      repo.find.mockResolvedValue([
        { key: 'fill_thresholds', value: '[10,30,60,90]' },
      ]);

      const config = await service.getAll();

      expect(config.fill_thresholds).toEqual([10, 30, 60, 90]);
    });

    it('retombe sur les valeurs par défaut si un paramètre est absent en base', async () => {
      repo.find.mockResolvedValue([]);

      const config = await service.getAll();

      expect(config.commission_standard_percent).toBe(10);
      expect(config.fill_thresholds).toEqual([25, 50, 75, 100]);
      expect(config.platform_legal_name).toBe('BilleTix SAS');
    });

    it('lit les infos légales de la plateforme depuis la base', async () => {
      repo.find.mockResolvedValue([
        { key: 'platform_siret', value: '123 456 789 00012' },
        { key: 'platform_vat_number', value: 'FR12345678900' },
      ]);

      const config = await service.getAll();

      expect(config.platform_siret).toBe('123 456 789 00012');
      expect(config.platform_vat_number).toBe('FR12345678900');
    });
  });

  describe('update', () => {
    it('rejette la mise à jour d\'une clé inconnue', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('cle_inexistante', '42')).rejects.toThrow('Paramètre inconnu');
    });

    it('met à jour la valeur d\'un paramètre existant', async () => {
      repo.findOne.mockResolvedValue({ key: 'fill_thresholds', value: '[25,50,75,100]' });

      const result = await service.update('fill_thresholds', '[20,40,60,80,100]');

      expect(result.value).toBe('[20,40,60,80,100]');
    });
  });

  describe('droits par section et bornes', () => {
    it('réserve les sections sensibles au super admin (lecture)', async () => {
      repo.find.mockResolvedValue([
        { key: 'stripe_fee_percent', value: '2.9', type: 'number' },
        { key: 'ticket_qr_display_seconds', value: '60', type: 'number' },
      ]);

      const forAdmin = await service.list('ADMIN');
      expect(forAdmin.map((s) => s.key)).toEqual(['ticket_qr_display_seconds']);

      const forSuperAdmin = await service.list('SUPER_ADMIN');
      expect(forSuperAdmin).toEqual(
        expect.arrayContaining([expect.objectContaining({ key: 'stripe_fee_percent', section: 'payment_fees', super_admin_only: true })]),
      );
    });

    it("refuse à un admin la modification d'un réglage sensible", async () => {
      repo.findOne.mockResolvedValue({ key: 'stripe_fee_percent', value: '2.9', type: 'number' });
      await expect(service.update('stripe_fee_percent', '3.1', 'ADMIN')).rejects.toThrow('réservé au super administrateur');
    });

    it("renvoie l'ancienne valeur pour la traçabilité", async () => {
      repo.findOne.mockResolvedValue({ key: 'stripe_fee_percent', value: '2.9', type: 'number' });
      await expect(service.update('stripe_fee_percent', '3.1', 'SUPER_ADMIN')).resolves.toMatchObject({
        value: '3.1',
        previous_value: '2.9',
      });
    });

    it('refuse une valeur hors bornes (négative, pourcentage > 100)', async () => {
      repo.findOne.mockResolvedValue({ key: 'ticket_qr_display_seconds', value: '60', type: 'number' });
      await expect(service.update('ticket_qr_display_seconds', '-5', 'ADMIN')).rejects.toThrow('négative');
      repo.findOne.mockResolvedValue({ key: 'stripe_fee_percent', value: '2.9', type: 'number' });
      await expect(service.update('stripe_fee_percent', '150', 'SUPER_ADMIN')).rejects.toThrow('entre 0 et 100');
    });

    it("lien magique : 0 le désactive, au-delà de 60 minutes la valeur est refusée", async () => {
      repo.findOne.mockResolvedValue({ key: 'magic_link_ttl_minutes', value: '15', type: 'number' });
      await expect(service.update('magic_link_ttl_minutes', '0', 'SUPER_ADMIN')).resolves.toMatchObject({ value: '0' });
      repo.findOne.mockResolvedValue({ key: 'magic_link_ttl_minutes', value: '15', type: 'number' });
      await expect(service.update('magic_link_ttl_minutes', '120', 'SUPER_ADMIN')).rejects.toThrow('60 minutes');
    });
  });
});
