import { AuthHeader } from "@/components/layout/auth-header";
import { LoginForm } from "@/components/auth/login-form";

export default function ConnexionPage() {
  return (
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <AuthHeader />

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[48rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-700/20 blur-3xl"
        />
        <div className="relative">
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
