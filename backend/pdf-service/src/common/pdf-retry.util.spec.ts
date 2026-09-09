import { Logger } from '@nestjs/common';
import { handlePdfGenerationFailure } from './pdf-retry.util';

describe('handlePdfGenerationFailure', () => {
  let channel: { sendToQueue: jest.Mock; ack: jest.Mock };
  let adminClient: { send: jest.Mock };
  let logger: Logger;

  const message = {
    content: Buffer.from('{"pattern":"pdf.generate_ticket","data":{}}'),
    properties: { headers: {} },
  } as any;

  beforeEach(() => {
    channel = { sendToQueue: jest.fn(), ack: jest.fn() };
    adminClient = { send: jest.fn().mockReturnValue({ subscribe: jest.fn() }) };
    logger = { warn: jest.fn(), error: jest.fn() } as unknown as Logger;
  });

  it('republie le message avec un compteur incrémenté tant que le plafond n\'est pas atteint', async () => {
    await handlePdfGenerationFailure({
      channel: channel as any,
      message: { ...message, properties: { headers: { 'x-pdf-retry-count': 1 } } },
      queue: 'pdf_queue',
      maxAttempts: 5,
      adminClient: adminClient as any,
      logger,
      template: 'billet',
      reference: 'TKT-1',
      entityType: 'TICKET',
      entityId: 'ticket-1',
      error: new Error('Puppeteer indisponible'),
    });

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      'pdf_queue',
      message.content,
      expect.objectContaining({ headers: { 'x-pdf-retry-count': 2 } }),
    );
    expect(channel.ack).toHaveBeenCalled();
    expect(adminClient.send).not.toHaveBeenCalled();
  });

  it('abandonne définitivement et journalise une alerte admin une fois le plafond atteint', async () => {
    await handlePdfGenerationFailure({
      channel: channel as any,
      message: { ...message, properties: { headers: { 'x-pdf-retry-count': 4 } } },
      queue: 'pdf_queue',
      maxAttempts: 5,
      adminClient: adminClient as any,
      logger,
      template: 'facture',
      reference: 'ORD-1',
      entityType: 'ORDER',
      entityId: 'order-1',
      error: new Error('Échec déterministe de rendu'),
    });

    expect(channel.sendToQueue).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalled();
    expect(adminClient.send).toHaveBeenCalledWith(
      'admin.log_action',
      expect.objectContaining({
        action: 'CUSTOM',
        entity_type: 'ORDER',
        entity_id: 'order-1',
      }),
    );
  });

  it('part de 0 si le message n\'a jamais encore été retenté (pas de header)', async () => {
    await handlePdfGenerationFailure({
      channel: channel as any,
      message,
      queue: 'pdf_queue',
      maxAttempts: 5,
      adminClient: adminClient as any,
      logger,
      template: 'billet',
      reference: 'TKT-2',
      entityType: 'TICKET',
      entityId: 'ticket-2',
      error: new Error('Premier échec'),
    });

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      'pdf_queue',
      message.content,
      expect.objectContaining({ headers: { 'x-pdf-retry-count': 1 } }),
    );
  });
});
