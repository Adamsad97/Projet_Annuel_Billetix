import Link from "next/link";
import { AuthHeader } from "@/components/layout/auth-header";
import { EditProfileForm } from "@/components/profile/edit-profile-form";

export default function EditProfilePage() {
  return (
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <AuthHeader />

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
        <Link
          href="/profil"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
        >
          ← Profil
        </Link>

        <h1 className="mb-6 text-xl font-bold text-white">Modifier mon profil</h1>

        <EditProfileForm />
      </main>
    </div>
  );
}
