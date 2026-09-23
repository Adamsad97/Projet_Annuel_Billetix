import Link from "next/link";
import { AuthHeader } from "@/components/layout/auth-header";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export default function OrganizerPaymentsOnboardingPage() {
  return (
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <AuthHeader />

      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-10">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
        >
          ← Tableau de bord
        </Link>

        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-white">Configurer les paiements</h1>
          <p className="mt-1 text-sm text-gray-500">
            Nécessaire pour recevoir les reversements de tes événements.
          </p>
        </div>

        <OnboardingFlow />
      </main>
    </div>
  );
}
