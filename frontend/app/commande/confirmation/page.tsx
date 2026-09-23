import { Navbar } from "@/components/layout/navbar";
import { OrderConfirmation } from "@/components/checkout/order-confirmation";

export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string }>;
}) {
  const { order_id } = await searchParams;

  return (
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <Navbar active="/catalogue" />

      {!order_id ? (
        <main className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-gray-500">
          Aucune commande à afficher.
        </main>
      ) : (
        <OrderConfirmation orderId={order_id} />
      )}
    </div>
  );
}
