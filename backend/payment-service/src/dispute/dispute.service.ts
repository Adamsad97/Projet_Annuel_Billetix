import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayoutService } from '../payout/payout.service';
import { Dispute, DisputeStatus, DisputeReason } from './dispute.entity';

@Injectable()
export class DisputeService {
  constructor(
    @InjectRepository(Dispute) private readonly repo: Repository<Dispute>,
    private readonly payoutService: PayoutService,
  ) {}

  async create(data: {
    payment_id: string;
    order_id: string;
    buyer_id: string;
    reason: DisputeReason;
    description?: string;
    stripe_dispute_id?: string;
  }): Promise<Dispute> {
    const dispute = await this.repo.save(this.repo.create(data));

    // CDC §7.2 : « litige en cours → fonds bloqués jusqu'à résolution ».
    // Blocage automatique du reversement de la commande concernée — pas
    // d'action manuelle admin requise à l'ouverture du litige.
    await this.payoutService.blockByOrder(
      data.order_id,
      `Litige ouvert (#${dispute.id})`,
    );

    return dispute;
  }

  async getById(id: string): Promise<Dispute> {
    const foundDispute = await this.repo.findOne({ where: { id } });
    if (!foundDispute) throw new RpcException({ statusCode: 404, message: 'Litige introuvable' });
    return foundDispute;
  }

  async getAll(): Promise<Dispute[]> {
    return this.repo.find({ order: { created_at: 'DESC' } });
  }

  /** Litiges "ouverts" = pas encore tranchés (OPEN ou UNDER_REVIEW) — base des alertes admin. */
  async getOpenCount(): Promise<number> {
    return this.repo.count({
      where: [
        { status: DisputeStatus.OPEN },
        { status: DisputeStatus.UNDER_REVIEW },
      ],
    });
  }

  async getByOrder(orderId: string): Promise<Dispute[]> {
    return this.repo.find({ where: { order_id: orderId }, order: { created_at: 'DESC' } });
  }

  async getByBuyer(buyerId: string): Promise<Dispute[]> {
    return this.repo.find({ where: { buyer_id: buyerId }, order: { created_at: 'DESC' } });
  }

  async updateStatus(id: string, status: DisputeStatus): Promise<Dispute> {
    const dispute = await this.getById(id);
    dispute.status = status;
    return this.repo.save(dispute);
  }

  async resolve(id: string, data: {
    status: DisputeStatus.WON | DisputeStatus.LOST | DisputeStatus.CLOSED;
    resolved_by: string;
    resolution_notes?: string;
  }): Promise<Dispute> {
    const dispute = await this.getById(id);
    if (dispute.status === DisputeStatus.WON || dispute.status === DisputeStatus.LOST) {
      throw new RpcException({ statusCode: 400, message: 'Litige déjà résolu' });
    }
    dispute.status = data.status;
    dispute.resolved_by = data.resolved_by;
    dispute.resolved_at = new Date();
    dispute.resolution_notes = data.resolution_notes ?? null;
    const saved = await this.repo.save(dispute);

    // Litige tranché : débloque le reversement s'il l'était encore
    // (sinon il reste bloqué au maximum dispute_payout_block_max_days,
    // cf. PayoutSchedulerService.unblockExpiredDisputePayouts).
    await this.payoutService.unblockByOrder(dispute.order_id);

    return saved;
  }
}
