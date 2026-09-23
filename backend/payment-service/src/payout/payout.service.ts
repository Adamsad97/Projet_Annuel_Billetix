import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { StripeService } from '../stripe/stripe.service';
import { Payout, PayoutStatus } from './payout.entity';

@Injectable()
export class PayoutService {
  constructor(
    @InjectRepository(Payout) private readonly repo: Repository<Payout>,
    private readonly stripe: StripeService,
    private readonly platformConfig: PlatformConfigCache,
  ) {}

  async create(data: {
    organizer_id: string;
    event_id: string;
    order_id?: string;
    gross_amount: number;
    commission_amount: number;
    payment_fees_amount: number;
    event_end_at?: string;
  }): Promise<Payout> {
    const config = await this.platformConfig.get();
    const net = data.gross_amount - data.commission_amount - data.payment_fees_amount;

    const base = data.event_end_at ? new Date(data.event_end_at) : new Date();
    // Bug corrigé : le CDC §7.2 exige explicitement des jours OUVRÉS
    // ("Reversement automatique J+5 ouvrés"), mais le calcul ajoutait des
    // jours calendaires bruts (samedi/dimanche comptaient comme des jours
    // de délai) — la date annoncée aux organisateurs ne correspondait pas
    // à la réalité.
    const scheduled = this.addBusinessDays(base, config.payout_delay_days);

    return this.repo.save(
      this.repo.create({
        organizer_id: data.organizer_id,
        event_id: data.event_id,
        order_id: data.order_id ?? null,
        gross_amount: data.gross_amount,
        commission_amount: data.commission_amount,
        payment_fees_amount: data.payment_fees_amount,
        net_amount: parseFloat(net.toFixed(2)),
        scheduled_at: scheduled,
        event_end_at: data.event_end_at ? new Date(data.event_end_at) : null,
      }),
    );
  }

  /**
   * Recalcule le reversement d'une commande après remboursement (total ou
   * partiel). Si le payout n'a pas encore été versé (PENDING/BLOCKED), son
   * montant est directement réduit au prorata du remboursement. S'il est
   * déjà en cours ou versé (PROCESSING/COMPLETED), impossible de le modifier
   * rétroactivement — un virement Stripe déjà émis ne peut pas être annulé
   * localement — donc un ajustement compensatoire séparé (montant négatif)
   * est créé à la place, à récupérer sur un prochain cycle de reversement.
   */
  async recalculateForRefund(
    orderId: string,
    refundedAmount: number,
    originalPaymentAmount: number,
  ): Promise<void> {
    const payout = await this.repo.findOne({ where: { order_id: orderId } });
    if (!payout || originalPaymentAmount <= 0) return;

    const refundRatio = Math.min(refundedAmount / originalPaymentAmount, 1);

    if (
      payout.status === PayoutStatus.PENDING ||
      payout.status === PayoutStatus.BLOCKED
    ) {
      const newGross = parseFloat(
        (Number(payout.gross_amount) * (1 - refundRatio)).toFixed(2),
      );
      const newCommission = parseFloat(
        (Number(payout.commission_amount) * (1 - refundRatio)).toFixed(2),
      );
      payout.gross_amount = newGross;
      payout.commission_amount = newCommission;
      payout.net_amount = parseFloat(
        (newGross - newCommission - Number(payout.payment_fees_amount)).toFixed(2),
      );
      await this.repo.save(payout);
      return;
    }

    // PROCESSING ou COMPLETED — ajustement compensatoire séparé
    const adjustmentGross = parseFloat(
      (Number(payout.gross_amount) * refundRatio * -1).toFixed(2),
    );
    const adjustmentCommission = parseFloat(
      (Number(payout.commission_amount) * refundRatio * -1).toFixed(2),
    );
    const adjustmentNet = parseFloat(
      (adjustmentGross - adjustmentCommission).toFixed(2),
    );

    await this.repo.save(
      this.repo.create({
        organizer_id: payout.organizer_id,
        event_id: payout.event_id,
        order_id: orderId,
        gross_amount: adjustmentGross,
        commission_amount: adjustmentCommission,
        payment_fees_amount: 0,
        net_amount: adjustmentNet,
        status: PayoutStatus.PENDING,
        scheduled_at: new Date(),
      }),
    );
  }

  async getOrganizerBalance(organizerId: string): Promise<{
    pending_balance: number;
    total_earned: number;
    payouts_count: number;
  }> {
    const payouts = await this.repo.find({ where: { organizer_id: organizerId } });
    const pending_balance = payouts
      .filter((payout) => payout.status === PayoutStatus.PENDING || payout.status === PayoutStatus.PROCESSING)
      .reduce((sum, payout) => sum + Number(payout.net_amount), 0);
    const total_earned = payouts
      .filter((payout) => payout.status === PayoutStatus.COMPLETED)
      .reduce((sum, payout) => sum + Number(payout.net_amount), 0);
    return {
      pending_balance: parseFloat(pending_balance.toFixed(2)),
      total_earned: parseFloat(total_earned.toFixed(2)),
      payouts_count: payouts.length,
    };
  }

  /** Solde en attente toute la plateforme — agrégat SQL (pas de find()+reduce, volume potentiellement important). */
  async getPlatformBalance(): Promise<{
    pending_balance: number;
    total_paid_out: number;
  }> {
    const row = await this.repo
      .createQueryBuilder('payout')
      .select(
        "COALESCE(SUM(payout.net_amount) FILTER (WHERE payout.status IN ('PENDING', 'PROCESSING')), 0)",
        'pending_balance',
      )
      .addSelect(
        "COALESCE(SUM(payout.net_amount) FILTER (WHERE payout.status = 'COMPLETED'), 0)",
        'total_paid_out',
      )
      .getRawOne<Record<string, string>>();

    return {
      pending_balance: parseFloat(row?.pending_balance ?? '0'),
      total_paid_out: parseFloat(row?.total_paid_out ?? '0'),
    };
  }

  async getById(id: string): Promise<Payout> {
    const foundPayout = await this.repo.findOne({ where: { id } });
    if (!foundPayout) throw new RpcException({ statusCode: 404, message: 'Reversement introuvable' });
    return foundPayout;
  }

  async getByOrganizer(organizerId: string): Promise<Payout[]> {
    return this.repo.find({ where: { organizer_id: organizerId }, order: { scheduled_at: 'DESC' } });
  }

  /** Cartes KPI de la page admin des reversements — un seul aller-retour SQL
   * plutôt que trois (pending/versé ce mois-ci/bloqué). */
  async getStats(): Promise<{
    pending_total: number;
    paid_this_month_total: number;
    blocked_total: number;
  }> {
    const row = await this.repo
      .createQueryBuilder('payout')
      .select(
        "COALESCE(SUM(payout.net_amount) FILTER (WHERE payout.status IN ('PENDING', 'PROCESSING')), 0)",
        'pending_total',
      )
      .addSelect(
        "COALESCE(SUM(payout.net_amount) FILTER (WHERE payout.status = 'COMPLETED' AND date_trunc('month', payout.processed_at) = date_trunc('month', now())), 0)",
        'paid_this_month_total',
      )
      .addSelect(
        "COALESCE(SUM(payout.net_amount) FILTER (WHERE payout.status = 'BLOCKED'), 0)",
        'blocked_total',
      )
      .getRawOne<Record<string, string>>();

    return {
      pending_total: parseFloat(row?.pending_total ?? '0'),
      paid_this_month_total: parseFloat(row?.paid_this_month_total ?? '0'),
      blocked_total: parseFloat(row?.blocked_total ?? '0'),
    };
  }

  /** Liste globale pour l'admin (tous organisateurs confondus), paginée et
   * filtrable par statut — distincte de getByOrganizer (un seul organisateur,
   * pas de pagination car volume par compte toujours restreint). */
  async listAll(filters: {
    status?: PayoutStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Payout[]; total: number }> {
    const limit = Math.min(filters.limit ?? 20, 100);
    const offset = filters.offset ?? 0;

    const qb = this.repo
      .createQueryBuilder('payout')
      .orderBy('payout.scheduled_at', 'DESC')
      .skip(offset)
      .take(limit);

    if (filters.status) qb.andWhere('payout.status = :status', { status: filters.status });

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async getDuePayouts(): Promise<Payout[]> {
    // net_amount > 0 uniquement : un virement Stripe ne peut pas être négatif
    // ou nul. Les ajustements négatifs créés par recalculateForRefund() (sur
    // un payout déjà versé) restent PENDING mais ne sont jamais transférés
    // automatiquement — ils doivent être récupérés sur un futur reversement
    // positif du même organisateur, ou réconciliés manuellement par un admin.
    return this.repo
      .createQueryBuilder('payout')
      .where('payout.status = :status', { status: PayoutStatus.PENDING })
      .andWhere('payout.scheduled_at <= :now', { now: new Date() })
      .andWhere('payout.net_amount > 0')
      .getMany();
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

  /**
   * Bloque automatiquement le reversement lié à une commande lorsqu'un
   * litige s'ouvre (CDC §7.2 : « litige en cours → fonds bloqués jusqu'à
   * résolution »). Ne bloque que si le reversement est encore PENDING —
   * un reversement déjà versé ne peut pas être rappelé, et un reversement
   * déjà bloqué/en cours n'a pas à être re-bloqué. `blocked_by: null`
   * distingue ce blocage automatique d'un blocage manuel par un admin.
   */
  async blockByOrder(orderId: string, reason: string): Promise<Payout | null> {
    const payout = await this.repo.findOne({ where: { order_id: orderId } });
    if (!payout || payout.status !== PayoutStatus.PENDING) return null;
    payout.status = PayoutStatus.BLOCKED;
    payout.blocked_at = new Date();
    payout.blocked_by = null;
    payout.blocked_reason = reason;
    return this.repo.save(payout);
  }

  /**
   * Débloque un reversement (litige résolu, ou expiration du délai max —
   * cf. PayoutSchedulerService.unblockExpiredDisputePayouts). Repasse en
   * PENDING : `scheduled_at` n'est pas modifié, il a déjà été calculé
   * correctement à la création — s'il est déjà échu, le prochain cycle de
   * reversement le traitera directement.
   */
  async unblock(id: string): Promise<Payout> {
    const payout = await this.getById(id);
    if (payout.status !== PayoutStatus.BLOCKED) {
      throw new RpcException({ statusCode: 400, message: 'Ce reversement n\'est pas bloqué' });
    }
    payout.status = PayoutStatus.PENDING;
    return this.repo.save(payout);
  }

  /** Débloque le reversement lié à une commande (litige résolu) — no-op silencieux si rien à débloquer. */
  async unblockByOrder(orderId: string): Promise<void> {
    const payout = await this.repo.findOne({ where: { order_id: orderId } });
    if (!payout || payout.status !== PayoutStatus.BLOCKED) return;
    payout.status = PayoutStatus.PENDING;
    await this.repo.save(payout);
  }

  /** Reversements bloqués depuis plus de `maxDays` — déblocage automatique (CDC §7.2 : 30 jours max). */
  async getExpiredBlockedPayouts(maxDays: number): Promise<Payout[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxDays);
    return this.repo.find({
      where: { status: PayoutStatus.BLOCKED, blocked_at: LessThanOrEqual(cutoff) },
    });
  }

  /**
   * Demande de reversement anticipé (CDC §7.2 : « possible après J+2
   * post-événement, soumise à validation admin »). Le délai minimum est
   * vérifié ici, pas seulement le rôle — sans ça, un organisateur pourrait
   * demander une avance dès la création du reversement, avant même la fin
   * de l'événement.
   */
  async requestEarly(id: string, organizerId: string): Promise<Payout> {
    const payout = await this.getById(id);
    if (payout.organizer_id !== organizerId) {
      throw new RpcException({ statusCode: 403, message: 'Non autorisé' });
    }
    if (payout.status !== PayoutStatus.PENDING) {
      throw new RpcException({
        statusCode: 400,
        message: 'Ce reversement n\'est pas éligible à une demande anticipée dans son état actuel',
      });
    }
    if (!payout.event_end_at) {
      throw new RpcException({
        statusCode: 400,
        message: 'Date de fin d\'événement inconnue pour ce reversement — demande anticipée impossible',
      });
    }

    const config = await this.platformConfig.get();
    const minRequestDate = new Date(payout.event_end_at);
    minRequestDate.setDate(minRequestDate.getDate() + config.payout_early_request_min_days_after_event);
    if (new Date() < minRequestDate) {
      throw new RpcException({
        statusCode: 400,
        message: `Demande anticipée possible seulement à partir du ${minRequestDate.toLocaleDateString('fr-FR')} (J+${config.payout_early_request_min_days_after_event} après l'événement)`,
      });
    }

    payout.requested_early_at = new Date();
    return this.repo.save(payout);
  }

  async approveEarly(id: string, adminId: string): Promise<Payout> {
    const payout = await this.getById(id);
    if (!payout.requested_early_at) {
      throw new RpcException({
        statusCode: 400,
        message: 'Aucune demande de reversement anticipé en attente pour ce reversement',
      });
    }
    payout.early_request_approved_by = adminId;
    payout.scheduled_at = new Date();
    return this.repo.save(payout);
  }

  /**
   * Ajoute des jours OUVRÉS (lundi-vendredi) à une date — samedi/dimanche ne
   * comptent pas dans le délai. Pas de jours fériés (hors périmètre d'un
   * projet étudiant) : "ouvrés" ici = hors week-end uniquement.
   */
  private addBusinessDays(date: Date, days: number): Date {
    const result = new Date(date);
    let remaining = days;
    while (remaining > 0) {
      result.setDate(result.getDate() + 1);
      const dayOfWeek = result.getDay(); // 0 = dimanche, 6 = samedi
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        remaining--;
      }
    }
    return result;
  }
}
