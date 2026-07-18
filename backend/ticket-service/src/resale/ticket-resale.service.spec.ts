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
  let repo: { findOne: jest.Mock; save: jest.Mock; createQueryBuilder: jest.Mock };
  let updateQueryBuilder: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    execute: jest.Mock;
  };
  let dataSource: { query: jest.Mock };
  let platformConfig: { get: jest.Mock };
  let ticketService: { transferToNewBuyer: jest.Mock };

  beforeEach(async () => {
    updateQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    repo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((r) => Promise.resolve(r)),
      createQueryBuilder: jest.fn().mockReturnValue(updateQueryBuilder),
    };
    dataSource = { query: jest.fn() };
    platformConfig = { get: jest.fn().mockResolvedValue({ resale_reservation_minutes: 15 }) };
    ticketService = { transferToNewBuyer: jest.fn() };

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
        service.completeResale({ resale_id: 'resale-1', new_buyer_id: 'buyer-1', new_order_id: 'order-1' }),
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
        service.completeResale({ resale_id: 'resale-1', new_buyer_id: 'buyer-2', new_order_id: 'order-1' }),
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
      });

      expect(ticketService.transferToNewBuyer).toHaveBeenCalledWith('ticket-1', 'buyer-1', 'order-1');
      expect(result.originalOrderId).toBe('order-orig');
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: ResaleStatus.SOLD }));
    });
  });
});
