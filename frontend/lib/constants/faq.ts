// Foire aux questions — contenu statique, reflète les règles déjà
// construites côté backend (CDC).

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqCategory {
  id: string;
  title: string;
  emoji: string;
  items: FaqItem[];
}

export const faqCategories: FaqCategory[] = [
  {
    id: "achat",
    title: "Achat de billets",
    emoji: "🎫",
    items: [
      {
        question: "Comment reçois-je mes billets après un achat ?",
        answer:
          "Dès la confirmation du paiement, vos billets sont disponibles dans « Mes billets » et votre facture vous est envoyée par email. Pour votre sécurité, le billet et son QR code ne sont jamais envoyés par email : ils ne s'affichent que dans votre espace, après connexion.",
      },
      {
        question: "Quels moyens de paiement sont acceptés ?",
        answer:
          "Carte bancaire, PayPal, Apple Pay, Google Pay, Orange Money et Wave.",
      },
      {
        question: "Puis-je annuler ma commande ?",
        answer:
          "Oui, jusqu'à 24h avant l'événement, sauf mention contraire de l'organisateur. Passé ce délai, seule une annulation de l'événement par l'organisateur donne droit à un remboursement automatique.",
      },
    ],
  },
  {
    id: "billets",
    title: "Mes billets",
    emoji: "📱",
    items: [
      {
        question: "Mon billet a-t-il une limite d'utilisation ?",
        answer:
          "Chaque QR code est signé et à usage unique : une fois scanné à l'entrée, il ne peut plus être réutilisé.",
      },
      {
        question: "Puis-je revendre un billet que je ne peux plus utiliser ?",
        answer:
          "Oui, depuis la page du billet, via « Revendre ce billet ». Le prix de revente est plafonné à la valeur faciale — la revente à profit n'est pas autorisée.",
      },
    ],
  },
  {
    id: "organisateur",
    title: "Devenir organisateur",
    emoji: "📢",
    items: [
      {
        question: "Comment créer mon premier événement ?",
        answer:
          "Depuis votre tableau de bord, cliquez sur « Créer un événement ». Votre soumission est examinée par notre équipe sous 48h ouvrées avant publication.",
      },
      {
        question: "Quand suis-je payé ?",
        answer:
          "Les reversements sont possibles au plus tôt 2 jours ouvrés (J+2) après la fin de votre événement, une fois votre vérification d'identité (KYC) complétée dans Paiements.",
      },
      {
        question: "Quelle commission BilletiX prélève-t-elle ?",
        answer:
          "5,5 % + 0,30 € par transaction en carte bancaire ou PayPal. Les événements associatifs à but non lucratif peuvent être exonérés sur justificatif.",
      },
    ],
  },
  {
    id: "securite",
    title: "Compte & sécurité",
    emoji: "🔒",
    items: [
      {
        question: "Comment activer la double authentification (2FA) ?",
        answer:
          "Depuis Profil → Sécurité du compte → Gérer, scanne le QR code avec une application TOTP comme Google Authenticator.",
      },
      {
        question: "J'ai oublié mon mot de passe, que faire ?",
        answer:
          "Utilisez « Mot de passe oublié ? » sur la page de connexion pour recevoir un lien de réinitialisation par email.",
      },
    ],
  },
];
