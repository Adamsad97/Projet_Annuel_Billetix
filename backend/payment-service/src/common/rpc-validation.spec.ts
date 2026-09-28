import { RpcException } from '@nestjs/microservices';
import { BlockPayoutPayload, PaypalWebhookPayload, RefundPayload } from './payloads';
import { rpcValidationPipe } from './rpc-validation';

const pipe = rpcValidationPipe();
const ID = '11111111-1111-4111-8111-111111111111';

async function run(metatype: new () => object, value: unknown) {
  return pipe.transform(value, { type: 'body', metatype });
}

describe('Validation des messages internes (payment-service)', () => {
  it('refuse un remboursement sur une commande mal identifiée, avec une erreur 400', async () => {
    await expect(run(RefundPayload, { order_id: 'x' })).rejects.toBeInstanceOf(RpcException);
  });

  it('refuse un remboursement partiel nul ou négatif', async () => {
    await expect(run(RefundPayload, { order_id: ID, amount_cents: 0 })).rejects.toBeInstanceOf(RpcException);
  });

  it('exige un motif pour bloquer un reversement', async () => {
    await expect(run(BlockPayoutPayload, { id: ID, admin_id: ID })).rejects.toBeInstanceOf(RpcException);
  });

  it('transmet le corps brut d\'un webhook sans le modifier (signature intacte)', async () => {
    const raw = '{"event_type":"PAYMENT.CAPTURE.COMPLETED", "resource": {"id":"X"} }';
    const headers = { 'paypal-transmission-id': 'abc', 'PAYPAL-AUTH-ALGO': 'SHA256withRSA' };
    await expect(run(PaypalWebhookPayload, { payload: raw, headers })).resolves.toEqual({ payload: raw, headers });
  });
});
