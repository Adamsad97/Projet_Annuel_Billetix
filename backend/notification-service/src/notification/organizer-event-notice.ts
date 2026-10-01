import type { OrganizerEventNoticeKind } from './dto/organizer-event-notice.dto';

export interface OrganizerEventNoticeContent {
  subject: string;
  headline: string;
  intro: string;
  /** Titre de l'encadré qui reprend le message de l'admin. */
  messageLabel: string;
  tone: '' | 'warning' | 'danger' | 'success';
  details?: string;
  ctaLabel: string;
}

/**
 * Contenu de l'email envoyé à l'organisateur pour chaque action de
 * l'administration sur son événement.
 */
export function organizerEventNotice(kind: OrganizerEventNoticeKind, eventName: string): OrganizerEventNoticeContent {
  const cta = 'Voir mon événement';
  switch (kind) {
    case 'CREATED_FOR_YOU':
      return {
        subject: `Votre événement "${eventName}" a été créé — BilleTix`,
        headline: 'Votre événement a été créé',
        intro: "L'équipe BilleTix a créé cet événement pour vous, à votre demande :",
        messageLabel: 'Note',
        tone: '',
        details: 'Vérifiez ses informations et ses billets depuis votre espace organisateur.',
        ctaLabel: cta,
      };
    case 'NON_PROFIT_VERIFIED':
      return {
        subject: `Statut « but non lucratif » validé pour "${eventName}" — BilleTix`,
        headline: 'Votre justificatif a été validé',
        intro: 'Le caractère non lucratif de votre événement a été vérifié :',
        messageLabel: 'Note',
        tone: 'success',
        details: 'Le barème de commission correspondant lui est appliqué.',
        ctaLabel: cta,
      };
    case 'NON_PROFIT_REJECTED':
      return {
        subject: `Justificatif « but non lucratif » refusé pour "${eventName}" — BilleTix`,
        headline: "Votre justificatif n'a pas été accepté",
        intro: "Le justificatif « but non lucratif » fourni pour cet événement n'a pas pu être validé :",
        messageLabel: 'Motif',
        tone: 'warning',
        details: "Le barème de commission standard s'applique. Vous pouvez fournir un nouveau justificatif depuis votre espace organisateur.",
        ctaLabel: cta,
      };
    case 'SUSPENDED':
      return {
        subject: `Ventes suspendues pour "${eventName}" — BilleTix`,
        headline: 'Les ventes de votre événement sont suspendues',
        intro: "L'administration a désactivé temporairement la billetterie de votre événement :",
        messageLabel: 'Message affiché au public',
        tone: 'danger',
        details:
          "L'événement reste visible avec ce message, mais aucun billet ne peut être acheté. Les billets déjà vendus restent valables.",
        ctaLabel: cta,
      };
    case 'UNSUSPENDED':
      return {
        subject: `Ventes rouvertes pour "${eventName}" — BilleTix`,
        headline: 'Les ventes de votre événement ont repris',
        intro: "L'administration a réactivé la billetterie de votre événement :",
        messageLabel: 'Note',
        tone: 'success',
        details: 'Les billets sont de nouveau en vente.',
        ctaLabel: cta,
      };
    case 'HIDDEN':
      return {
        subject: `Votre événement "${eventName}" a été masqué — BilleTix`,
        headline: 'Votre événement a été masqué au public',
        intro: "L'administration a masqué votre événement :",
        messageLabel: 'Motif',
        tone: 'warning',
        details:
          "Il n'apparaît plus dans la liste des événements, sa page publique est indisponible et les ventes sont bloquées. Les billets déjà vendus restent valables.",
        ctaLabel: cta,
      };
    case 'UNHIDDEN':
      return {
        subject: `Votre événement "${eventName}" est de nouveau visible — BilleTix`,
        headline: 'Votre événement est de nouveau visible',
        intro: "L'administration a rendu votre événement de nouveau visible au public :",
        messageLabel: 'Note',
        tone: 'success',
        details: 'Il réapparaît dans la liste des événements et sa page publique est de nouveau accessible.',
        ctaLabel: cta,
      };
    case 'CANCELLED_BY_ADMIN':
      return {
        subject: `Votre événement "${eventName}" a été annulé — BilleTix`,
        headline: 'Votre événement a été annulé',
        intro: "L'administration a annulé votre événement :",
        messageLabel: 'Motif',
        tone: 'danger',
        details: 'Les acheteurs sont remboursés automatiquement et prévenus par email.',
        ctaLabel: cta,
      };
    case 'CANCELLATION_MESSAGE':
      return {
        subject: `Nouveau message sur votre demande d'annulation — ${eventName}`,
        headline: "L'administration vous a répondu",
        intro: "Un nouveau message a été ajouté à votre demande d'annulation de :",
        messageLabel: 'Message',
        tone: '',
        details: "Votre demande reste en cours d'examen. Vous pouvez répondre depuis la page de votre événement.",
        ctaLabel: 'Répondre',
      };
    case 'CANCELLATION_REJECTED':
      return {
        subject: `Demande d'annulation refusée — ${eventName}`,
        headline: "Votre demande d'annulation a été refusée",
        intro: "L'administration a refusé votre demande d'annulation de :",
        messageLabel: 'Message',
        tone: 'warning',
        details: "L'événement continue normalement. Vous pouvez faire une nouvelle demande si la situation évolue.",
        ctaLabel: cta,
      };
    case 'CANCELLATION_APPROVED':
      return {
        subject: `Demande d'annulation acceptée — ${eventName}`,
        headline: "Votre demande d'annulation a été acceptée",
        intro: "L'administration a accepté votre demande et annulé :",
        messageLabel: 'Message',
        tone: 'success',
        details: 'Les acheteurs sont remboursés automatiquement et reçoivent votre motif par email.',
        ctaLabel: cta,
      };
    case 'POSTPONEMENT_MESSAGE':
      return {
        subject: `Nouveau message sur votre demande de report — ${eventName}`,
        headline: "L'administration vous a répondu",
        intro: 'Un nouveau message a été ajouté à votre demande de report de :',
        messageLabel: 'Message',
        tone: '',
        details: "Votre demande reste en cours d'examen. Vous pouvez répondre depuis la page de votre événement.",
        ctaLabel: 'Répondre',
      };
    case 'POSTPONEMENT_REJECTED':
      return {
        subject: `Demande de report refusée — ${eventName}`,
        headline: 'Votre demande de report a été refusée',
        intro: "L'administration a refusé votre demande de report de :",
        messageLabel: 'Message',
        tone: 'warning',
        details: "L'événement est maintenu à sa date. Vous pouvez faire une nouvelle demande si la situation évolue.",
        ctaLabel: cta,
      };
    case 'POSTPONEMENT_APPROVED':
      return {
        subject: `Demande de report acceptée — ${eventName}`,
        headline: 'Votre demande de report a été acceptée',
        intro: "L'administration a accepté le report de :",
        messageLabel: 'Message',
        tone: 'success',
        details:
          "Les acheteurs sont prévenus par email : leur billet reste valable pour la nouvelle date, et ils peuvent demander le remboursement pendant le délai prévu. Si la nouvelle date n'est pas encore fixée, indiquez-la depuis la page de votre événement dès qu'elle est connue.",
        ctaLabel: cta,
      };
  }
}
