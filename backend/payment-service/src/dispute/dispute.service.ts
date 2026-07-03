import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute, DisputeStatus, DisputeReason } from './dispute.entity';

@Injectable()
export class DisputeService {
  constructor(
    @InjectRepository(Dispute) private readonly repo: Repository<Dispute>,
  ) {}

  async create(data: {
    payment_id: string;
    order_id: string;
    buyer_id: string;
    reason: DisputeReason;
    description?: string;
    stripe_dispute_id?: string;
  }): Promise<Dispute> {
    return this.repo.save(this.repo.create(data));
  }

  async getById(id: string): Promise<Dispute> {
    const foundDispute = await this.repo.findOne({ where: { id } });
    if (!foundDispute) throw new RpcException({ statusCode: 404, message: 'Litige introuvable' });
    return foundDispute;
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
    return this.repo.save(dispute);
  }
}
