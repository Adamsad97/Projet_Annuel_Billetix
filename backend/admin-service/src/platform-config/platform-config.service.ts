import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSetting } from './platform-config.entity';

export interface PlatformConfig {
  tva_rate: number;
  free_ticket_fee_eur: number;
  commission_standard_percent: number;
  commission_large_event_percent: number;
  large_event_threshold: number;
  payout_delay_days: number;
  stripe_fee_percent: number;
  stripe_fee_fixed_eur: number;
  stock_reservation_ttl_seconds: number;
  cancel_deadline_hours: number;
  agent_session_hours: number;
  fill_thresholds: number[];
}

const DEFAULTS: Array<Omit<PlatformSetting, 'updated_at'>> = [
  { key: 'tva_rate',                       value: '0.20',          type: 'number',  description: 'Taux de TVA applicable (ex: 0.20 = 20%)' },
  { key: 'free_ticket_fee_eur',            value: '0.50',          type: 'number',  description: 'Frais fixes par billet gratuit (€)' },
  { key: 'commission_standard_percent',    value: '10',            type: 'number',  description: 'Commission standard prélevée sur le prix HT (%)' },
  { key: 'commission_large_event_percent', value: '8',             type: 'number',  description: 'Commission grande jauge (> seuil) (%)' },
  { key: 'large_event_threshold',          value: '1000',          type: 'number',  description: 'Seuil de places pour la commission dégressives' },
  { key: 'payout_delay_days',              value: '5',             type: 'number',  description: 'Délai de reversement en jours ouvrés après l\'événement' },
  { key: 'stripe_fee_percent',             value: '2.9',           type: 'number',  description: 'Taux de frais Stripe (%)' },
  { key: 'stripe_fee_fixed_eur',           value: '0.30',          type: 'number',  description: 'Frais fixe Stripe par transaction (€)' },
  { key: 'stock_reservation_ttl_seconds',  value: '600',           type: 'number',  description: 'Durée de validité de la réservation de stock (secondes)' },
  { key: 'cancel_deadline_hours',          value: '24',            type: 'number',  description: 'Délai avant l\'événement au-delà duquel l\'annulation est bloquée (heures)' },
  { key: 'agent_session_hours',            value: '12',            type: 'number',  description: 'Durée maximale d\'une session agent de contrôle (heures)' },
  { key: 'fill_thresholds',               value: '[25,50,75,100]', type: 'json',    description: 'Seuils de remplissage déclenchant une notification organisateur (%)' },
];

@Injectable()
export class PlatformConfigService implements OnModuleInit {
  constructor(
    @InjectRepository(PlatformSetting)
    private readonly repo: Repository<PlatformSetting>,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const setting of DEFAULTS) {
      const exists = await this.repo.findOne({ where: { key: setting.key } });
      if (!exists) {
        await this.repo.save(this.repo.create(setting));
      }
    }
  }

  async getAll(): Promise<PlatformConfig> {
    const settings = await this.repo.find();
    const map: Record<string, string> = {};
    for (const setting of settings) map[setting.key] = setting.value;

    return {
      tva_rate:                       parseFloat(map.tva_rate ?? '0.20'),
      free_ticket_fee_eur:            parseFloat(map.free_ticket_fee_eur ?? '0.50'),
      commission_standard_percent:    parseFloat(map.commission_standard_percent ?? '10'),
      commission_large_event_percent: parseFloat(map.commission_large_event_percent ?? '8'),
      large_event_threshold:          parseInt(map.large_event_threshold ?? '1000'),
      payout_delay_days:              parseInt(map.payout_delay_days ?? '5'),
      stripe_fee_percent:             parseFloat(map.stripe_fee_percent ?? '2.9'),
      stripe_fee_fixed_eur:           parseFloat(map.stripe_fee_fixed_eur ?? '0.30'),
      stock_reservation_ttl_seconds:  parseInt(map.stock_reservation_ttl_seconds ?? '600'),
      cancel_deadline_hours:          parseInt(map.cancel_deadline_hours ?? '24'),
      agent_session_hours:            parseInt(map.agent_session_hours ?? '12'),
      fill_thresholds:                JSON.parse(map.fill_thresholds ?? '[25,50,75,100]'),
    };
  }

  async update(key: string, value: string): Promise<PlatformSetting> {
    const setting = await this.repo.findOne({ where: { key } });
    if (!setting) {
      throw new Error(`Paramètre inconnu : ${key}`);
    }
    setting.value = value;
    return this.repo.save(setting);
  }

  async list(): Promise<PlatformSetting[]> {
    return this.repo.find({ order: { key: 'ASC' } });
  }
}
