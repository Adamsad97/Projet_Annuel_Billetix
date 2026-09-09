import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BuyerProfile } from './buyer-profile.entity';
import { BuyerService } from './buyer.service';

describe('BuyerService', () => {
  let service: BuyerService;
  let repo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let queryBuilder: { select: jest.Mock; where: jest.Mock; getRawMany: jest.Mock };

  beforeEach(async () => {
    queryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };
    repo = {
      findOne: jest.fn(),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((data) => data),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const module = await Test.createTestingModule({
      providers: [
        BuyerService,
        { provide: getRepositoryToken(BuyerProfile), useValue: repo },
      ],
    }).compile();

    service = module.get(BuyerService);
  });

  describe('getNotificationPrefs', () => {
    it("renvoie un objet vide pour un acheteur n'ayant jamais rien modifié", async () => {
      repo.findOne.mockResolvedValue({ user_id: 'user-1', notification_preferences: null });

      const result = await service.getNotificationPrefs('user-1');

      expect(result).toEqual({});
    });

    it('renvoie les préférences déjà enregistrées', async () => {
      repo.findOne.mockResolvedValue({
        user_id: 'user-1',
        notification_preferences: { newsletter: true, 'event-reminder': false },
      });

      const result = await service.getNotificationPrefs('user-1');

      expect(result).toEqual({ newsletter: true, 'event-reminder': false });
    });
  });

  describe('updateNotificationPrefs', () => {
    it("fusionne les nouvelles préférences avec l'existant plutôt que de le remplacer", async () => {
      repo.findOne.mockResolvedValue({
        user_id: 'user-1',
        notification_preferences: { newsletter: true, 'low-stock': true },
      });

      const result = await service.updateNotificationPrefs('user-1', {
        preferences: { newsletter: false },
      });

      expect(result).toEqual({ newsletter: false, 'low-stock': true });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_preferences: { newsletter: false, 'low-stock': true },
        }),
      );
    });

    it('crée le profil acheteur au passage si aucun n\'existait encore', async () => {
      repo.findOne.mockResolvedValue(undefined);

      await service.updateNotificationPrefs('user-nouveau', {
        preferences: { newsletter: true },
      });

      expect(repo.create).toHaveBeenCalledWith({ user_id: 'user-nouveau' });
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('listNewsletterSubscribers', () => {
    it('ne renvoie que les user_id ayant explicitement activé la newsletter (opt-in)', async () => {
      queryBuilder.getRawMany.mockResolvedValue([
        { user_id: 'user-1' },
        { user_id: 'user-2' },
      ]);

      const result = await service.listNewsletterSubscribers();

      expect(result).toEqual(['user-1', 'user-2']);
      expect(queryBuilder.where).toHaveBeenCalledWith(
        expect.stringContaining("notification_preferences ->> 'newsletter' = 'true'"),
      );
    });

    it("renvoie un tableau vide quand personne n'est abonné", async () => {
      queryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.listNewsletterSubscribers();

      expect(result).toEqual([]);
    });
  });
});
