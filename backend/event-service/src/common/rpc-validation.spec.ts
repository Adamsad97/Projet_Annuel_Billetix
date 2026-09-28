import { RpcException } from '@nestjs/microservices';
import { CreateTicketCategoryPayload } from './module-payloads';
import { IdPayload, QuantityPayload } from './payloads';
import { rpcValidationPipe } from './rpc-validation';

const pipe = rpcValidationPipe();
const EVENT_ID = '11111111-1111-4111-8111-111111111111';

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

describe('Validation des messages internes', () => {
  it('renvoie une erreur 400 (et non 500) avec un message en français', async () => {
    const error = await rpcError(IdPayload, { id: 'pas-un-uuid' });
    expect(error.statusCode).toBe(400);
    expect(error.message).toEqual(['Le champ « id » doit être un identifiant valide.']);
  });

  it('retire les champs inconnus sans refuser le message', async () => {
    await expect(run(IdPayload, { id: EVENT_ID, contexte: 'en trop' })).resolves.toEqual({ id: EVENT_ID });
  });

  it('valide les objets imbriqués (dto)', async () => {
    const error = await rpcError(CreateTicketCategoryPayload, {
      organizer_id: EVENT_ID,
      dto: { event_id: EVENT_ID, name: 'Standard', price_ht: -5, quota: 10 },
    });
    expect(error.message.join(' ')).toMatch(/dto\.price_ht/);
  });

  it('borne les quantités', async () => {
    const error = await rpcError(QuantityPayload, { id: EVENT_ID, quantity: 0 });
    expect(error.message).toEqual(['Le champ « quantity » est trop petit.']);
  });
});
