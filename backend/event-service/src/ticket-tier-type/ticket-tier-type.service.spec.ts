import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TicketCategory } from '../ticket-category/ticket-category.entity';
import { TicketTierType } from './ticket-tier-type.entity';
import { TicketTierTypeService } from './ticket-tier-type.service';

describe('TicketTierTypeService', () => {
  let service: TicketTierTypeService;
  let repo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock; find: jest.Mock; remove: jest.Mock };
  let ticketCategoryRepo: { count: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockImplementation((type) => type),
      save: jest.fn().mockImplementation((type) => Promise.resolve(type)),
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
    };
    ticketCategoryRepo = { count: jest.fn().mockResolvedValue(0) };

    const module = await Test.createTestingModule({
      providers: [
        TicketTierTypeService,
        { provide: getRepositoryToken(TicketTierType), useValue: repo },
        { provide: getRepositoryToken(TicketCategory), useValue: ticketCategoryRepo },
      ],
    }).compile();

    service = module.get(TicketTierTypeService);
  });

  describe('assertActive', () => {
    it('ne lève rien si le nom correspond à un type actif', async () => {
      repo.findOne.mockResolvedValue({ label: 'Standard', is_active: true });
      await expect(service.assertActive('Standard')).resolves.toBeUndefined();
    });

    it('rejette un nom inconnu', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.assertActive('SuperVIPPlus')).rejects.toThrow(RpcException);
    });

    it('rejette un nom désactivé', async () => {
      repo.findOne.mockResolvedValue({ label: 'Standard', is_active: false });
      await expect(service.assertActive('Standard')).rejects.toThrow(RpcException);
    });
  });

  describe('create', () => {
    it('refuse un libellé déjà utilisé', async () => {
      repo.findOne.mockResolvedValue({ label: 'VIP' });
      await expect(service.create({ label: 'VIP' })).rejects.toThrow(RpcException);
    });

    it('crée le type avec les valeurs par défaut (emoji null, ordre 0)', async () => {
      repo.findOne.mockResolvedValue(null);
      const type = await service.create({ label: 'Fosse' });
      expect(type).toMatchObject({ label: 'Fosse', emoji: null, display_order: 0 });
    });
  });

  describe('remove', () => {
    it('refuse la suppression si des catégories de billets utilisent encore ce nom', async () => {
      repo.findOne.mockResolvedValue({ id: 'type-1', label: 'Standard' });
      ticketCategoryRepo.count.mockResolvedValue(39);

      await expect(service.remove('type-1')).rejects.toThrow(RpcException);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it("supprime le type s'il n'est référencé par aucune catégorie de billet", async () => {
      const type = { id: 'type-1', label: 'Fosse' };
      repo.findOne.mockResolvedValue(type);
      ticketCategoryRepo.count.mockResolvedValue(0);

      const result = await service.remove('type-1');

      expect(result).toEqual({ success: true });
      expect(repo.remove).toHaveBeenCalledWith(type);
    });
  });
});
