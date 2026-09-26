import { AuthHeader } from "@/components/layout/auth-header";
import { VerifyEmailStatus } from "@/components/auth/verify-email-status";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex flex-1 flex-col bg-page">
      <AuthHeader />

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
        <VerifyEmailStatus token={token ?? null} />
      </main>
    </div>
  );
}
