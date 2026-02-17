import { Header } from "@/components/dashboard/header";

export default function ZuschlaeaePage() {
  return (
    <>
      <Header
        title="Zuschläge & Rabatte"
        description="Automatische und manuelle Zuschläge, Kundenrabatte"
      />
      <div className="p-8">
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Zuschläge & Rabatte — wird in Phase 2 gebaut
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-Zuschläge (Höhe, Kleinfläche), manuelle Zuschläge und Rabattregeln
          </p>
        </div>
      </div>
    </>
  );
}
