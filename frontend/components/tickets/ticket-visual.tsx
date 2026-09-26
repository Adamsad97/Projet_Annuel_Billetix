import { QrPlaceholder } from "@/components/tickets/qr-placeholder";
import { TicketQrReveal } from "@/components/tickets/ticket-qr-reveal";
import type { TicketDetail } from "@/lib/mock/ticket-detail";

export function TicketVisual({ ticket }: { ticket: TicketDetail }) {
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-blue-500/40 bg-card">
      {/* Bug corrigé : bandeau à couleur de marque fixe (ticket.band),
          jamais liée au thème — texte épinglé en blanc. */}
      <div className={`flex items-center justify-between ${ticket.band} px-6 py-4`}>
        <span className="text-lg font-extrabold tracking-tight text-white">BilletiX</span>
        <span className="text-xs text-white/80">#{ticket.reference}</span>
      </div>

      <div className="flex flex-col gap-1 px-6 py-5">
        <span className="text-2xl">{ticket.emoji}</span>
        <h1 className="text-xl font-bold text-ink-1">{ticket.eventName}</h1>
        <p className="text-sm font-medium text-accent">{ticket.categoryName}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-dashed border-hairline-2 px-6 py-5 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-5">Date</p>
          <p className="font-semibold text-ink-1">{ticket.dateLabel}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-5">Heure</p>
          <p className="font-semibold text-ink-1">{ticket.timeLabel}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-5">Lieu</p>
          <p className="font-semibold text-ink-1">{ticket.venueName}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-5">Adresse</p>
          <p className="font-semibold text-ink-1">
            {ticket.address}, {ticket.city}
          </p>
        </div>
      </div>

      <div className="border-t border-dashed border-hairline-2 bg-card px-6 py-4">
        <p className="text-xs uppercase tracking-wide text-ink-5">Porteur du billet</p>
        <p className="font-bold text-ink-1">{ticket.holderName}</p>
        <p className="text-xs text-ink-5">{ticket.buyerEmail}</p>
      </div>

      <div className="flex flex-col items-center gap-3 border-t border-dashed border-hairline-2 px-6 py-6">
        {ticket.status === "valid" && ticket.id ? (
          // Billet réel utilisable : QR masqué, demandé à l'API au clic.
          <TicketQrReveal ticketId={ticket.id} holderName={ticket.holderName} />
        ) : ticket.status === "valid" ? (
          <div className="w-40">
            <QrPlaceholder seed={ticket.reference} />
          </div>
        ) : null}
        <p className="text-center text-xs uppercase tracking-wide text-ink-5">
          {ticket.status === "valid"
            ? "Présentez ce code à l'entrée · usage unique"
            : ticket.status === "for_resale"
              ? "Ce billet est en cours de revente"
              : ticket.status === "cancelled"
                ? "Ce billet a été annulé ou remboursé"
                : "Ce billet a déjà été scanné"}
        </p>
      </div>

      <div className="flex items-center justify-between bg-hairline-1 px-6 py-3">
        <span className="text-sm font-medium text-ink-4">{ticket.categoryName}</span>
        <span className="text-lg font-bold text-ink-1">{ticket.priceLabel}</span>
      </div>
    </div>
  );
}
