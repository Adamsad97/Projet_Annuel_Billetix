import { QrPlaceholder } from "@/components/tickets/qr-placeholder";
import type { TicketDetail } from "@/lib/mock/ticket-detail";

export function TicketVisual({ ticket }: { ticket: TicketDetail }) {
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-violet-500/40 bg-[#12101c]">
      <div className={`flex items-center justify-between bg-gradient-to-br ${ticket.band} px-6 py-4`}>
        <span className="text-lg font-extrabold tracking-tight text-white">BilletiX</span>
        <span className="text-xs text-white/80">#{ticket.reference}</span>
      </div>

      <div className="flex flex-col gap-1 px-6 py-5">
        <span className="text-2xl">{ticket.emoji}</span>
        <h1 className="text-xl font-bold text-white">{ticket.eventName}</h1>
        <p className="text-sm font-medium text-violet-300">{ticket.categoryName}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-dashed border-white/10 px-6 py-5 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Date</p>
          <p className="font-semibold text-white">{ticket.dateLabel}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Heure</p>
          <p className="font-semibold text-white">{ticket.timeLabel}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Lieu</p>
          <p className="font-semibold text-white">{ticket.venueName}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Adresse</p>
          <p className="font-semibold text-white">
            {ticket.address}, {ticket.city}
          </p>
        </div>
      </div>

      <div className="border-t border-dashed border-white/10 bg-[#0d0b16] px-6 py-4">
        <p className="text-xs uppercase tracking-wide text-gray-500">Porteur du billet</p>
        <p className="font-bold text-white">{ticket.holderName}</p>
        <p className="text-xs text-gray-500">{ticket.buyerEmail}</p>
      </div>

      <div className="flex flex-col items-center gap-3 border-t border-dashed border-white/10 px-6 py-6">
        <div className="w-40">
          {ticket.qrCodeUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URI généré côté serveur, pas une image à optimiser
            <img src={ticket.qrCodeUrl} alt="QR code du billet" className="w-full rounded-lg" />
          ) : (
            <QrPlaceholder seed={ticket.reference} />
          )}
        </div>
        <p className="text-center text-xs uppercase tracking-wide text-gray-500">
          {ticket.status === "valid"
            ? "Présentez ce code à l'entrée · usage unique"
            : ticket.status === "for_resale"
              ? "Ce billet est en cours de revente"
              : ticket.status === "cancelled"
                ? "Ce billet a été annulé ou remboursé"
                : "Ce billet a déjà été scanné"}
        </p>
      </div>

      <div className="flex items-center justify-between bg-white/[0.03] px-6 py-3">
        <span className="text-sm font-medium text-gray-400">{ticket.categoryName}</span>
        <span className="text-lg font-bold text-white">{ticket.priceLabel}</span>
      </div>
    </div>
  );
}
