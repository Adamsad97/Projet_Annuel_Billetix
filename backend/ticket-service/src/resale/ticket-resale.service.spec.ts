import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { TicketService } from '../ticket/ticket.service';
import { ResaleStatus, TicketResale } from './ticket-resale.entity';
import { TicketResaleService } from './ticket-resale.service';

describe('TicketResaleService — réservation atomique (anti double-achat)', () => {
  let service: TicketResaleService;
  let repo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; createQueryBuilder: jest.Mock };
  let updateQueryBuilder: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    execute: jest.Mock;
    orderBy: jest.Mock;
    take: jest.Mock;
    getMany: jest.Mock;
  };
  let dataSource: { query: jest.Mock };
  let platformConfig: { get: jest.Mock };
  let ticketService: { transferToNewBuyer: jest.Mock; getById: jest.Mock; markForResale: jest.Mock };

  beforeEach(async () => {
    updateQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    repo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((resaleRecord) => Promise.resolve(resaleRecord)),
      create: jest.fn().mockImplementation((data) => data),
      createQueryBuilder: jest.fn().mockReturnValue(updateQueryBuilder),
    };
    dataSource = { query: jest.fn() };
    platformConfig = { get: jest.fn().mockResolvedValue({ resale_reservation_minutes: 15 }) };
    ticketService = { transferToNewBuyer: jest.fn(), getById: jest.fn(), markForResale: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TicketResaleService,
        { provide: getRepositoryToken(TicketResale), useValue: repo },
        { provide: TicketService, useValue: ticketService },
        { provide: DataSource, useValue: dataSource },
        { provide: PlatformConfigCache, useValue: platformConfig },
      ],
    }).compile();

    service = module.get(TicketResaleService);
  });

  describe('requestResale — plafonnement du prix (pas de revente à profit, cf. FAQ)', () => {
    const validTicket = {
      id: 'ticket-1',
      buyer_id: 'buyer-1',
      event_id: 'event-1',
      event_start_at: new Date(Date.now() + 86_400_000),
      ticket_category_id: 'cat-1',
      holder_first_name: 'Jean',
      holder_last_name: 'Dupont',
      unit_price_ttc: '50.00',
    };

    it('rejette un prix de revente supérieur à la valeur faciale du billet', async () => {
      ticketService.getById.mockResolvedValue(validTicket);
      repo.findOne.mockResolvedValue(undefined);

      await expect(
        service.requestResale({
          ticket_id: 'ticket-1',
          buyer_id: 'buyer-1',
          original_order_id: 'order-1',
          resale_price: 60,
        }),
      ).rejects.toThrow(RpcException);
      expect(ticketService.markForResale).not.toHaveBeenCalled();
    });

    it('rejette un prix de revente nul ou négatif', async () => {
      ticketService.getById.mockResolvedValue(validTicket);
      repo.findOne.mockResolvedValue(undefined);

      await expect(
        service.requestResale({
          ticket_id: 'ticket-1',
          buyer_id: 'buyer-1',
          original_order_id: 'order-1',
          resale_price: 0,
        }),
      ).rejects.toThrow(RpcException);
    });

    it('accepte un prix de revente égal ou inférieur à la valeur faciale', async () => {
      ticketService.getById.mockResolvedValue(validTicket);
      repo.findOne.mockResolvedValue(undefined);

      await service.requestResale({
        ticket_id: 'ticket-1',
        buyer_id: 'buyer-1',
        original_order_id: 'order-1',
        resale_price: 50,
      });

      expect(ticketService.markForResale).toHaveBeenCalledWith('ticket-1');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ resale_price: 50 }),
      );
    });

    it("rejette si le billet n'appartient pas à l'acheteur", async () => {
      ticketService.getById.mockResolvedValue(validTicket);

      await expect(
        service.requestResale({
          ticket_id: 'ticket-1',
          buyer_id: 'un-autre-acheteur',
          original_order_id: 'order-1',
          resale_price: 20,
        }),
      ).rejects.toThrow(RpcException);
    });
  });

  describe('listAllActive — marketplace globale (/revente)', () => {
    it('interroge uniquement les annonces LISTED à venir, triées par date de publication', async () => {
      const listings = [{ id: 'resale-1' }, { id: 'resale-2' }];
      updateQueryBuilder.getMany.mockResolvedValue(listings);

      const result = await service.listAllActive();

      expect(result).toBe(listings);
      expect(updateQueryBuilder.where).toHaveBeenCalledWith('r.status = :status', {
        status: ResaleStatus.LISTED,
      });
      expect(updateQueryBuilder.andWhere).toHaveBeenCalledWith('r.event_start_at > NOW()');
    });
  });

  describe("getActiveByTicketId — pour gérer l'annonce depuis la page du billet", () => {
    it('renvoie l\'annonce LISTED de ce billet', async () => {
      const resale = { id: 'resale-1', ticket_id: 'ticket-1', status: ResaleStatus.LISTED };
      repo.findOne.mockResolvedValue(resale);

      const result = await service.getActiveByTicketId('ticket-1');

      expect(result).toBe(resale);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { ticket_id: 'ticket-1', status: ResaleStatus.LISTED },
      });
    });

    it("renvoie null si ce billet n'est pas actuellement en vente", async () => {
      repo.findOne.mockResolvedValue(undefined);

      const result = await service.getActiveByTicketId('ticket-1');

      expect(result).toBeUndefined();
    });
  });

  describe('reserve', () => {
    it('réserve une offre LISTED et retourne son nouvel état', async () => {
      dataSource.query.mockResolvedValue([[{ id: 'resale-1' }]]);
      const reserved = { id: 'resale-1', status: ResaleStatus.RESERVED };
      repo.findOne.mockResolvedValue(reserved);

      const result = await service.reserve('resale-1', 'buyer-1');

      expect(result).toBe(reserved);
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'RESERVED'"),
        ['buyer-1', expect.any(Date), 'resale-1'],
      );
    });

    it('rejette si aucune ligne mise à jour (déjà réservée par un autre acheteur ou vendue)', async () => {
      dataSource.query.mockResolvedValue([[]]);
      repo.findOne.mockResolvedValue({ id: 'resale-1', status: ResaleStatus.SOLD });

      await expect(service.reserve('resale-1', 'buyer-2')).rejects.toThrow(RpcException);
    });

    it('rejette avec 404 si l\'offre n\'existe pas du tout', async () => {
      dataSource.query.mockResolvedValue([[]]);
      repo.findOne.mockResolvedValue(null);

      await expect(service.reserve('inconnu', 'buyer-2')).rejects.toThrow(RpcException);
    });

    it('reprend une réservation expirée (paiement jamais finalisé par le premier acheteur)', async () => {
      // La requête SQL elle-même gère la condition d'expiration ; on vérifie
      // simplement que le service ne fait aucune vérification supplémentaire
      // qui bloquerait ce cas (délégué entièrement à la clause WHERE atomique).
      dataSource.query.mockResolvedValue([[{ id: 'resale-1' }]]);
      repo.findOne.mockResolvedValue({ id: 'resale-1', status: ResaleStatus.RESERVED, reserved_by_buyer_id: 'buyer-2' });

      const result = await service.reserve('resale-1', 'buyer-2');

      expect(result.reserved_by_buyer_id).toBe('buyer-2');
    });
  });

  describe('releaseReservation', () => {
    it('remet l\'offre en LISTED via une requête conditionnelle sur le statut RESERVED', async () => {
      await service.releaseReservation('resale-1');

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'LISTED'"),
        ['resale-1'],
      );
    });
  });

  describe('completeResale — n\'accepte que l\'acheteur ayant réservé', () => {
    it('rejette si l\'offre n\'est pas RESERVED (jamais réservée ou déjà vendue)', async () => {
      repo.findOne.mockResolvedValue({ id: 'resale-1', status: ResaleStatus.LISTED });

      await expect(
        service.completeResale({
          resale_id: 'resale-1',
          new_buyer_id: 'buyer-1',
          new_order_id: 'order-1',
          new_buyer_email: 'buyer1@test.com',
          new_holder_first_name: 'Jean',
          new_holder_last_name: 'Dupont',
        }),
      ).rejects.toThrow(RpcException);
      expect(ticketService.transferToNewBuyer).not.toHaveBeenCalled();
    });

    it('rejette si le paiement provient d\'un acheteur différent de celui qui a réservé', async () => {
      repo.findOne.mockResolvedValue({
        id: 'resale-1',
        status: ResaleStatus.RESERVED,
        reserved_by_buyer_id: 'buyer-1',
      });

      await expect(
        service.completeResale({
          resale_id: 'resale-1',
          new_buyer_id: 'buyer-2',
          new_order_id: 'order-1',
          new_buyer_email: 'buyer2@test.com',
          new_holder_first_name: 'Paul',
          new_holder_last_name: 'Durand',
        }),
      ).rejects.toThrow(RpcException);
      expect(ticketService.transferToNewBuyer).not.toHaveBeenCalled();
    });

    it('transfère le billet quand le paiement provient bien de l\'acheteur ayant réservé', async () => {
      const resale = {
        id: 'resale-1',
        ticket_id: 'ticket-1',
        status: ResaleStatus.RESERVED,
        reserved_by_buyer_id: 'buyer-1',
        original_order_id: 'order-orig',
      };
      repo.findOne.mockResolvedValue(resale);

      const result = await service.completeResale({
        resale_id: 'resale-1',
        new_buyer_id: 'buyer-1',
        new_order_id: 'order-1',
        new_buyer_email: 'marie@test.com',
        new_holder_first_name: 'Marie',
        new_holder_last_name: 'Martin',
      });

      expect(ticketService.transferToNewBuyer).toHaveBeenCalledWith(
        'ticket-1',
        'buyer-1',
        'order-1',
        'marie@test.com',
        'Marie',
        'Martin',
      );
      expect(result.originalOrderId).toBe('order-orig');
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: ResaleStatus.SOLD }));
    });
  });
});

describe('TicketResaleService — historique des reventes', () => {
  let service: TicketResaleService;
  let repo: { find: jest.Mock };
  const tickets = [
    { id: 't1', reference: 'TKT-1', event_name: 'Concert', ticket_category_name: 'Standard', unit_price_ttc: '50.00' },
  ];

  beforeEach(async () => {
    repo = { find: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        TicketResaleService,
        { provide: getRepositoryToken(TicketResale), useValue: repo },
        { provide: TicketService, useValue: {} },
        { provide: DataSource, useValue: { getRepository: () => ({ findBy: jest.fn().mockResolvedValue(tickets) }) } },
        { provide: PlatformConfigCache, useValue: {} },
      ],
    }).compile();
    service = module.get(TicketResaleService);
  });

  it('le vendeur garde la trace de ses annonces, avec les infos lisibles du billet', async () => {
    repo.find.mockResolvedValue([
      { id: 'r1', ticket_id: 't1', status: ResaleStatus.SOLD, resale_price: '45.00', sold_at: new Date() },
    ]);

    const result = await service.listBySeller('vendeur');

    expect(repo.find).toHaveBeenCalledWith({ where: { original_buyer_id: 'vendeur' }, order: { listed_at: 'DESC' } });
    expect(result[0]).toMatchObject({ ticket_reference: 'TKT-1', event_name: 'Concert', face_value: 50 });
  });

  it("retrouve les billets revendus depuis une commande (qui n'y sont plus rattachés)", async () => {
    repo.find.mockResolvedValue([]);
    await service.listSoldFromOrder('order-orig');
    expect(repo.find).toHaveBeenCalledWith({
      where: { original_order_id: 'order-orig', status: ResaleStatus.SOLD },
      order: { sold_at: 'DESC' },
    });
  });
});
