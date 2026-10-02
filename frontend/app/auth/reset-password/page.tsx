import { AuthShell } from "@/components/layout/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; expire?: string }>;
}) {
  const { token, expire } = await searchParams;
  // Arrivée depuis la connexion : mot de passe expiré (durée réglée par l'admin), pas oubli.
  const expiredAfterDays = expire && /^\d+$/.test(expire) ? Number(expire) : null;

  return (
    <AuthShell>
      <ResetPasswordForm token={token ?? null} expiredAfterDays={expiredAfterDays} />
    </AuthShell>
  );
}
