import { Navbar } from "@/components/layout/navbar";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";

export default function CheckoutPage() {
  return (
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <Navbar active="/catalogue" />

      <main className="flex-1 px-6 py-10">
        <CheckoutFlow />
      </main>
    </div>
  );
}
