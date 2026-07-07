import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { StripeService } from '../stripe/stripe.service';
import { Payout, PayoutStatus } from './payout.entity';

@Injectable()
export class PayoutService {
  constructor(
    @InjectRepository(Payout) private readonly repo: Repository<Payout>,
    private readonly stripe: StripeService,
    private readonly platformConfig: PlatformConfigCache,
  ) {}

  async create(data: {
    organizer_id: string;
    event_id: string;
    order_id?: string;
    gross_amount: number;
    commission_amount: number;
    payment_fees_amount: number;
    event_end_at?: string;
  }): Promise<Payout> {
    const config = await this.platformConfig.get();
    const net = data.gross_amount - data.commission_amount - data.payment_fees_amount;

    const base = data.event_end_at ? new Date(data.event_end_at) : new Date();
    const scheduled = new Date(base);
    scheduled.setDate(scheduled.getDate() + config.payout_delay_days);

    return this.repo.save(
      this.repo.create({
        organizer_id: data.organizer_id,
        event_id: data.event_id,
        order_id: data.order_id ?? null,
        gross_amount: data.gross_amount,
        commission_amount: data.commission_amount,
        payment_fees_amount: data.payment_fees_amount,
        net_amount: parseFloat(net.toFixed(2)),
        scheduled_at: scheduled,
      }),
    );
  }

  /**
   * Recalcule le reversement d'une commande après remboursement (total ou
   * partiel). Si le payout n'a pas encore été versé (PENDING/BLOCKED), son
   * montant est directement réduit au prorata du remboursement. S'il est
   * déjà en cours ou versé (PROCESSING/COMPLETED), impossible de le modifier
   * rétroactivement — un virement Stripe déjà émis ne peut pas être annulé
   * localement — donc un ajustement compensatoire séparé (montant négatif)
   * est créé à la place, à récupérer sur un prochain cycle de reversement.
   */
  async recalculateForRefund(
    orderId: string,
    refundedAmount: number,
    originalPaymentAmount: number,
  ): Promise<void> {
    const payout = await this.repo.findOne({ where: { order_id: orderId } });
    if (!payout || originalPaymentAmount <= 0) return;

    const refundRatio = Math.min(refundedAmount / originalPaymentAmount, 1);

    if (
      payout.status === PayoutStatus.PENDING ||
      payout.status === PayoutStatus.BLOCKED
    ) {
      const newGross = parseFloat(
        (Number(payout.gross_amount) * (1 - refundRatio)).toFixed(2),
      );
      const newCommission = parseFloat(
        (Number(payout.commission_amount) * (1 - refundRatio)).toFixed(2),
      );
      payout.gross_amount = newGross;
      payout.commission_amount = newCommission;
      payout.net_amount = parseFloat(
        (newGross - newCommission - Number(payout.payment_fees_amount)).toFixed(2),
      );
      await this.repo.save(payout);
      return;
    }

    // PROCESSING ou COMPLETED — ajustement compensatoire séparé
    const adjustmentGross = parseFloat(
      (Number(payout.gross_amount) * refundRatio * -1).toFixed(2),
    );
    const adjustmentCommission = parseFloat(
      (Number(payout.commission_amount) * refundRatio * -1).toFixed(2),
    );
    const adjustmentNet = parseFloat(
      (adjustmentGross - adjustmentCommission).toFixed(2),
    );

    await this.repo.save(
      this.repo.create({
        organizer_id: payout.organizer_id,
        event_id: payout.event_id,
        order_id: orderId,
        gross_amount: adjustmentGross,
        commission_amount: adjustmentCommission,
        payment_fees_amount: 0,
        net_amount: adjustmentNet,
        status: PayoutStatus.PENDING,
        scheduled_at: new Date(),
      }),
    );
  }

  async getOrganizerBalance(organizerId: string): Promise<{
    pending_balance: number;
    total_earned: number;
    payouts_count: number;
  }> {
    const payouts = await this.repo.find({ where: { organizer_id: organizerId } });
    const pending_balance = payouts
      .filter((payout) => payout.status === PayoutStatus.PENDING || payout.status === PayoutStatus.PROCESSING)
      .reduce((sum, payout) => sum + Number(payout.net_amount), 0);
    const total_earned = payouts
      .filter((payout) => payout.status === PayoutStatus.COMPLETED)
      .reduce((sum, payout) => sum + Number(payout.net_amount), 0);
    return {
      pending_balance: parseFloat(pending_balance.toFixed(2)),
      total_earned: parseFloat(total_earned.toFixed(2)),
      payouts_count: payouts.length,
    };
  }

  /** Solde en attente toute la plateforme — agrégat SQL (pas de find()+reduce, volume potentiellement important). */
  async getPlatformBalance(): Promise<{
    pending_balance: number;
    total_paid_out: number;
  }> {
    const row = await this.repo
      .createQueryBuilder('p')
      .select(
        "COALESCE(SUM(p.net_amount) FILTER (WHERE p.status IN ('PENDING', 'PROCESSING')), 0)",
        'pending_balance',
      )
      .addSelect(
        "COALESCE(SUM(p.net_amount) FILTER (WHERE p.status = 'COMPLETED'), 0)",
        'total_paid_out',
      )
      .getRawOne<Record<string, string>>();

    return {
      pending_balance: parseFloat(row?.pending_balance ?? '0'),
      total_paid_out: parseFloat(row?.total_paid_out ?? '0'),
    };
  }

  async getById(id: string): Promise<Payout> {
    const foundPayout = await this.repo.findOne({ where: { id } });
    if (!foundPayout) throw new RpcException({ statusCode: 404, message: 'Reversement introuvable' });
    return foundPayout;
  }

  async getByOrganizer(organizerId: string): Promise<Payout[]> {
    return this.repo.find({ where: { organizer_id: organizerId }, order: { scheduled_at: 'DESC' } });
  }

  async getDuePayouts(): Promise<Payout[]> {
    // net_amount > 0 uniquement : un virement Stripe ne peut pas être négatif
    // ou nul. Les ajustements négatifs créés par recalculateForRefund() (sur
    // un payout déjà versé) restent PENDING mais ne sont jamais transférés
    // automatiquement — ils doivent être récupérés sur un futur reversement
    // positif du même organisateur, ou réconciliés manuellement par un admin.
    return this.repo
      .createQueryBuilder('payout')
      .where('payout.status = :status', { status: PayoutStatus.PENDING })
      .andWhere('payout.scheduled_at <= :now', { now: new Date() })
      .andWhere('payout.net_amount > 0')
      .getMany();
  }

  async process(id: string, stripeAccountId: string): Promise<Payout> {
    const payout = await this.getById(id);
    if (payout.status !== PayoutStatus.PENDING) {
      throw new RpcException({ statusCode: 400, message: 'Reversement non éligible au traitement' });
    }

    payout.status = PayoutStatus.PROCESSING;
    await this.repo.save(payout);

    try {
      const transfer = await this.stripe.createTransfer({
        amount_cents: Math.round(Number(payout.net_amount) * 100),
        stripe_account_id: stripeAccountId,
        order_id: payout.event_id,
      });
      payout.stripe_transfer_id = transfer.id;
      payout.status = PayoutStatus.COMPLETED;
      payout.processed_at = new Date();
    } catch {
      payout.status = PayoutStatus.FAILED;
    }

    return this.repo.save(payout);
  }

  async block(id: string, adminId: string, reason: string): Promise<Payout> {
    const payout = await this.getById(id);
    payout.status = PayoutStatus.BLOCKED;
    payout.blocked_at = new Date();
    payout.blocked_by = adminId;
    payout.blocked_reason = reason;
    return this.repo.save(payout);
  }

  async requestEarly(id: string, organizerId: string): Promise<Payout> {
    const payout = await this.getById(id);
    if (payout.organizer_id !== organizerId) {
      throw new RpcException({ statusCode: 403, message: 'Non autorisé' });
    }
    payout.requested_early_at = new Date();
    return this.repo.save(payout);
  }

  async approveEarly(id: string, adminId: string): Promise<Payout> {
    const payout = await this.getById(id);
    payout.early_request_approved_by = adminId;
    payout.scheduled_at = new Date();
    return this.repo.save(payout);
  }
}
