import { AuthShell } from "@/components/layout/auth-shell";
import { VerifyEmailStatus } from "@/components/auth/verify-email-status";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthShell>
      <VerifyEmailStatus token={token ?? null} />
    </AuthShell>
  );
}
