import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ControlAgentService } from '../control-agent/control-agent.service';
import { Ticket, TicketStatus } from '../ticket/ticket.entity';
import { TicketService } from '../ticket/ticket.service';
import { ScanLog, ScanResult } from './scan-log.entity';
import { ScanService } from './scan.service';

describe('ScanService', () => {
  let service: ScanService;
  let logRepo: { save: jest.Mock; create: jest.Mock; findOne: jest.Mock };
  let ticketService: {
    verifyQr: jest.Mock;
    markUsed: jest.Mock;
    resolveTicketId: jest.Mock;
  };
  let controlAgentService: { isAssigned: jest.Mock };

  const baseDto = { qr_token: 'tok-1', agent_id: 'agent-1', event_id: 'event-1' };

  beforeEach(async () => {
    logRepo = {
      save: jest.fn().mockImplementation((scanLog) => Promise.resolve(scanLog)),
      create: jest.fn().mockImplementation((scanLog) => scanLog),
      findOne: jest.fn(),
    };
    ticketService = {
      verifyQr: jest.fn(),
      markUsed: jest.fn(),
      resolveTicketId: jest.fn().mockResolvedValue('ticket-1'),
    };
    // Par défaut : agent bien affecté à l'événement — les tests d'affectation
    // (CDC §6.2) surchargent explicitement quand ils testent le rejet.
    controlAgentService = { isAssigned: jest.fn().mockResolvedValue(true) };

    const module = await Test.createTestingModule({
      providers: [
        ScanService,
        { provide: getRepositoryToken(ScanLog), useValue: logRepo },
        { provide: TicketService, useValue: ticketService },
        { provide: ControlAgentService, useValue: controlAgentService },
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

  it("refuse (WRONG_EVENT, pas INVALID) un billet valide mais présenté au mauvais événement", async () => {
    const ticket = { id: 'ticket-1', event_id: 'event-AUTRE', status: TicketStatus.SENT } as Ticket;
    ticketService.verifyQr.mockResolvedValue({ valid: true, ticket });

    const result = await service.scan(baseDto);

    expect(result.result).toBe(ScanResult.WRONG_EVENT);
    expect(ticketService.markUsed).not.toHaveBeenCalled();
  });

  it('détecte un double scan (billet déjà utilisé) et retrouve le bon ticket_id via qr_token_history, pas le dernier log de l\'événement', async () => {
    ticketService.verifyQr.mockRejectedValue({ error: { code: 'ALREADY_USED', message: 'Billet déjà utilisé' } });
    // Un autre billet a été scanné juste avant sur le même événement — si le
    // code retombait sur "dernier log de l'événement" (ancien bug), il
    // renverrait ticket_id "un-autre-ticket" au lieu du bon.
    logRepo.findOne.mockResolvedValue({ ticket_id: 'un-autre-ticket' });

    const result = await service.scan(baseDto);

    expect(result.result).toBe(ScanResult.ALREADY_USED);
    expect(result.ticket_id).toBe('ticket-1');
  });

  it("signale un billet revendu (SUPERSEDED, pas INVALID) — ancien QR après transfert", async () => {
    ticketService.verifyQr.mockRejectedValue({
      error: { code: 'SUPERSEDED', message: "Ce billet a changé de titulaire (revente ou transfert) — ce QR code n'est plus valide" },
    });

    const result = await service.scan(baseDto);

    expect(result.result).toBe(ScanResult.SUPERSEDED);
    expect(ticketService.markUsed).not.toHaveBeenCalled();
  });

  it('signale un billet annulé ou remboursé', async () => {
    ticketService.verifyQr.mockRejectedValue({ error: { code: 'CANCELLED', message: 'Billet annulé ou remboursé' } });

    const result = await service.scan(baseDto);

    expect(result.result).toBe(ScanResult.CANCELLED);
  });

  it('signale un QR code invalide (billet introuvable)', async () => {
    ticketService.verifyQr.mockRejectedValue({ error: { code: 'INVALID', message: 'QR code invalide' } });

    const result = await service.scan(baseDto);

    expect(result.result).toBe(ScanResult.INVALID);
  });

  it('signale un QR code invalide quand la résolution du jeton échoue avant tout lookup du billet (jeton absent de qr_token_history)', async () => {
    ticketService.resolveTicketId.mockRejectedValue({ error: { code: 'INVALID', message: 'QR code invalide' } });

    const result = await service.scan(baseDto);

    expect(result.result).toBe(ScanResult.INVALID);
    expect(result.ticket_id).toBe('unknown');
    expect(ticketService.verifyQr).not.toHaveBeenCalled();
  });

  it('enregistre systématiquement un log de scan, quel que soit le résultat', async () => {
    ticketService.verifyQr.mockRejectedValue({ error: { code: 'INVALID', message: 'QR code invalide' } });

    await service.scan(baseDto);

    expect(logRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ agent_id: 'agent-1', event_id: 'event-1', result: ScanResult.INVALID }),
    );
    expect(logRepo.save).toHaveBeenCalledTimes(1);
  });
});
