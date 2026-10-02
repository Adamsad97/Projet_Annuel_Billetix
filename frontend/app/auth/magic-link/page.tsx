import { AuthShell } from "@/components/layout/auth-shell";
import { MagicLinkLogin } from "@/components/auth/magic-link-login";

export default async function MagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthShell>
      <MagicLinkLogin token={token ?? null} />
    </AuthShell>
  );
}
