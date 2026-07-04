import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Ticket, TicketStatus } from '../ticket/ticket.entity';
import { TicketService } from '../ticket/ticket.service';
import { ScanLog, ScanResult } from './scan-log.entity';
import { ScanService } from './scan.service';

describe('ScanService', () => {
  let service: ScanService;
  let logRepo: { save: jest.Mock; create: jest.Mock; findOne: jest.Mock };
  let ticketService: { verifyQr: jest.Mock; markUsed: jest.Mock };

  const baseDto = { qr_token: 'tok-1', agent_id: 'agent-1', event_id: 'event-1' };

  beforeEach(async () => {
    logRepo = {
      save: jest.fn().mockImplementation((l) => Promise.resolve(l)),
      create: jest.fn().mockImplementation((l) => l),
      findOne: jest.fn(),
    };
    ticketService = { verifyQr: jest.fn(), markUsed: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ScanService,
        { provide: getRepositoryToken(ScanLog), useValue: logRepo },
        { provide: TicketService, useValue: ticketService },
      ],
    }).compile();

    service = module.get(ScanService);
  });

  it("valide un billet correspondant au bon événement et le marque comme utilisé", async () => {
    const ticket = { id: 'ticket-1', event_id: 'event-1', status: TicketStatus.SENT } as Ticket;
    ticketService.verifyQr.mockResolvedValue({ valid: true, ticket });
    ticketService.markUsed.mockResolvedValue({ ...ticket, status: TicketStatus.USED });

    const result = await service.scan(baseDto);

    expect(result.result).toBe(ScanResult.SUCCESS);
    expect(ticketService.markUsed).toHaveBeenCalledWith('ticket-1', 'agent-1', undefined);
    expect(logRepo.save).toHaveBeenCalled();
  });

  it("refuse un billet valide mais présenté au mauvais événement", async () => {
    const ticket = { id: 'ticket-1', event_id: 'event-AUTRE', status: TicketStatus.SENT } as Ticket;
    ticketService.verifyQr.mockResolvedValue({ valid: true, ticket });

    const result = await service.scan(baseDto);

    expect(result.result).toBe(ScanResult.INVALID);
    expect(ticketService.markUsed).not.toHaveBeenCalled();
  });

  it('détecte un double scan (billet déjà utilisé)', async () => {
    ticketService.verifyQr.mockRejectedValue({ error: { message: 'Billet déjà utilisé' } });
    logRepo.findOne.mockResolvedValue({ ticket_id: 'ticket-1' });

    const result = await service.scan(baseDto);

    expect(result.result).toBe(ScanResult.ALREADY_USED);
  });

  it('signale un billet annulé ou remboursé', async () => {
    ticketService.verifyQr.mockRejectedValue({ error: { message: 'Billet annulé ou remboursé' } });

    const result = await service.scan(baseDto);

    expect(result.result).toBe(ScanResult.CANCELLED);
  });

  it('signale un QR code invalide (billet introuvable)', async () => {
    ticketService.verifyQr.mockRejectedValue({ error: { message: 'QR code invalide' } });

    const result = await service.scan(baseDto);

    expect(result.result).toBe(ScanResult.INVALID);
  });

  it('enregistre systématiquement un log de scan, quel que soit le résultat', async () => {
    ticketService.verifyQr.mockRejectedValue({ error: { message: 'QR code invalide' } });

    await service.scan(baseDto);

    expect(logRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ agent_id: 'agent-1', event_id: 'event-1', result: ScanResult.INVALID }),
    );
    expect(logRepo.save).toHaveBeenCalledTimes(1);
  });
});
