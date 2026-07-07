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
  platform_legal_name: string;
  platform_siret: string;
  platform_vat_number: string;
  platform_address: string;
  dispute_alert_threshold: number;
  refund_alert_threshold_24h: number;
  email_max_retry_attempts: number;
  email_retry_delay_minutes: number;
  ticket_pdf_wait_max_attempts: number;
  ticket_pdf_wait_delay_seconds: number;
  event_validation_deadline_hours: number;
  event_archive_delay_days: number;
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
  { key: 'platform_legal_name',            value: 'BilletiX SAS',  type: 'string',  description: 'Raison sociale de la plateforme (en-tête facture)' },
  { key: 'platform_siret',                 value: '',              type: 'string',  description: 'Numéro SIRET de la plateforme (en-tête facture)' },
  { key: 'platform_vat_number',            value: '',              type: 'string',  description: 'Numéro de TVA intracommunautaire de la plateforme' },
  { key: 'platform_address',               value: '',              type: 'string',  description: 'Adresse légale de la plateforme (en-tête facture)' },
  { key: 'dispute_alert_threshold',        value: '5',             type: 'number',  description: 'Nombre de litiges ouverts déclenchant une alerte admin' },
  { key: 'refund_alert_threshold_24h',     value: '10',            type: 'number',  description: 'Nombre de remboursements sur 24h déclenchant une alerte "remboursements massifs"' },
  { key: 'email_max_retry_attempts',       value: '3',             type: 'number',  description: 'Nombre de tentatives d\'envoi d\'un email avant abandon définitif' },
  { key: 'email_retry_delay_minutes',      value: '10',            type: 'number',  description: 'Délai entre deux tentatives d\'envoi d\'un email (minutes)' },
  { key: 'ticket_pdf_wait_max_attempts',   value: '5',             type: 'number',  description: 'Nombre de vérifications avant d\'envoyer l\'email billet sans pièce jointe PDF' },
  { key: 'ticket_pdf_wait_delay_seconds',  value: '2',             type: 'number',  description: 'Délai entre deux vérifications de disponibilité du PDF billet (secondes)' },
  { key: 'event_validation_deadline_hours',value: '48',            type: 'number',  description: 'Délai maximum de traitement (heures ouvrées) d\'un événement soumis à validation' },
  { key: 'event_archive_delay_days',       value: '30',            type: 'number',  description: 'Délai après la fin d\'un événement (Terminé) avant son archivage automatique (jours)' },
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
      platform_legal_name:            map.platform_legal_name ?? 'BilletiX SAS',
      platform_siret:                 map.platform_siret ?? '',
      platform_vat_number:            map.platform_vat_number ?? '',
      platform_address:               map.platform_address ?? '',
      dispute_alert_threshold:        parseInt(map.dispute_alert_threshold ?? '5'),
      refund_alert_threshold_24h:     parseInt(map.refund_alert_threshold_24h ?? '10'),
      email_max_retry_attempts:       parseInt(map.email_max_retry_attempts ?? '3'),
      email_retry_delay_minutes:      parseInt(map.email_retry_delay_minutes ?? '10'),
      ticket_pdf_wait_max_attempts:   parseInt(map.ticket_pdf_wait_max_attempts ?? '5'),
      ticket_pdf_wait_delay_seconds:  parseInt(map.ticket_pdf_wait_delay_seconds ?? '2'),
      event_validation_deadline_hours: parseInt(map.event_validation_deadline_hours ?? '48'),
      event_archive_delay_days:       parseInt(map.event_archive_delay_days ?? '30'),
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
