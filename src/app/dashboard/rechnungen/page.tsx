import { Header } from "@/components/dashboard/header";
import { RechnungenTable } from "./rechnungen-table";

export default function RechnungenPage() {
  return (
    <>
      <Header
        title="Rechnungen"
        description="Alle Rechnungen mit Status, Beträgen und Aktionen"
      />
      <div className="p-8">
        <RechnungenTable />
      </div>
    </>
  );
}
