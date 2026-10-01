import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ControlAgent } from './control-agent.entity';

@Injectable()
export class ControlAgentService {
  constructor(
    @InjectRepository(ControlAgent) private readonly repo: Repository<ControlAgent>,
  ) {}

  async assign(data: {
    user_id: string;
    event_id: string;
    assigned_by: string;
    is_supervisor?: boolean;
  }): Promise<ControlAgent> {
    const existing = await this.repo.findOne({
      where: { user_id: data.user_id, event_id: data.event_id },
    });
    if (existing) {
      throw new RpcException({ statusCode: 409, message: 'Agent déjà assigné à cet événement' });
    }
    return this.repo.save(this.repo.create(data));
  }

  async getByEvent(eventId: string): Promise<ControlAgent[]> {
    return this.repo.find({ where: { event_id: eventId } });
  }

  /** Événements auxquels un agent est affecté (écran de scan : choix de l'événement). */
  async getEventIdsForAgent(userId: string): Promise<string[]> {
    const rows = await this.repo.find({ where: { user_id: userId }, order: { created_at: 'DESC' } });
    return [...new Set(rows.map((row) => row.event_id))];
  }

  /** Vérifie l'affectation réelle d'un agent à un événement (indépendamment du rôle JWT global). */
  async isAssigned(userId: string, eventId: string): Promise<boolean> {
    const agent = await this.repo.findOne({ where: { user_id: userId, event_id: eventId } });
    return !!agent;
  }

  /** Dernier scan de l'agent ; GREATEST évite qu'un scan hors ligne synchronisé ne recule la date. */
  async recordActivity(userId: string, eventId: string, at: Date): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(ControlAgent)
      .set({ last_activity_at: () => 'GREATEST(COALESCE(last_activity_at, :at), :at)' })
      .where('user_id = :userId AND event_id = :eventId', { userId, eventId })
      .setParameter('at', at)
      .execute();
  }

  async remove(userId: string, eventId: string): Promise<{ success: boolean }> {
    await this.repo.delete({ user_id: userId, event_id: eventId });
    return { success: true };
  }
}
