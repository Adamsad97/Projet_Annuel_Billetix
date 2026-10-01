import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
    // Contestation bancaire déjà reçue (webhook rejoué) : rien de nouveau.
    if (data.stripe_dispute_id) {
      const known = await this.repo.findOne({ where: { stripe_dispute_id: data.stripe_dispute_id } });
      if (known) return known;
    }
    // Un seul litige actif par commande ; une contestation bancaire sur une
    // commande déjà en litige est rattachée à ce litige.
    const active = await this.repo.findOne({
      where: { order_id: data.order_id, status: In([DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW]) },
    });
    if (active) {
      if (data.stripe_dispute_id) {
        active.stripe_dispute_id = data.stripe_dispute_id;
        return this.repo.save(active);
      }
      throw new RpcException({ statusCode: 409, message: 'Un litige est déjà en cours pour cette commande.' });
    }

    const dispute = await this.repo.save(this.repo.create(data));

    // CDC §7.2 : bloque automatiquement le reversement de la commande à l'ouverture d'un litige.
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

  /** Un admin prend le litige en charge : ouvert → en cours d'examen. */
  async startReview(id: string): Promise<Dispute> {
    const dispute = await this.getById(id);
    if (dispute.status !== DisputeStatus.OPEN) {
      throw new RpcException({ statusCode: 400, message: "Ce litige n'est plus en attente de prise en charge." });
    }
    dispute.status = DisputeStatus.UNDER_REVIEW;
    return this.repo.save(dispute);
  }

  /** Contestation clôturée par la banque : gagnée, les fonds restent acquis ; perdue, ils sont repris. */
  async closeFromStripe(stripeDisputeId: string, won: boolean): Promise<Dispute | null> {
    const dispute = await this.repo.findOne({ where: { stripe_dispute_id: stripeDisputeId } });
    if (!dispute) return null;
    if (dispute.status === DisputeStatus.WON || dispute.status === DisputeStatus.LOST) return dispute;
    dispute.status = won ? DisputeStatus.WON : DisputeStatus.LOST;
    dispute.resolved_at = new Date();
    dispute.resolution_notes = won
      ? 'Contestation bancaire rejetée par la banque : le paiement reste acquis.'
      : 'Contestation bancaire acceptée par la banque : le montant a été repris au vendeur.';
    const saved = await this.repo.save(dispute);
    await this.payoutService.unblockByOrder(dispute.order_id);
    return saved;
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

    // Litige tranché : débloque le reversement s'il l'était encore.
    await this.payoutService.unblockByOrder(dispute.order_id);

    return saved;
  }
}
