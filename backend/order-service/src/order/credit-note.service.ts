import { Injectable, OnModuleInit } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreditNote } from './credit-note.entity';
import { Order } from './order.entity';

// Numérotation continue des avoirs (obligation comptable : pas de trou).
const SEQUENCE = 'orders.credit_note_seq';

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Avoirs des commandes remboursées. Montant HT et TVA calculés au
 * prorata de la facture d'origine ; le total des avoirs d'une commande ne
 * dépasse jamais son montant facturé.
 */
@Injectable()
export class CreditNoteService implements OnModuleInit {
  constructor(
    @InjectRepository(CreditNote) private readonly notes: Repository<CreditNote>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.dataSource.query(`CREATE SEQUENCE IF NOT EXISTS ${SEQUENCE}`);
  }

  /**
   * Émet l'avoir d'un remboursement. amountTtc absent : solde non encore
   * couvert par un avoir (remboursement total). null si rien à émettre :
   * commande gratuite (sans facture) ou déjà entièrement couverte.
   */
  async issue(
    orderId: string,
    amountTtc: number | undefined,
    reason: string,
  ): Promise<{ credit_note: CreditNote; order: Order } | null> {
    return this.dataSource.transaction(async (manager) => {
      // Verrou sur la commande : deux remboursements simultanés ne peuvent
      // pas couvrir deux fois le même montant.
      const order = await manager
        .getRepository(Order)
        .createQueryBuilder('o')
        .setLock('pessimistic_write')
        .where('o.id = :orderId', { orderId })
        .getOne();
      if (!order) throw new RpcException({ statusCode: 404, message: 'Commande introuvable' });

      const invoiced = Number(order.total_amount_ttc);
      if (invoiced <= 0) return null;

      const { credited } = await manager
        .getRepository(CreditNote)
        .createQueryBuilder('n')
        .select('COALESCE(SUM(n.amount_ttc), 0)', 'credited')
        .where('n.order_id = :orderId', { orderId })
        .getRawOne<{ credited: string }>() ?? { credited: '0' };
      const remaining = round(invoiced - Number(credited));
      const amount = round(Math.min(amountTtc ?? remaining, remaining));
      if (amount <= 0) return null;

      // Frais des billets gratuits : à la charge de l'organisateur, jamais
      // facturés à l'acheteur, donc absents de sa facture comme de ses avoirs.
      const ratio = amount / invoiced;
      const amountHt = round(Number(order.total_amount_ht) * ratio);
      const fees = 0;
      const tva = round(amount - amountHt);

      const [{ nextval }] = await manager.query(`SELECT nextval('${SEQUENCE}') AS nextval`);
      const number = `AV-${new Date().getFullYear()}-${String(nextval).padStart(5, '0')}`;

      const creditNote = await manager.getRepository(CreditNote).save(
        manager.getRepository(CreditNote).create({
          number,
          order_id: orderId,
          amount_ht: amountHt,
          tva_amount: tva,
          fees_amount: fees,
          amount_ttc: amount,
          reason: reason.trim() || 'Remboursement',
        }),
      );
      return { credit_note: creditNote, order };
    });
  }

  listByOrder(orderId: string): Promise<CreditNote[]> {
    return this.notes.find({ where: { order_id: orderId }, order: { created_at: 'ASC' } });
  }

  async get(id: string): Promise<CreditNote> {
    const note = await this.notes.findOne({ where: { id } });
    if (!note) throw new RpcException({ statusCode: 404, message: 'Avoir introuvable' });
    return note;
  }

  async setPdfUrl(id: string, url: string): Promise<CreditNote> {
    await this.notes.update(id, { pdf_url: url });
    return this.get(id);
  }
}
