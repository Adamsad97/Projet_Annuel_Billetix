import { AuthHeader } from "@/components/layout/auth-header";
import { SignupForm } from "@/components/auth/signup-form";

export default function InscriptionPage() {
  return (
    <div className="flex flex-1 flex-col bg-page">
      <AuthHeader />

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
        <div className="relative">
          <SignupForm />
        </div>
      </main>
    </div>
  );
}
