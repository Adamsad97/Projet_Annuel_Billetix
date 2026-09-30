import { AuthShell } from "@/components/layout/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export default function InscriptionPage() {
  return (
    <AuthShell>
      <SignupForm />
    </AuthShell>
  );
}
