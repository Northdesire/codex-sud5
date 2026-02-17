import { Header } from "@/components/dashboard/header";

export default function RaumvorlagenPage() {
  return (
    <>
      <Header
        title="Raum-Vorlagen"
        description="Standard-Raumpresets für die Schnellauswahl in der App"
      />
      <div className="p-8">
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Raum-Vorlagen — wird in Phase 2 gebaut
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Kachel-Ansicht mit Standard-Wohnzimmer, Schlafzimmer, Bad etc.
          </p>
        </div>
      </div>
    </>
  );
}
