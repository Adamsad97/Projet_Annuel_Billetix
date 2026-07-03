import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ValidationRequest } from './validation-request.entity';

@Injectable()
export class ValidationRequestService {
  constructor(
    @InjectRepository(ValidationRequest)
    private readonly repo: Repository<ValidationRequest>,
  ) {}

  async create(eventId: string, adminId: string, message: string): Promise<ValidationRequest> {
    const req = this.repo.create({ event_id: eventId, admin_id: adminId, message });
    return this.repo.save(req);
  }

  async getByEvent(eventId: string): Promise<ValidationRequest[]> {
    return this.repo.find({ where: { event_id: eventId }, order: { created_at: 'DESC' } });
  }

  async respond(id: string, response: string): Promise<ValidationRequest> {
    const req = await this.repo.findOne({ where: { id } });
    if (!req) throw new RpcException({ statusCode: 404, message: 'Demande introuvable' });
    req.response = response;
    req.responded_at = new Date();
    return this.repo.save(req);
  }
}
