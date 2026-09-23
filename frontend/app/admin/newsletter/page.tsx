import { AdminShell } from "@/components/layout/admin-shell";
import { NewsletterComposer } from "@/components/admin/newsletter-composer";

export default function AdminNewsletterPage() {
  return (
    <AdminShell active="/admin/newsletter">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Newsletter</h1>
        <p className="mt-1 text-sm text-gray-500">
          Envoie un email ponctuel à tous les acheteurs abonnés à la newsletter
          depuis leurs préférences de notification.
        </p>
      </div>

      <NewsletterComposer />
    </AdminShell>
  );
}
