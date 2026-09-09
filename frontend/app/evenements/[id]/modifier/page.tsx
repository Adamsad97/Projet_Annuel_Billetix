import { notFound } from "next/navigation";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/auth-header";
import {
  CreateEventForm,
  type CreateEventFormInitial,
} from "@/components/create-event/create-event-form";
import { eventDetails } from "@/lib/mock/event-details";
import { listCategories } from "@/lib/api/categories";

export function generateStaticParams() {
  return Object.keys(eventDetails).map((id) => ({ id }));
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = eventDetails[id];
  const categories = await listCategories().catch(() => []);

  if (!event) {
    notFound();
  }

  const initial: CreateEventFormInitial = {
    title: event.title,
    description: event.description,
    category: event.categoryLabel.toLowerCase(),
    startAt: "2026-08-15T20:00",
    endAt: "2026-08-16T02:00",
    venueName: event.venueName,
    address: event.address,
    ticketTiers: event.tickets.map((ticket) => ({
      name: ticket.label,
      price: String(ticket.price),
      quota: "500",
      maxPerOrder: "4",
    })),
  };

  return (
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <AuthHeader />

      <main className="flex-1 px-6 py-10">
        <Link
          href={`/dashboard/evenements/${id}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
        >
          ← Retour à l&apos;événement
        </Link>

        <div className="mb-10 text-center">
          <h1 className="text-2xl font-bold text-white">
            Modifier « {event.title} »
          </h1>
          <p className="mt-1 text-sm text-violet-300">
            Les changements substantiels repassent en file de validation.
          </p>
        </div>

        <CreateEventForm categories={categories} initial={initial} mode="edit" />
      </main>
    </div>
  );
}
