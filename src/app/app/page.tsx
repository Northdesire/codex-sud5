import Link from "next/link";
import { Brain, FileText, BarChart3 } from "lucide-react";

export default function AppHome() {
  return (
    <div className="px-5 pt-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
          AI
        </div>
        <div>
          <h1 className="text-xl font-bold">AIngebot</h1>
          <p className="text-xs text-muted-foreground">
            Intelligente Angebote in 2 Minuten
          </p>
        </div>
      </div>

      {/* Main Actions */}
      <div className="space-y-3">
        <Link href="/app/ai">
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Brain className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-lg font-bold">AI-Eingabe</h2>
                <p className="text-sm text-muted-foreground">
                  Text einfügen oder sprechen — AI macht den Rest
                </p>
              </div>
            </div>
          </div>
        </Link>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/app/formular">
            <div className="rounded-2xl border p-4 active:scale-[0.98] transition-transform h-full">
              <FileText className="h-8 w-8 text-muted-foreground mb-2" />
              <h3 className="font-semibold text-sm">Manuelles Formular</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Klassische Eingabe
              </p>
            </div>
          </Link>
          <Link href="/app/uebersicht">
            <div className="rounded-2xl border p-4 active:scale-[0.98] transition-transform h-full">
              <BarChart3 className="h-8 w-8 text-muted-foreground mb-2" />
              <h3 className="font-semibold text-sm">Dashboard</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Offene Angebote
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Diesen Monat
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-muted-foreground">Angebote</p>
          </div>
          <div>
            <p className="text-2xl font-bold">0%</p>
            <p className="text-xs text-muted-foreground">Quote</p>
          </div>
          <div>
            <p className="text-2xl font-bold">0 €</p>
            <p className="text-xs text-muted-foreground">Volumen</p>
          </div>
        </div>
      </div>
    </div>
  );
}
