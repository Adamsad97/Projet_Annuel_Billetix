import { AuthShell } from "@/components/layout/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { ForceReauth } from "@/components/auth/force-reauth";

// Motif d'une déconnexion automatique ; inactivité et durée maximale restent silencieuses.
const SESSION_MESSAGES: Record<string, string> = {
  expiree: "Votre session a expiré. Veuillez vous reconnecter pour continuer.",
};

// Reconnexion exigée : lien d'email vers les billets ou une commande
// (reauth=1), ou action sensible comme la modification de l'IBAN.
const REAUTH_MESSAGES: Record<string, string> = {
  "1": "Pour protéger vos billets, une connexion est demandée à chaque accès depuis un email.",
  sensible: "Par sécurité, confirmez votre identité en vous reconnectant. Vous reviendrez ensuite sur la page que vous quittiez.",
};

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; next?: string; reauth?: string }>;
}) {
  const { session, next, reauth } = await searchParams;
  const forceReauth = reauth !== undefined && reauth in REAUTH_MESSAGES;
  const sessionMessage = forceReauth
    ? REAUTH_MESSAGES[reauth]
    : session
      ? SESSION_MESSAGES[session]
      : undefined;

  return (
    <AuthShell>
      {forceReauth ? <ForceReauth /> : null}
      <LoginForm sessionMessage={sessionMessage} next={next} />
    </AuthShell>
  );
}
