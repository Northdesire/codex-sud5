import { Header } from "@/components/dashboard/header";

export default function KalkulationPage() {
  return (
    <>
      <Header
        title="Kalkulationsregeln"
        description="Material-Berechnung, Anfahrt, AI-Defaults und Flächen-Formeln"
      />
      <div className="p-8">
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Kalkulationsregeln — wird in Phase 2 gebaut
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Verschnitt-%, Anfahrtspauschalen, Fenster-/Türen-Abzüge und AI-Verhalten
          </p>
        </div>
      </div>
    </>
  );
}
