import { PageShell } from "@/components/layout/page-shell";
import { EditProfileForm } from "@/components/profile/edit-profile-form";
import { BackLink } from "@/components/ui/back-link";

export default function EditProfilePage() {
  return (
    <PageShell width="md">
      <BackLink href="/profil">Profil</BackLink>

      <h1 className="mb-6 text-xl font-bold text-ink-1">Modifier mon profil</h1>

      <EditProfileForm />
    </PageShell>
  );
}
