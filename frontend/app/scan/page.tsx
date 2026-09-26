import { AuthHeader } from "@/components/layout/auth-header";
import { ScanConsole } from "@/components/scan/scan-console";

export default function ScanPage() {
  return (
    <div className="flex flex-1 flex-col bg-page">
      <AuthHeader />

      <main className="flex-1 px-6 py-10">
        <ScanConsole />
      </main>
    </div>
  );
}
