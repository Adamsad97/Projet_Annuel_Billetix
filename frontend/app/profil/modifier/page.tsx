import { PageShell } from "@/components/layout/page-shell";
import { EditProfileForm } from "@/components/profile/edit-profile-form";
import { BackLink } from "@/components/ui/back-link";
import { getT } from "@/lib/i18n/server";

export default async function EditProfilePage() {
  const t = await getT();
  return (
    <PageShell width="md">
      <BackLink href="/profil">{t("Profil")}</BackLink>

      <h1 className="mb-6 text-xl font-bold text-ink-1">{t("Modifier mon profil")}</h1>

      <EditProfileForm />
    </PageShell>
  );
}
