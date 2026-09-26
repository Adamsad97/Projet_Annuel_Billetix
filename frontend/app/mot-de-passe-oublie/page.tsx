import { AuthHeader } from "@/components/layout/auth-header";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function MotDePasseOubliePage() {
  return (
    <div className="flex flex-1 flex-col bg-page">
      <AuthHeader />

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
        <div className="relative">
          <ForgotPasswordForm />
        </div>
      </main>
    </div>
  );
}
