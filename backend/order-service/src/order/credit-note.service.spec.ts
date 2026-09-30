import { CreditNoteService } from './credit-note.service';

describe('CreditNoteService — avoirs', () => {
  let order: Record<string, unknown> | null;
  let credited: string;
  let sequence: number;
  let saved: Array<Record<string, unknown>>;
  let service: CreditNoteService;

  beforeEach(() => {
    order = { id: 'order-1', total_amount_ttc: '120.00', total_amount_ht: '98.00', free_ticket_fees: '2.40' };
    credited = '0';
    sequence = 41;
    saved = [];
    const orderQuery = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(async () => order),
    };
    const noteQuery = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(async () => ({ credited })),
    };
    const manager = {
      getRepository: jest.fn((entity: { name: string }) =>
        entity.name === 'Order'
          ? { createQueryBuilder: () => orderQuery }
          : {
              createQueryBuilder: () => noteQuery,
              create: (value: Record<string, unknown>) => value,
              save: async (value: Record<string, unknown>) => {
                saved.push(value);
                return { id: 'note-1', ...value };
              },
            },
      ),
      query: jest.fn(async () => [{ nextval: String(++sequence) }]),
    };
    const dataSource = { transaction: jest.fn(async (work: (m: typeof manager) => unknown) => work(manager)), query: jest.fn() };
    service = new CreditNoteService({} as never, dataSource as never);
  });

  it('remboursement total : avoir du montant facturé, HT, TVA et frais au prorata, numéro continu', async () => {
    const result = await service.issue('order-1', undefined, 'Événement annulé');
    expect(result?.credit_note).toMatchObject({
      number: `AV-${new Date().getFullYear()}-00042`,
      amount_ttc: 120,
      amount_ht: 98,
      fees_amount: 2.4,
      tva_amount: 19.6,
      reason: 'Événement annulé',
    });
  });

  it('remboursement partiel : prorata du montant remboursé', async () => {
    const result = await service.issue('order-1', 30, 'Billet revendu');
    expect(result?.credit_note).toMatchObject({ amount_ttc: 30, amount_ht: 24.5, fees_amount: 0.6, tva_amount: 4.9 });
  });

  it('ne couvre jamais plus que le montant facturé restant', async () => {
    credited = '100.00';
    const result = await service.issue('order-1', 50, 'Remboursement admin');
    expect(result?.credit_note.amount_ttc).toBe(20);
  });

  it('commande déjà entièrement couverte : aucun avoir (remboursement rejoué)', async () => {
    credited = '120.00';
    await expect(service.issue('order-1', undefined, 'x')).resolves.toBeNull();
    expect(saved).toHaveLength(0);
  });

  it('réservation gratuite (sans facture) : aucun avoir', async () => {
    order = { id: 'order-1', total_amount_ttc: '0.00', total_amount_ht: '0.00', free_ticket_fees: '0' };
    await expect(service.issue('order-1', undefined, 'x')).resolves.toBeNull();
  });
});
