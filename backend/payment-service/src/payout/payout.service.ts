import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StripeService } from '../stripe/stripe.service';
import { Payout, PayoutStatus } from './payout.entity';

const PAYOUT_DELAY_DAYS = 3; // D+3 après la fin de l'événement

@Injectable()
export class PayoutService {
  constructor(
    @InjectRepository(Payout) private readonly repo: Repository<Payout>,
    private readonly stripe: StripeService,
  ) {}

  async create(data: {
    organizer_id: string;
    event_id: string;
    gross_amount: number;
    commission_amount: number;
    payment_fees_amount: number;
    event_end_at?: string;
  }): Promise<Payout> {
    const net = data.gross_amount - data.commission_amount - data.payment_fees_amount;

    // D+3 calculé depuis la fin de l'événement ; si inconnue, depuis maintenant
    const base = data.event_end_at ? new Date(data.event_end_at) : new Date();
    const scheduled = new Date(base);
    scheduled.setDate(scheduled.getDate() + PAYOUT_DELAY_DAYS);

    return this.repo.save(
      this.repo.create({
        organizer_id: data.organizer_id,
        event_id: data.event_id,
        gross_amount: data.gross_amount,
        commission_amount: data.commission_amount,
        payment_fees_amount: data.payment_fees_amount,
        net_amount: parseFloat(net.toFixed(2)),
        scheduled_at: scheduled,
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

  async getById(id: string): Promise<Payout> {
    const foundPayout = await this.repo.findOne({ where: { id } });
    if (!foundPayout) throw new RpcException({ statusCode: 404, message: 'Reversement introuvable' });
    return foundPayout;
  }

  async getByOrganizer(organizerId: string): Promise<Payout[]> {
    return this.repo.find({ where: { organizer_id: organizerId }, order: { scheduled_at: 'DESC' } });
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
