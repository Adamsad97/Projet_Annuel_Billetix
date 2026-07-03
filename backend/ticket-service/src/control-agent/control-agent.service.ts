import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { ControlAgent } from './control-agent.entity';

const SESSION_DURATION_HOURS = 12;

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

  async startSession(userId: string, eventId: string): Promise<ControlAgent> {
    const agent = await this.repo.findOne({ where: { user_id: userId, event_id: eventId } });
    if (!agent) {
      throw new RpcException({ statusCode: 403, message: 'Agent non assigné à cet événement' });
    }

    const now = new Date();
    const expires = new Date(now.getTime() + SESSION_DURATION_HOURS * 3600 * 1000);

    agent.session_token = randomBytes(32).toString('hex');
    agent.session_started_at = now;
    agent.session_expires_at = expires;
    agent.last_activity_at = now;
    return this.repo.save(agent);
  }

  async updateActivity(sessionToken: string): Promise<{ valid: boolean; agent_id: string }> {
    const agent = await this.repo.findOne({ where: { session_token: sessionToken } });
    if (!agent || !agent.session_expires_at || agent.session_expires_at < new Date()) {
      throw new RpcException({ statusCode: 401, message: 'Session expirée ou invalide' });
    }
    agent.last_activity_at = new Date();
    await this.repo.save(agent);
    return { valid: true, agent_id: agent.user_id };
  }

  async endSession(userId: string, eventId: string): Promise<{ success: boolean }> {
    await this.repo.update(
      { user_id: userId, event_id: eventId },
      { session_token: null, session_started_at: null, session_expires_at: null },
    );
    return { success: true };
  }

  async remove(userId: string, eventId: string): Promise<{ success: boolean }> {
    await this.repo.delete({ user_id: userId, event_id: eventId });
    return { success: true };
  }
}
