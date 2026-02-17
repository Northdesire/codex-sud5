import { Header } from "@/components/dashboard/header";
import { AngeboteTable } from "./angebote-table";

export default function AngebotePage() {
  return (
    <>
      <Header
        title="Angebote"
        description="Alle erstellten Angebote mit Status und Beträgen"
      />
      <div className="p-8">
        <AngeboteTable />
      </div>
    </>
  );
}
