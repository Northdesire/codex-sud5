import Link from "next/link";
import { Brain, FileText, Receipt } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatEuro } from "@/lib/kalkulation";

const statusConfig: Record<string, { label: string; color: string }> = {
  ENTWURF: { label: "Entwurf", color: "bg-gray-100 text-gray-700" },
  OFFEN: { label: "Offen", color: "bg-blue-100 text-blue-700" },
  ANGENOMMEN: { label: "Angenommen", color: "bg-green-100 text-green-700" },
  ABGELEHNT: { label: "Abgelehnt", color: "bg-red-100 text-red-700" },
  ABGELAUFEN: { label: "Abgelaufen", color: "bg-yellow-100 text-yellow-700" },
};

export default async function AppHome() {
  let angeboteCount = 0;
  let quote = 0;
  let volumen = 0;
  let branche = "MALER";
  let recentAngebote: Array<{
    id: string;
    nummer: string;
    datum: Date;
    status: string;
    kundeName: string;
    brutto: number;
  }> = [];

  try {
    const user = await getCurrentUser();
    if (user) {
      branche = (user as unknown as { firma?: { branche?: string } }).firma?.branche ?? "MALER";
      const now = new Date();
      const monatsStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [countAll, countAngenommen, countAbgelehnt, sumResult, recent] =
        await Promise.all([
          prisma.angebot.count({
            where: { firmaId: user.firmaId, datum: { gte: monatsStart } },
          }),
          prisma.angebot.count({
            where: {
              firmaId: user.firmaId,
              datum: { gte: monatsStart },
              status: "ANGENOMMEN",
            },
          }),
          prisma.angebot.count({
            where: {
              firmaId: user.firmaId,
              datum: { gte: monatsStart },
              status: "ABGELEHNT",
            },
          }),
          prisma.angebot.aggregate({
            where: { firmaId: user.firmaId, datum: { gte: monatsStart } },
            _sum: { brutto: true },
          }),
          prisma.angebot.findMany({
            where: { firmaId: user.firmaId },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              nummer: true,
              datum: true,
              status: true,
              kundeName: true,
              brutto: true,
            },
          }),
        ]);

      angeboteCount = countAll;
      const entschieden = countAngenommen + countAbgelehnt;
      quote = entschieden > 0 ? Math.round((countAngenommen / entschieden) * 100) : 0;
      volumen = sumResult._sum.brutto ?? 0;
      recentAngebote = recent;
    }
  } catch {
    // Stats-Fehler ignorieren, Seite trotzdem laden
  }

  const isShop = branche === "SHOP";
  const isFewo = branche === "FEWO";

  return (
    <div className="px-5 pt-8 pb-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
          AI
        </div>
        <div>
          <h1 className="text-xl font-bold">AIngebot</h1>
          <p className="text-xs text-muted-foreground">
            Intelligente Angebote in 60 Sekunden
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
          <Link href={isFewo ? "/app/fewo-formular" : isShop ? "/app/shop-formular" : "/app/formular"}>
            <div className="rounded-2xl border p-4 active:scale-[0.98] transition-transform h-full">
              <FileText className="h-8 w-8 text-muted-foreground mb-2" />
              <h3 className="font-semibold text-sm">Manuelles Formular</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isFewo ? "Unterkunft & Aufenthalt eingeben" : isShop ? "Produkte & Preise eingeben" : "Klassische Eingabe"}
              </p>
            </div>
          </Link>
          {isShop ? (
            <Link href="/app/rechnungen">
              <div className="rounded-2xl border p-4 active:scale-[0.98] transition-transform h-full">
                <Receipt className="h-8 w-8 text-muted-foreground mb-2" />
                <h3 className="font-semibold text-sm">Rechnungen</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Offene Rechnungen
                </p>
              </div>
            </Link>
          ) : (
            <Link href="/app/uebersicht">
              <div className="rounded-2xl border p-4 active:scale-[0.98] transition-transform h-full">
                <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                <h3 className="font-semibold text-sm">Übersicht</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isFewo ? "Angebote verwalten" : "Offene Angebote"}
                </p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Diesen Monat
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{angeboteCount}</p>
            <p className="text-xs text-muted-foreground">Angebote</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{quote}%</p>
            <p className="text-xs text-muted-foreground">Quote</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{formatEuro(volumen)}</p>
            <p className="text-xs text-muted-foreground">Volumen</p>
          </div>
        </div>
      </div>

      {/* Recent Angebote */}
      {recentAngebote.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Letzte Angebote
            </h3>
            <Link
              href="/app/uebersicht"
              className="text-xs text-primary font-medium"
            >
              Alle anzeigen
            </Link>
          </div>
          <div className="space-y-1.5">
            {recentAngebote.map((a) => {
              const cfg = statusConfig[a.status] || statusConfig.ENTWURF;
              return (
                <Link key={a.id} href={`/app/uebersicht/${a.id}`}>
                  <div className="rounded-lg border p-3 flex justify-between items-center hover:bg-muted/50 transition-colors active:scale-[0.99]">
                    <div>
                      <p className="font-medium text-sm">{a.kundeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.nummer} &middot;{" "}
                        {new Date(a.datum).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span
                        className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.color}`}
                      >
                        {cfg.label}
                      </span>
                      <span className="font-mono text-sm font-medium">
                        {formatEuro(a.brutto)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
