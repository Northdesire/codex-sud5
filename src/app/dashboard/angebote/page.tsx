import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import { AngeboteTable } from "./angebote-table";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export default function AngebotePage() {
  return (
    <>
      <Header
        title="Angebote"
        description="Alle erstellten Angebote mit Status und Beträgen"
        actions={
          <Link href="/dashboard/angebote/import">
            <Button size="sm" variant="outline">
              <Upload className="h-4 w-4 mr-1" /> Altes Angebot importieren
            </Button>
          </Link>
        }
      />
      <div className="p-8">
        <AngeboteTable />
      </div>
    </>
  );
}
