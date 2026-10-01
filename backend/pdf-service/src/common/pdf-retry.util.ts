import { Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';

const RETRY_COUNT_HEADER = 'x-pdf-retry-count';

/** Republie un message en échec avec un compteur de tentatives, puis abandonne au plafond réglable avec une alerte admin. */
export async function handlePdfGenerationFailure(params: {
  channel: Channel;
  message: ConsumeMessage;
  queue: string;
  maxAttempts: number;
  adminClient: ClientProxy;
  logger: Logger;
  template: string;
  reference: string;
  entityType: 'TICKET' | 'ORDER';
  entityId: string;
  error: unknown;
}): Promise<void> {
  const { channel, message, queue, maxAttempts, adminClient, logger, template, reference, entityType, entityId, error } = params;
  const currentCount = Number(message.properties.headers?.[RETRY_COUNT_HEADER] ?? 0);
  const nextCount = currentCount + 1;
  const errorMessage = (error as Error)?.message ?? 'Erreur inconnue';

  if (nextCount < maxAttempts) {
    logger.warn(
      `Échec génération ${template} ${reference} (tentative ${nextCount}/${maxAttempts}) : ${errorMessage} — nouvelle tentative programmée`,
    );
    channel.sendToQueue(queue, message.content, {
      ...message.properties,
      headers: { ...message.properties.headers, [RETRY_COUNT_HEADER]: nextCount },
      persistent: true,
    });
    channel.ack(message);
    return;
  }

  logger.error(
    `Génération ${template} ${reference} définitivement abandonnée après ${maxAttempts} tentatives : ${errorMessage}`,
  );
  channel.ack(message);

  adminClient
    .send('admin.log_action', {
      action: 'CUSTOM',
      entity_type: entityType,
      entity_id: entityId,
      performed_by: 'system',
      performed_by_email: 'system@billetix.internal',
      reason: `Échec définitif de génération PDF [${template}] ${reference} après ${maxAttempts} tentatives : ${errorMessage}`,
      metadata: { template, reference },
      ip_address: '',
    })
    .subscribe({ error: () => undefined });
}
