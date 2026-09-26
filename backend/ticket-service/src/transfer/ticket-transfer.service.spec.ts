import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { QrTokenHistory } from '../ticket/qr-token-history.entity';
import { Ticket, TicketStatus } from '../ticket/ticket.entity';
import { TicketTransfer, TicketTransferStatus, TransferRevertSource } from './ticket-transfer.entity';
import { RevertRequestStatus, TransferRevertRequest } from './transfer-revert-request.entity';
import { GiftTicketInput, TicketTransferService } from './ticket-transfer.service';

describe('TicketTransferService — offrir un billet', () => {
  let service: TicketTransferService;
  let ticket: Record<string, unknown>;
  let previousTransfers: number;
  let manager: {
    findOne: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let platformConfig: { get: jest.Mock };
  let transferRow: Record<string, unknown>;
  let requestRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };

  const input: GiftTicketInput = {
    ticket_id: 'ticket-1',
    from_user_id: 'jean',
    from_first_name: 'Jean',
    from_last_name: 'Dupont',
    to_user_id: 'marie',
    to_email: 'marie@example.com',
    to_holder_first_name: ' Paul ',
    to_holder_last_name: 'Martin',
    ip_address: '10.0.0.1',
    user_agent: 'Test/1.0',
  };

  beforeEach(async () => {
    ticket = {
      id: 'ticket-1',
      reference: 'TKT-2026-000001',
      event_id: 'event-1',
      event_name: 'Concert',
      event_start_at: new Date(Date.now() + 7 * 24 * 3600_000),
      ticket_category_name: 'Standard',
      buyer_id: 'jean',
      buyer_email: 'jean@example.com',
      holder_first_name: 'Jean',
      holder_last_name: 'Dupont',
      qr_code_token: 'ancien-jeton',
      pdf_url: 'tickets/ticket-TKT-2026-000001.pdf',
      status: TicketStatus.SENT,
    };
    previousTransfers = 0;
    transferRow = {
      id: 'tr-1',
      ticket_id: 'ticket-1',
      status: TicketTransferStatus.ACTIVE,
      from_user_id: 'jean',
      from_email: 'jean@example.com',
      from_holder_first_name: 'Jean',
      from_holder_last_name: 'Dupont',
      to_user_id: 'marie',
    };
    requestRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((row) => Promise.resolve(row)),
      create: jest.fn((row) => row),
    };
    manager = {
      findOne: jest.fn((entity) => Promise.resolve(entity === TicketTransfer ? transferRow : ticket)),
      count: jest.fn(() => Promise.resolve(previousTransfers)),
      create: jest.fn((_entity, data) => data),
      save: jest.fn((row) => Promise.resolve(row)),
      update: jest.fn().mockResolvedValue(undefined),
    };
    platformConfig = {
      get: jest.fn().mockResolvedValue({ ticket_transfer_max_per_ticket: 1, ticket_transfer_cutoff_hours: 2 }),
    };

    const module = await Test.createTestingModule({
      providers: [
        TicketTransferService,
        { provide: getRepositoryToken(TicketTransfer), useValue: { findOne: jest.fn(() => Promise.resolve(transferRow)) } },
        { provide: getRepositoryToken(TransferRevertRequest), useValue: requestRepo },
        {
          provide: DataSource,
          useValue: {
            transaction: (work: (m: typeof manager) => unknown) => work(manager),
            getRepository: () => ({ findOne: () => Promise.resolve(ticket) }),
          },
        },
        { provide: PlatformConfigCache, useValue: platformConfig },
      ],
    }).compile();
    service = module.get(TicketTransferService);
  });

  it('change immédiatement de titulaire et de jeton interne, et invalide l’ancien PDF', async () => {
    const { ticket: updated } = await service.gift(input);

    expect(updated).toMatchObject({
      buyer_id: 'marie',
      buyer_email: 'marie@example.com',
      holder_first_name: 'Paul',
      holder_last_name: 'Martin',
      pdf_url: null,
    });
    expect(updated.qr_code_token).not.toBe('ancien-jeton');
    expect(manager.update).toHaveBeenCalledWith(QrTokenHistory, { token: 'ancien-jeton' }, { is_current: false });
    expect(manager.findOne).toHaveBeenCalledWith(Ticket, expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
  });

  it('garde une trace figée : expéditeur, bénéficiaire, billet, IP et appareil', async () => {
    const { transfer } = await service.gift(input);

    expect(transfer).toMatchObject({
      ticket_reference: 'TKT-2026-000001',
      event_name: 'Concert',
      from_user_id: 'jean',
      from_email: 'jean@example.com',
      from_holder_first_name: 'Jean',
      to_user_id: 'marie',
      to_email: 'marie@example.com',
      to_holder_first_name: 'Paul',
      ip_address: '10.0.0.1',
      user_agent: 'Test/1.0',
    });
  });

  it("refuse le billet d'un autre compte", async () => {
    ticket.buyer_id = 'quelqu-un-d-autre';
    await expect(service.gift(input)).rejects.toMatchObject({ error: { statusCode: 403 } });
  });

  it('refuse de s’offrir son propre billet', async () => {
    await expect(service.gift({ ...input, to_user_id: 'jean' })).rejects.toMatchObject({ error: { statusCode: 400 } });
  });

  it('refuse un billet en revente, utilisé ou annulé', async () => {
    for (const status of [TicketStatus.FOR_RESALE, TicketStatus.USED, TicketStatus.CANCELLED, TicketStatus.REFUNDED]) {
      ticket.status = status;
      await expect(service.gift(input)).rejects.toMatchObject({ error: { statusCode: 409 } });
    }
  });

  it('refuse après la fermeture des transferts (délai réglé par l’admin)', async () => {
    ticket.event_start_at = new Date(Date.now() + 3600_000);
    await expect(service.gift(input)).rejects.toMatchObject({
      error: { message: expect.stringContaining('2 h avant') },
    });
  });

  it('refuse au-delà du nombre maximum de transferts (réglé par l’admin)', async () => {
    previousTransfers = 1;
    await expect(service.gift(input)).rejects.toMatchObject({ error: { message: expect.stringContaining('maximum') } });

    platformConfig.get.mockResolvedValue({ ticket_transfer_max_per_ticket: 3, ticket_transfer_cutoff_hours: 2 });
    await expect(service.gift(input)).resolves.toBeDefined();
  });

  describe('annulation d’un transfert (admin)', () => {
    const revertInput = {
      transfer_id: 'tr-1',
      admin_id: 'admin-1',
      admin_email: 'admin@billetix.local',
      reason: ' Appel de l’acheteur : erreur de destinataire ',
      source: TransferRevertSource.PHONE,
    };

    beforeEach(() => {
      // Le billet est chez le bénéficiaire.
      Object.assign(ticket, { buyer_id: 'marie', buyer_email: 'marie@example.com', holder_first_name: 'Paul', holder_last_name: 'Martin' });
    });

    it('rend le billet à l’expéditeur, au nom d’origine, avec un nouveau jeton', async () => {
      const { ticket: restored, transfer } = await service.revert(revertInput);

      expect(restored).toMatchObject({
        buyer_id: 'jean',
        buyer_email: 'jean@example.com',
        holder_first_name: 'Jean',
        holder_last_name: 'Dupont',
        pdf_url: null,
      });
      expect(restored.qr_code_token).not.toBe('ancien-jeton');
      expect(transfer).toMatchObject({
        status: TicketTransferStatus.REVERTED,
        reverted_by: 'admin-1',
        revert_reason: 'Appel de l’acheteur : erreur de destinataire',
        revert_source: TransferRevertSource.PHONE,
      });
      expect(manager.update).toHaveBeenCalledWith(
        TransferRevertRequest,
        { transfer_id: 'tr-1', status: RevertRequestStatus.PENDING },
        expect.objectContaining({ status: RevertRequestStatus.APPROVED }),
      );
    });

    it('refuse un transfert déjà annulé, un billet revendu depuis, utilisé ou en revente', async () => {
      transferRow.status = TicketTransferStatus.REVERTED;
      await expect(service.revert(revertInput)).rejects.toMatchObject({ error: { message: expect.stringContaining('déjà été annulé') } });
      transferRow.status = TicketTransferStatus.ACTIVE;

      ticket.buyer_id = 'quelqu-un-d-autre';
      await expect(service.revert(revertInput)).rejects.toMatchObject({ error: { message: expect.stringContaining('changé de titulaire') } });
      ticket.buyer_id = 'marie';

      ticket.status = TicketStatus.USED;
      await expect(service.revert(revertInput)).rejects.toMatchObject({ error: { statusCode: 409 } });
      ticket.status = TicketStatus.FOR_RESALE;
      await expect(service.revert(revertInput)).rejects.toMatchObject({ error: { message: expect.stringContaining('revente') } });
    });

    it('refuse une fois l’événement commencé', async () => {
      ticket.event_start_at = new Date(Date.now() - 60_000);
      await expect(service.revert(revertInput)).rejects.toMatchObject({ error: { message: expect.stringContaining('commencé') } });
    });

    it('seul l’expéditeur peut demander l’annulation, une seule demande à la fois', async () => {
      await expect(service.requestRevert({ transfer_id: 'tr-1', user_id: 'marie', reason: 'x' })).rejects.toMatchObject({
        error: { statusCode: 403 },
      });

      const request = await service.requestRevert({ transfer_id: 'tr-1', user_id: 'jean', reason: ' Mauvais destinataire ' });
      expect(request).toMatchObject({ transfer_id: 'tr-1', requested_by: 'jean', reason: 'Mauvais destinataire' });

      requestRepo.findOne.mockResolvedValue({ id: 'req-1', status: RevertRequestStatus.PENDING });
      await expect(service.requestRevert({ transfer_id: 'tr-1', user_id: 'jean', reason: 'encore' })).rejects.toMatchObject({
        error: { message: expect.stringContaining('déjà en cours') },
      });
    });

    it('un transfert annulé ne compte plus dans la limite de transferts', async () => {
      Object.assign(ticket, { buyer_id: 'jean' });
      await service.gift(input);
      expect(manager.count).toHaveBeenCalledWith(TicketTransfer, {
        where: { ticket_id: 'ticket-1', status: expect.anything() },
      });
    });
  });
});
