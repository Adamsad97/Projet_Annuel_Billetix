import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlatformSetting } from './platform-config.entity';
import { PlatformConfigService } from './platform-config.service';

describe('PlatformConfigService', () => {
  let service: PlatformConfigService;
  let repo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; find: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
      create: jest.fn().mockImplementation((s) => s),
      find: jest.fn(),
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
      repo.findOne.mockResolvedValue({ key: 'tva_rate', value: '0.18' });

      await service.onModuleInit();

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('insère les paramètres manquants avec leur valeur par défaut', async () => {
      repo.findOne.mockResolvedValue(null);

      await service.onModuleInit();

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'fill_thresholds', value: '[25,50,75,100]' }),
      );
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
      expect(config.platform_legal_name).toBe('BilletiX SAS');
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
});
