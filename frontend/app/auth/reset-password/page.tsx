import { AuthShell } from "@/components/layout/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthShell>
      <ResetPasswordForm token={token ?? null} />
    </AuthShell>
  );
}
