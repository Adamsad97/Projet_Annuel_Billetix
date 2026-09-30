import type Stripe from 'stripe';
import { connectAccountStatus } from './connect-status';

const account = (overrides: Partial<Stripe.Account>): Stripe.Account =>
  ({
    id: 'acct_1',
    object: 'account',
    details_submitted: true,
    payouts_enabled: true,
    charges_enabled: false,
    capabilities: { transfers: 'active' },
    requirements: { currently_due: [] },
    external_accounts: { object: 'list', data: [{ object: 'bank_account', bank_name: 'BNP', last4: '6789' }] },
    ...overrides,
  }) as unknown as Stripe.Account;

describe('connectAccountStatus', () => {
  it('prêt pour un compte « transferts » complet, même sans encaissement autorisé', () => {
    expect(connectAccountStatus(account({}))).toEqual({
      details_submitted: true,
      payouts_enabled: true,
      onboarded: true,
      requirements_due: 0,
      bank: { bank_name: 'BNP', last4: '6789' },
    });
  });

  it("pas prêt tant que le formulaire n'est pas complété", () => {
    const status = connectAccountStatus(
      account({ details_submitted: false, requirements: { currently_due: ['external_account', 'individual.dob.day'] } as never }),
    );
    expect(status.onboarded).toBe(false);
    expect(status.requirements_due).toBe(2);
  });

  it('pas prêt si les virements ou les transferts ne sont pas actifs', () => {
    expect(connectAccountStatus(account({ payouts_enabled: false })).onboarded).toBe(false);
    expect(connectAccountStatus(account({ capabilities: { transfers: 'pending' } as never })).onboarded).toBe(false);
  });

  it('sans compte bancaire déclaré', () => {
    expect(connectAccountStatus(account({ external_accounts: undefined })).bank).toBeNull();
  });
});
