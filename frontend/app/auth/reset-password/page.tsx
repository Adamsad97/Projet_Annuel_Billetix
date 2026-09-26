import { AuthHeader } from "@/components/layout/auth-header";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex flex-1 flex-col bg-page">
      <AuthHeader />

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
        <div className="relative">
          <ResetPasswordForm token={token ?? null} />
        </div>
      </main>
    </div>
  );
}
