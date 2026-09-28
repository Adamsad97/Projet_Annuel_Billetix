import 'reflect-metadata';
import { InvoicePdfDto } from '../pdf/dto/invoice-pdf.dto';
import { validatePayload } from './validate-payload.util';

const valid = {
  order_id: '11111111-1111-4111-8111-111111111111',
  reference: 'ORD-2026-ABCDE',
  paid_at: '2026-09-28T10:00:00.000Z',
  tva_rate: 0.2,
  billing_first_name: 'Awa', billing_last_name: 'Diallo', billing_email: 'awa@example.com',
  billing_address_line1: '1 rue Test', billing_address_line2: null, billing_city: 'Paris', billing_postal_code: '75001', billing_country: 'France',
  items: [{ ticket_category_name: 'Standard', quantity: 2, unit_price_ht: 10, unit_price_ttc: 12, total_price_ht: 20, total_price_ttc: 24 }],
  total_amount_ht: 20, total_amount_ttc: 24, discount_amount: 0, free_ticket_fees: 0,
  platform_legal_name: 'BilleTix SAS', platform_siret: '000', platform_vat_number: 'FR00', platform_address: 'Paris',
};

describe('validatePayload (facture)', () => {
  it('accepte une facture telle que la passerelle l’envoie', async () => {
    await expect(validatePayload(InvoicePdfDto, valid)).resolves.toMatchObject({ valid: true });
  });

  it('indique le champ fautif, y compris dans une ligne de facture', async () => {
    const result = await validatePayload(InvoicePdfDto, { ...valid, items: [{ ...valid.items[0], quantity: 0 }] });
    expect(result.valid).toBe(false);
    expect(result.valid === false && result.message).toMatch(/items\.0\.quantity/);
  });

  it('refuse une facture sans ligne ou avec un montant négatif', async () => {
    await expect(validatePayload(InvoicePdfDto, { ...valid, items: [] })).resolves.toMatchObject({ valid: false });
    await expect(validatePayload(InvoicePdfDto, { ...valid, total_amount_ttc: -1 })).resolves.toMatchObject({ valid: false });
  });
});
