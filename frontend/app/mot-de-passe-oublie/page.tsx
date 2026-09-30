import { AuthShell } from "@/components/layout/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function MotDePasseOubliePage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
