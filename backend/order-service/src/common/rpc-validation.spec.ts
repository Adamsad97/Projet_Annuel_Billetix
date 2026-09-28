import { RpcException } from '@nestjs/microservices';
import { ReserveStockDto } from '../order/dto/create-order.dto';
import { ConfirmPaymentPayload, IdPayload } from '../order/dto/order-payloads';
import { rpcValidationPipe } from './rpc-validation';

const pipe = rpcValidationPipe();
const ID = '11111111-1111-4111-8111-111111111111';

async function run(metatype: new () => object, value: unknown) {
  return pipe.transform(value, { type: 'body', metatype });
}

async function rpcError(metatype: new () => object, value: unknown): Promise<{ statusCode: number; message: string[] }> {
  try {
    await run(metatype, value);
  } catch (error) {
    expect(error).toBeInstanceOf(RpcException);
    return (error as RpcException).getError() as { statusCode: number; message: string[] };
  }
  throw new Error('aucune erreur levée');
}

describe('Validation des messages internes (order-service)', () => {
  it('renvoie une erreur 400 en français pour un identifiant invalide', async () => {
    const error = await rpcError(IdPayload, { id: 'ORD-2026-X' });
    expect(error).toEqual({ statusCode: 400, message: ['Le champ « id » doit être un identifiant valide.'] });
  });

  it('valide chaque ligne de réservation', async () => {
    const error = await rpcError(ReserveStockDto, {
      buyer_id: ID,
      event_id: ID,
      items: [{ ticket_category_id: ID, quantity: 0 }],
    });
    expect(error.message.join(' ')).toMatch(/items\.0\.quantity/);
  });

  it('accepte une commande gratuite (identifiant de paiement vide, frais nuls)', async () => {
    await expect(run(ConfirmPaymentPayload, { id: ID, payment_intent_id: '', fees: 0 })).resolves.toEqual({
      id: ID,
      payment_intent_id: '',
      fees: 0,
    });
  });
});
