import { Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';

const RETRY_COUNT_HEADER = 'x-pdf-retry-count';

/**
 * Bug corrigé : channel.nack(msg, false, true) remettait un message en
 * échec en tête de file INCHANGÉ, donc INDÉFINIMENT tant que l'échec
 * persistait — pas seulement pour une panne transitoire (Puppeteer,
 * MinIO), mais aussi pour un échec déterministe (ex: rendu qui plante
 * systématiquement sur un poster_url précis), bloquant le message et une
 * partie des créneaux de prefetch pour toujours, sans qu'aucun admin ne
 * le sache jamais (le billet/la facture restait sans PDF indéfiniment).
 *
 * Republie désormais le message avec un compteur de tentatives dans les
 * headers (channel.nack ne permet pas de modifier les headers du message
 * remis en file, d'où republication + ack de l'original) jusqu'au plafond
 * configurable (pdf_generation_max_retry_attempts), puis abandonne
 * définitivement et journalise une alerte admin réelle et consultable —
 * même principe que l'épuisement des tentatives d'envoi d'email
 * (MailService), pas seulement un log qui disparaît dans les conteneurs.
 */
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
