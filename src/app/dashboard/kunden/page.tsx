import { Header } from "@/components/dashboard/header";

export default function KundenPage() {
  return (
    <>
      <Header
        title="Kundenstamm"
        description="Kunden verwalten, anlegen und durchsuchen"
      />
      <div className="p-8">
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Kundenstamm — wird in Phase 2 gebaut
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            CRUD-Verwaltung mit Suche, Import und Auto-Matching
          </p>
        </div>
      </div>
    </>
  );
}
