import { AuthHeader } from "@/components/layout/auth-header";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <AuthHeader />

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[48rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-700/20 blur-3xl"
        />
        <div className="relative">
          <ResetPasswordForm token={token ?? null} />
        </div>
      </main>
    </div>
  );
}
