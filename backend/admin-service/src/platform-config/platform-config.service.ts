import { Injectable, OnModuleInit } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PlatformSetting } from './platform-config.entity';
import { numericBoundsError, sectionOf } from './setting-catalog';

export interface PlatformConfig {
  free_ticket_fee_eur: number;
  commission_standard_percent: number;
  commission_large_event_percent: number;
  large_event_threshold: number;
  payout_delay_days: number;
  iban_change_payout_hold_hours: number;
  platform_iban: string;
  platform_bic: string;
  stripe_fee_percent: number;
  stripe_fee_fixed_eur: number;
  stock_reservation_ttl_seconds: number;
  cancel_deadline_hours: number;
  postponement_refund_days: number;
  agent_invitation_hours: number;
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
  order_abandon_timeout_minutes: number;
  resale_reservation_minutes: number;
  dispute_payout_block_max_days: number;
  payout_early_request_min_days_after_event: number;
  account_lockout_threshold: number;
  account_lockout_duration_minutes: number;
  pdf_generation_max_retry_attempts: number;
  password_min_length: number;
  password_max_age_days: number;
  magic_link_ttl_minutes: number;
  minimum_signup_age: number;
  session_idle_timeout_minutes: number;
  session_refresh_grace_seconds: number;
  session_max_duration_hours: number;
  ticket_qr_display_seconds: number;
  ticket_transfer_max_per_ticket: number;
  ticket_transfer_cutoff_hours: number;
  sensitive_action_reauth_minutes: number;
  ticket_qr_rotation_seconds: number;
  ticket_qr_rotation_tolerance_steps: number;
  scan_opens_before_minutes: number;
  scan_closes_after_minutes: number;
}

// Réglages retirés du produit, supprimés au démarrage (QR fixe, session d'agent, taux de TVA unique).
const OBSOLETE_KEYS = [
  'ticket_qr_rotation_enabled',
  'agent_session_hours',
  'tva_rate',
  'paypal_fee_percent',
  'paypal_fee_fixed_eur',
  'orange_money_fee_percent',
  'orange_money_fee_fixed_eur',
  'wave_fee_percent',
  'wave_fee_fixed_eur',
];

const DEFAULTS: Array<Omit<PlatformSetting, 'updated_at'>> = [
  { key: 'free_ticket_fee_eur',            value: '0.50',          type: 'number',  description: 'Frais fixes par billet gratuit (€)' },
  { key: 'commission_standard_percent',    value: '10',            type: 'number',  description: 'Commission standard prélevée sur le prix HT (%)' },
  { key: 'commission_large_event_percent', value: '8',             type: 'number',  description: 'Commission grande jauge (> seuil) (%)' },
  { key: 'large_event_threshold',          value: '1000',          type: 'number',  description: 'Seuil de places pour la commission dégressives' },
  { key: 'payout_delay_days',              value: '5',             type: 'number',  description: 'Délai de reversement en jours ouvrés après l\'événement' },
  { key: 'iban_change_payout_hold_hours',  value: '72',            type: 'number',  description: 'Reversements suspendus après un changement d\'IBAN (heures), le temps que l\'organisateur réagisse à l\'email d\'alerte' },
  { key: 'stripe_fee_percent',             value: '2.9',           type: 'number',  description: 'Taux de frais Stripe (%)' },
  { key: 'stripe_fee_fixed_eur',           value: '0.30',          type: 'number',  description: 'Frais fixe Stripe par transaction (€)' },
  { key: 'stock_reservation_ttl_seconds',  value: '600',           type: 'number',  description: 'Durée de validité de la réservation de stock (secondes)' },
  { key: 'cancel_deadline_hours',          value: '24',            type: 'number',  description: 'Délai avant l\'événement au-delà duquel l\'annulation est bloquée (heures)' },
  { key: 'postponement_refund_days',       value: '14',            type: 'number',  description: 'Délai pour demander le remboursement après l’annonce de la nouvelle date d’un événement reporté (jours)' },
  { key: 'agent_invitation_hours',         value: '72',            type: 'number',  description: 'Validité du lien d\'invitation d\'un agent de contrôle (heures)' },
  { key: 'fill_thresholds',               value: '[25,50,75,100]', type: 'json',    description: 'Seuils de remplissage déclenchant une notification organisateur (%)' },
  { key: 'platform_legal_name',            value: 'BilleTix SAS',  type: 'string',  description: 'Raison sociale de la plateforme (en-tête facture)' },
  { key: 'platform_siret',                 value: '',              type: 'string',  description: 'Numéro SIRET de la plateforme (en-tête facture)' },
  { key: 'platform_vat_number',            value: '',              type: 'string',  description: 'Numéro de TVA intracommunautaire de la plateforme' },
  { key: 'platform_address',               value: '',              type: 'string',  description: 'Adresse légale de la plateforme (en-tête facture)' },
  { key: 'platform_iban',                  value: '',              type: 'string',  description: 'IBAN du compte de la plateforme, émetteur des virements SEPA aux organisateurs' },
  { key: 'platform_bic',                   value: '',              type: 'string',  description: 'BIC de la banque de la plateforme (fichier de virements SEPA)' },
  { key: 'dispute_alert_threshold',        value: '5',             type: 'number',  description: 'Nombre de litiges ouverts déclenchant une alerte admin' },
  { key: 'refund_alert_threshold_24h',     value: '10',            type: 'number',  description: 'Nombre de remboursements sur 24h déclenchant une alerte "remboursements massifs"' },
  { key: 'email_max_retry_attempts',       value: '3',             type: 'number',  description: 'Nombre de tentatives d\'envoi d\'un email avant abandon définitif' },
  { key: 'email_retry_delay_minutes',      value: '10',            type: 'number',  description: 'Délai entre deux tentatives d\'envoi d\'un email (minutes)' },
  { key: 'ticket_pdf_wait_max_attempts',   value: '5',             type: 'number',  description: 'Nombre de vérifications de la facture PDF avant d\'envoyer l\'email de facture sans pièce jointe' },
  { key: 'ticket_pdf_wait_delay_seconds',  value: '2',             type: 'number',  description: 'Délai entre deux vérifications de disponibilité de la facture PDF (secondes)' },
  { key: 'event_validation_deadline_hours',value: '48',            type: 'number',  description: 'Délai maximum de traitement (heures ouvrées) d\'un événement soumis à validation' },
  { key: 'event_archive_delay_days',       value: '30',            type: 'number',  description: 'Délai après la fin d\'un événement (Terminé) avant son archivage automatique (jours)' },
  { key: 'order_abandon_timeout_minutes',  value: '30',            type: 'number',  description: 'Délai après lequel une commande non payée est annulée et son stock libéré (minutes)' },
  { key: 'resale_reservation_minutes',     value: '15',            type: 'number',  description: 'Durée de réservation d\'une offre de revente pendant le paiement de l\'acheteur (minutes)' },
  { key: 'dispute_payout_block_max_days',  value: '30',            type: 'number',  description: 'Durée maximale de blocage d\'un reversement suite à un litige, avant déblocage automatique (jours)' },
  { key: 'payout_early_request_min_days_after_event', value: '2',  type: 'number',  description: 'Délai minimum après la fin de l\'événement avant qu\'un organisateur puisse demander un reversement anticipé (jours)' },
  { key: 'account_lockout_threshold',      value: '5',             type: 'number',  description: 'Nombre d\'échecs de connexion consécutifs (mot de passe ou code 2FA) avant verrouillage temporaire du compte' },
  { key: 'account_lockout_duration_minutes', value: '15',          type: 'number',  description: 'Durée du verrouillage temporaire d\'un compte après trop d\'échecs de connexion (minutes)' },
  { key: 'pdf_generation_max_retry_attempts', value: '5',          type: 'number',  description: 'Nombre de tentatives de génération PDF (billet/facture) avant abandon définitif et alerte admin' },
  { key: 'ticket_qr_rotation_seconds',     value: '5',             type: 'number',  description: 'Période de renouvellement du QR code dynamique (secondes)' },
  { key: 'ticket_qr_rotation_tolerance_steps', value: '1',         type: 'number',  description: 'Nombre de périodes précédentes/suivantes encore acceptées au scan (décalage d\'horloge, lenteur du contrôle)' },
  { key: 'scan_opens_before_minutes',      value: '180',           type: 'number',  description: 'Ouverture du contrôle des billets avant le début de l\'événement (minutes)' },
  { key: 'scan_closes_after_minutes',      value: '60',            type: 'number',  description: 'Fermeture du contrôle des billets après la fin de l\'événement (minutes)' },
  { key: 'ticket_qr_display_seconds',      value: '60',            type: 'number',  description: 'Durée d\'affichage du QR code d\'un billet dans l\'espace acheteur avant masquage automatique (secondes)' },
  { key: 'ticket_transfer_max_per_ticket', value: '1',             type: 'number',  description: 'Nombre maximum de fois qu\'un même billet peut être offert à un autre compte (0 = transferts désactivés)' },
  { key: 'ticket_transfer_cutoff_hours',   value: '2',             type: 'number',  description: 'Fermeture des transferts de billets avant le début de l\'événement (heures)' },
  { key: 'sensitive_action_reauth_minutes', value: '5',           type: 'number',  description: 'Connexion récente exigée pour une action irréversible, ex. offrir un billet (minutes depuis la dernière saisie des identifiants)' },
  { key: 'session_max_duration_hours',     value: '12',            type: 'number',  description: 'Durée maximale d\'une session depuis la connexion (heures) : reconnexion obligatoire ensuite, même en restant actif' },
  { key: 'session_refresh_grace_seconds',  value: '30',            type: 'number',  description: 'Délai (secondes) pendant lequel un jeton de session tout juste renouvelé reste accepté (plusieurs onglets ouverts qui renouvellent en même temps)' },
  { key: 'session_idle_timeout_minutes',   value: '30',            type: 'number',  description: 'Durée d\'inactivité (minutes) au-delà de laquelle la session expire : déconnexion automatique, et le serveur refuse de la renouveler' },
  { key: 'minimum_signup_age',             value: '18',            type: 'number',  description: 'Âge minimum pour créer un compte (années révolues, vérifié sur la date de naissance à l\'inscription)' },
  { key: 'password_min_length',            value: '12',            type: 'number',  description: 'Longueur minimale d\'un mot de passe (inscription, réinitialisation, changement) — en plus des règles majuscule/minuscule/chiffre/caractère spécial' },
  { key: 'magic_link_ttl_minutes',         value: '15',            type: 'number',  description: 'Validité du lien de connexion envoyé par email (minutes), à usage unique. 0 = connexion par lien magique désactivée' },
  { key: 'password_max_age_days',          value: '60',            type: 'number',  description: 'Durée de validité d\'un mot de passe (jours) : au-delà, son changement est exigé à la connexion (recommandation CNIL : 60). 0 = jamais' },
];

@Injectable()
export class PlatformConfigService implements OnModuleInit {
  constructor(
    @InjectRepository(PlatformSetting)
    private readonly repo: Repository<PlatformSetting>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.repo.delete({ key: In(OBSOLETE_KEYS) });
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
      free_ticket_fee_eur:            parseFloat(map.free_ticket_fee_eur ?? '0.50'),
      commission_standard_percent:    parseFloat(map.commission_standard_percent ?? '10'),
      commission_large_event_percent: parseFloat(map.commission_large_event_percent ?? '8'),
      large_event_threshold:          parseInt(map.large_event_threshold ?? '1000'),
      payout_delay_days:              parseInt(map.payout_delay_days ?? '5'),
      iban_change_payout_hold_hours:  parseInt(map.iban_change_payout_hold_hours ?? '72'),
      stripe_fee_percent:             parseFloat(map.stripe_fee_percent ?? '2.9'),
      stripe_fee_fixed_eur:           parseFloat(map.stripe_fee_fixed_eur ?? '0.30'),
      stock_reservation_ttl_seconds:  parseInt(map.stock_reservation_ttl_seconds ?? '600'),
      cancel_deadline_hours:          parseInt(map.cancel_deadline_hours ?? '24'),
      postponement_refund_days:       parseInt(map.postponement_refund_days ?? '14'),
      agent_invitation_hours:         parseInt(map.agent_invitation_hours ?? '72'),
      fill_thresholds:                JSON.parse(map.fill_thresholds ?? '[25,50,75,100]'),
      platform_legal_name:            map.platform_legal_name ?? 'BilleTix SAS',
      platform_siret:                 map.platform_siret ?? '',
      platform_vat_number:            map.platform_vat_number ?? '',
      platform_address:               map.platform_address ?? '',
      platform_iban:                  map.platform_iban ?? '',
      platform_bic:                   map.platform_bic ?? '',
      dispute_alert_threshold:        parseInt(map.dispute_alert_threshold ?? '5'),
      refund_alert_threshold_24h:     parseInt(map.refund_alert_threshold_24h ?? '10'),
      email_max_retry_attempts:       parseInt(map.email_max_retry_attempts ?? '3'),
      email_retry_delay_minutes:      parseInt(map.email_retry_delay_minutes ?? '10'),
      ticket_pdf_wait_max_attempts:   parseInt(map.ticket_pdf_wait_max_attempts ?? '5'),
      ticket_pdf_wait_delay_seconds:  parseInt(map.ticket_pdf_wait_delay_seconds ?? '2'),
      event_validation_deadline_hours: parseInt(map.event_validation_deadline_hours ?? '48'),
      event_archive_delay_days:       parseInt(map.event_archive_delay_days ?? '30'),
      order_abandon_timeout_minutes:  parseInt(map.order_abandon_timeout_minutes ?? '30'),
      resale_reservation_minutes:    parseInt(map.resale_reservation_minutes ?? '15'),
      dispute_payout_block_max_days: parseInt(map.dispute_payout_block_max_days ?? '30'),
      payout_early_request_min_days_after_event: parseInt(map.payout_early_request_min_days_after_event ?? '2'),
      account_lockout_threshold:      parseInt(map.account_lockout_threshold ?? '5'),
      account_lockout_duration_minutes: parseInt(map.account_lockout_duration_minutes ?? '15'),
      pdf_generation_max_retry_attempts: parseInt(map.pdf_generation_max_retry_attempts ?? '5'),
      password_min_length:            parseInt(map.password_min_length ?? '12'),
      password_max_age_days:          parseInt(map.password_max_age_days ?? '60'),
      magic_link_ttl_minutes:         parseInt(map.magic_link_ttl_minutes ?? '15'),
      minimum_signup_age:             parseInt(map.minimum_signup_age ?? '18'),
      session_idle_timeout_minutes:   parseInt(map.session_idle_timeout_minutes ?? '30'),
      session_refresh_grace_seconds:  parseInt(map.session_refresh_grace_seconds ?? '30'),
      session_max_duration_hours:     parseInt(map.session_max_duration_hours ?? '12'),
      ticket_qr_display_seconds:      parseInt(map.ticket_qr_display_seconds ?? '60'),
      ticket_transfer_max_per_ticket: parseInt(map.ticket_transfer_max_per_ticket ?? '1'),
      ticket_transfer_cutoff_hours:   parseInt(map.ticket_transfer_cutoff_hours ?? '2'),
      sensitive_action_reauth_minutes: parseInt(map.sensitive_action_reauth_minutes ?? '5'),
      ticket_qr_rotation_seconds:     parseInt(map.ticket_qr_rotation_seconds ?? '5'),
      ticket_qr_rotation_tolerance_steps: parseInt(map.ticket_qr_rotation_tolerance_steps ?? '1'),
      scan_opens_before_minutes:      parseInt(map.scan_opens_before_minutes ?? '180'),
      scan_closes_after_minutes:      parseInt(map.scan_closes_after_minutes ?? '60'),
    };
  }

  /** Valide la valeur selon son type : une chaîne sur un paramètre « number » donnerait NaN partout. */
  /** @param actorRole rôle de l'admin : les sections sensibles sont réservées au super admin. */
  async update(
    key: string,
    value: string,
    actorRole?: string,
  ): Promise<PlatformSetting & { previous_value: string }> {
    const setting = await this.repo.findOne({ where: { key } });
    if (!setting) {
      throw new RpcException({ statusCode: 404, message: `Paramètre inconnu : ${key}` });
    }
    if (sectionOf(key).super_admin_only && actorRole !== 'SUPER_ADMIN') {
      throw new RpcException({ statusCode: 403, message: 'Ce paramètre est réservé au super administrateur.' });
    }
    const previousValue = setting.value;

    switch (setting.type) {
      case 'number': {
        if (value.trim() === '' || !Number.isFinite(Number(value))) {
          throw new RpcException({
            statusCode: 400,
            message: `Valeur invalide pour "${key}" : un nombre est attendu (reçu "${value}")`,
          });
        }
        const boundsError = numericBoundsError(key, Number(value));
        if (boundsError) {
          throw new RpcException({ statusCode: 400, message: `Valeur invalide pour "${key}" : ${boundsError}` });
        }
        break;
      }
      case 'boolean':
        if (value !== 'true' && value !== 'false') {
          throw new RpcException({
            statusCode: 400,
            message: `Valeur invalide pour "${key}" : "true" ou "false" attendu (reçu "${value}")`,
          });
        }
        break;
      case 'json':
        try {
          JSON.parse(value);
        } catch {
          throw new RpcException({
            statusCode: 400,
            message: `Valeur invalide pour "${key}" : JSON mal formé`,
          });
        }
        break;
      // 'string' : toute valeur est acceptée
    }

    setting.value = value;
    const saved = await this.repo.save(setting);
    return { ...saved, previous_value: previousValue };
  }

  /** Réglages avec leur section ; les sections sensibles ne sont renvoyées qu'au super admin. */
  async list(actorRole?: string): Promise<Array<PlatformSetting & { section: string; super_admin_only: boolean }>> {
    const settings = await this.repo.find({ order: { key: 'ASC' } });
    return settings
      .map((setting) => {
        const section = sectionOf(setting.key);
        return { ...setting, section: section.id, super_admin_only: section.super_admin_only };
      })
      .filter((setting) => !setting.super_admin_only || actorRole === 'SUPER_ADMIN');
  }
}
