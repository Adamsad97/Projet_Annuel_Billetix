import { RpcException } from '@nestjs/microservices';
import { CreateOrganizerProfilePayload, SetStripeAccountPayload, UpdateIbanPayload, UserIdPayload } from './payloads';
import { rpcValidationPipe } from './rpc-validation';

const pipe = rpcValidationPipe();
const ID = '11111111-1111-4111-8111-111111111111';

async function run(metatype: new () => object, value: unknown) {
  return pipe.transform(value, { type: 'body', metatype });
}

describe('Validation des messages internes (user-service)', () => {
  it('refuse un compte mal identifié, en 400', async () => {
    await expect(run(UserIdPayload, { user_id: 'demo-organizer' })).rejects.toBeInstanceOf(RpcException);
  });

  it('valide le formulaire IBAN imbriqué', async () => {
    await expect(run(UpdateIbanPayload, { user_id: ID, dto: { iban: 'pas un iban', bank_owner_name: 'Awa' } })).rejects.toBeInstanceOf(
      RpcException,
    );
    await expect(
      run(UpdateIbanPayload, { user_id: ID, dto: { iban: 'FR7630006000011234567890189', bank_owner_name: 'Awa' } }),
    ).resolves.toMatchObject({ dto: { iban: 'FR7630006000011234567890189' } });
  });

  it("n'accepte qu'un identifiant de compte Stripe Connect", async () => {
    await expect(run(SetStripeAccountPayload, { user_id: ID, account_id: 'acct_1AbCdEfGhIjKlMnO' })).resolves.toBeDefined();
    await expect(run(SetStripeAccountPayload, { user_id: ID, account_id: 'cus_123' })).rejects.toBeInstanceOf(RpcException);
  });

  it('conserve présentation, logo et site web à la création du profil organisateur', async () => {
    const dto = {
      display_name: 'Les Nuits de Paris',
      description: 'Collectif',
      logo_url: 'http://localhost:9000/avatars/logo.png',
      website_url: 'https://www.exemple.fr',
    };
    await expect(run(CreateOrganizerProfilePayload, { user_id: ID, dto })).resolves.toMatchObject({ dto });
  });
});
