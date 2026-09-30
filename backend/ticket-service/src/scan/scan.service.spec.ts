import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
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
  let eventClient: { send: jest.Mock };

  const HOUR = 3600_000;
  // Événement en cours : début il y a 1 h, fin dans 2 h.
  const liveEvent = () => ({
    status: 'PUBLISHED',
    is_hidden: false,
    start_date: new Date(Date.now() - HOUR).toISOString(),
    end_date: new Date(Date.now() + 2 * HOUR).toISOString(),
  });
  const liveTicket = (overrides: Partial<Ticket> = {}) =>
    ({
      id: 'ticket-1',
      event_id: 'event-1',
      status: TicketStatus.SENT,
      qr_code_token: 'jeton-1',
      event_start_at: new Date(Date.now() - HOUR),
      event_end_at: new Date(Date.now() + 2 * HOUR),
      ...overrides,
    }) as Ticket;

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
    eventClient = { send: jest.fn().mockReturnValue(of(liveEvent())) };

    const module = await Test.createTestingModule({
      providers: [
        ScanService,
        { provide: getRepositoryToken(ScanLog), useValue: logRepo },
        { provide: TicketService, useValue: ticketService },
        { provide: ControlAgentService, useValue: controlAgentService },
        {
          provide: PlatformConfigCache,
          useValue: { get: jest.fn().mockResolvedValue({ scan_opens_before_minutes: 180, scan_closes_after_minutes: 60 }) },
        },
        { provide: 'EVENT_SERVICE', useValue: eventClient },
      ],
    }).compile();

    service = module.get(ScanService);
  });

  it("valide un billet correspondant au bon événement et le marque comme utilisé", async () => {
    const ticket = liveTicket();
    ticketService.verifyQr.mockResolvedValue({ valid: true, ticket });
    ticketService.markUsed.mockResolvedValue({ ...ticket, status: TicketStatus.USED });

    const result = await service.scan(baseDto);

    expect(result.result).toBe(ScanResult.SUCCESS);
    // Consommation liée au jeton lu à la vérification (cf. TicketService.markUsed).
    expect(ticketService.markUsed).toHaveBeenCalledWith('ticket-1', 'agent-1', undefined, 'jeton-1');
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

  describe("contrôle de l'événement au scan", () => {
    it.each([
      ['suspendu', { status: 'SUSPENDED' }],
      ['annulé', { status: 'CANCELLED' }],
      ['masqué', { is_hidden: true }],
      ['pas encore publié', { status: 'PENDING_VALIDATION' }],
    ])('refuse un événement %s (EVENT_UNAVAILABLE), sans consommer le billet', async (_label, overrides) => {
      ticketService.verifyQr.mockResolvedValue({ valid: true, ticket: liveTicket() });
      eventClient.send.mockReturnValue(of({ ...liveEvent(), ...overrides }));

      const result = await service.scan(baseDto);

      expect(result.result).toBe(ScanResult.EVENT_UNAVAILABLE);
      expect(ticketService.markUsed).not.toHaveBeenCalled();
    });

    it('refuse avant l\'ouverture du contrôle (TOO_EARLY)', async () => {
      ticketService.verifyQr.mockResolvedValue({ valid: true, ticket: liveTicket() });
      eventClient.send.mockReturnValue(
        of({ ...liveEvent(), start_date: new Date(Date.now() + 5 * HOUR).toISOString(), end_date: new Date(Date.now() + 8 * HOUR).toISOString() }),
      );

      expect((await service.scan(baseDto)).result).toBe(ScanResult.TOO_EARLY);
      expect(ticketService.markUsed).not.toHaveBeenCalled();
    });

    it('accepte dans la fenêtre d\'ouverture avant le début (2 h avant, ouverture 3 h avant)', async () => {
      const ticket = liveTicket();
      ticketService.verifyQr.mockResolvedValue({ valid: true, ticket });
      ticketService.markUsed.mockResolvedValue({ ...ticket, status: TicketStatus.USED });
      eventClient.send.mockReturnValue(
        of({ ...liveEvent(), start_date: new Date(Date.now() + 2 * HOUR).toISOString(), end_date: new Date(Date.now() + 5 * HOUR).toISOString() }),
      );

      expect((await service.scan(baseDto)).result).toBe(ScanResult.SUCCESS);
    });

    it('refuse après la fermeture du contrôle (TOO_LATE), même événement terminé', async () => {
      ticketService.verifyQr.mockResolvedValue({ valid: true, ticket: liveTicket() });
      eventClient.send.mockReturnValue(
        of({ status: 'TERMINATED', start_date: new Date(Date.now() - 6 * HOUR).toISOString(), end_date: new Date(Date.now() - 2 * HOUR).toISOString() }),
      );

      expect((await service.scan(baseDto)).result).toBe(ScanResult.TOO_LATE);
    });

    it("event-service injoignable : l'entrée n'est pas bloquée, la fenêtre est jugée sur les dates du billet", async () => {
      ticketService.verifyQr.mockResolvedValue({ valid: true, ticket: liveTicket({ event_start_at: new Date(Date.now() + 5 * HOUR), event_end_at: null }) });
      eventClient.send.mockReturnValue(throwError(() => new Error('connexion refusée')));

      expect((await service.scan(baseDto)).result).toBe(ScanResult.TOO_EARLY);
    });
  });
});
