import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StripeService } from '../stripe/stripe.service';
import { Payout, PayoutStatus } from './payout.entity';

const PAYOUT_DELAY_DAYS = 7;

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
  }): Promise<Payout> {
    const net = data.gross_amount - data.commission_amount - data.payment_fees_amount;
    const scheduled = new Date();
    scheduled.setDate(scheduled.getDate() + PAYOUT_DELAY_DAYS);

    return this.repo.save(
      this.repo.create({
        ...data,
        net_amount: parseFloat(net.toFixed(2)),
        scheduled_at: scheduled,
      }),
    );
  }

  async getById(id: string): Promise<Payout> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new RpcException({ statusCode: 404, message: 'Reversement introuvable' });
    return p;
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
