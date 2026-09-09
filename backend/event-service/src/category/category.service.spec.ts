import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Event } from '../event/event.entity';
import { Category } from './category.entity';
import { CategoryService } from './category.service';

describe('CategoryService', () => {
  let service: CategoryService;
  let repo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock; find: jest.Mock; remove: jest.Mock };
  let eventRepo: { count: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockImplementation((category) => category),
      save: jest.fn().mockImplementation((category) => Promise.resolve(category)),
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
    };
    eventRepo = { count: jest.fn().mockResolvedValue(0) };

    const module = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: getRepositoryToken(Category), useValue: repo },
        { provide: getRepositoryToken(Event), useValue: eventRepo },
      ],
    }).compile();

    service = module.get(CategoryService);
  });

  describe('assertActive', () => {
    it("ne lève rien si le code correspond à une catégorie active", async () => {
      repo.findOne.mockResolvedValue({ code: 'CONCERT', is_active: true });
      await expect(service.assertActive('CONCERT')).resolves.toBeUndefined();
    });

    it('rejette un code inconnu', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.assertActive('INEXISTANT')).rejects.toThrow(RpcException);
    });

    it('rejette une catégorie désactivée', async () => {
      repo.findOne.mockResolvedValue({ code: 'CONCERT', is_active: false });
      await expect(service.assertActive('CONCERT')).rejects.toThrow(RpcException);
    });
  });

  describe('create', () => {
    it('refuse un code déjà utilisé par une autre catégorie', async () => {
      repo.findOne.mockResolvedValue({ code: 'CONCERT' });
      await expect(service.create({ code: 'CONCERT', label: 'Concert' })).rejects.toThrow(RpcException);
    });

    it('crée la catégorie avec les valeurs par défaut (emoji null, ordre 0)', async () => {
      repo.findOne.mockResolvedValue(null);
      const category = await service.create({ code: 'EXPO', label: 'Exposition' });
      expect(category).toMatchObject({ code: 'EXPO', label: 'Exposition', emoji: null, display_order: 0 });
    });
  });

  describe('remove', () => {
    it('refuse la suppression si des événements utilisent encore ce code', async () => {
      repo.findOne.mockResolvedValue({ id: 'cat-1', code: 'CONCERT' });
      eventRepo.count.mockResolvedValue(44);

      await expect(service.remove('cat-1')).rejects.toThrow(RpcException);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('supprime la catégorie si elle n\'est référencée par aucun événement', async () => {
      const category = { id: 'cat-1', code: 'EXPO' };
      repo.findOne.mockResolvedValue(category);
      eventRepo.count.mockResolvedValue(0);

      const result = await service.remove('cat-1');

      expect(result).toEqual({ success: true });
      expect(repo.remove).toHaveBeenCalledWith(category);
    });
  });
});
