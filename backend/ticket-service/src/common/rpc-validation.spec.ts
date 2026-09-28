import { RpcException } from '@nestjs/microservices';
import { GenerateTicketsPayload, GiftTicketPayload, IdPayload } from './payloads';
import { rpcValidationPipe } from './rpc-validation';

const pipe = rpcValidationPipe();
const ID = '11111111-1111-4111-8111-111111111111';

async function run(metatype: new () => object, value: unknown) {
  return pipe.transform(value, { type: 'body', metatype });
}

describe('Validation des messages internes (ticket-service)', () => {
  it('refuse un identifiant de billet mal formé, en 400', async () => {
    await expect(run(IdPayload, { id: 'TKT-2026-ABC' })).rejects.toBeInstanceOf(RpcException);
  });

  it('accepte une génération de billets telle qu’order-service l’envoie (prix décimaux en texte, champs nuls)', async () => {
    const payload = await run(GenerateTicketsPayload, {
      order_id: ID, buyer_id: ID, buyer_email: 'acheteur@example.com', buyer_first_name: 'Flow', buyer_last_name: 'Diane',
      event_id: ID, event_name: 'Concert', event_start_at: '2028-01-01T18:00:00.000Z', event_end_at: null,
      event_venue_name: 'Salle', event_venue_address: '1 rue', event_city: 'Paris', event_poster_url: null,
      artist_name: 'Artiste', artist_description: null,
      items: [{ id: ID, order_item_id: ID, ticket_category_id: ID, ticket_category_name: 'Standard', unit_price_ttc: '12.00', quantity: 2 }],
    }) as GenerateTicketsPayload;
    expect(payload.items[0].unit_price_ttc).toBe(12);
    // Champ en trop (id de l'OrderItem) retiré sans refus.
    expect(payload.items[0]).not.toHaveProperty('id');
  });

  it('refuse un don vers une adresse email invalide', async () => {
    await expect(
      run(GiftTicketPayload, {
        ticket_id: ID, from_user_id: ID, from_first_name: 'A', from_last_name: 'B', to_user_id: ID,
        to_email: 'pas-un-email', to_holder_first_name: 'C', to_holder_last_name: 'D',
      }),
    ).rejects.toBeInstanceOf(RpcException);
  });
});
