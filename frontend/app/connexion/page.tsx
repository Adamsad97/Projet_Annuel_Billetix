import { AuthShell } from "@/components/layout/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { ForceReauth } from "@/components/auth/force-reauth";

// Motif d'une déconnexion automatique (cf. SessionManager), affiché au-dessus
// du formulaire. Déconnexion pour inactivité ou pour durée maximale de
// session : volontairement silencieuses (demande produit), simple retour au
// formulaire de connexion.
const SESSION_MESSAGES: Record<string, string> = {
  expiree: "Votre session a expiré. Veuillez vous reconnecter pour continuer.",
};

// Arrivée depuis un lien d'email vers les billets ou une commande.
const REAUTH_MESSAGE =
  "Pour protéger vos billets, une connexion est demandée à chaque accès depuis un email.";

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; next?: string; reauth?: string }>;
}) {
  const { session, next, reauth } = await searchParams;
  const forceReauth = reauth === "1";
  const sessionMessage = forceReauth
    ? REAUTH_MESSAGE
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
