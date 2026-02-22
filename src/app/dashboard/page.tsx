import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { BRANCHE_CONFIG, type Branche } from "@/lib/branche-config";

export default async function DashboardPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    redirect("/login");
  }

  if (!user) {
    redirect("/login");
  }

  // Firma inkl. Branche laden
  const firma = await prisma.firma.findUnique({
    where: { id: user.firmaId },
    select: { firmenname: true, strasse: true, branche: true },
  });

  const branche: Branche = (firma?.branche as Branche) ?? "MALER";
  const config = BRANCHE_CONFIG[branche];

  // Counts laden basierend auf Branche
  let counts: Record<string, number> = {};
  let hasKalkRegeln = false;
  const hasFirma = !!(firma?.firmenname && firma?.strasse);

  try {
    const kundenCount = await prisma.kunde.count({ where: { firmaId: user.firmaId } });
    const angeboteCount = await prisma.angebot.count({ where: { firmaId: user.firmaId } });
    counts = { kunden: kundenCount, angebote: angeboteCount };

    if (branche === "FEWO") {
      const [unterkuenfteCount, saisonsCount] = await Promise.all([
        prisma.unterkunft.count({ where: { firmaId: user.firmaId } }),
        prisma.saison.count({ where: { firmaId: user.firmaId } }),
      ]);
      counts.unterkuenfte = unterkuenfteCount;
      counts.saisons = saisonsCount;
    } else if (branche === "SHOP") {
      const produkteCount = await prisma.produkt.count({ where: { firmaId: user.firmaId } });
      counts.produkte = produkteCount;
    } else if (branche === "FAHRRAD") {
      const [fahrraederCount, staffelnCount] = await Promise.all([
        prisma.fahrrad.count({ where: { firmaId: user.firmaId } }),
        prisma.mietdauerStaffel.count({ where: { firmaId: user.firmaId } }),
      ]);
      counts.fahrraeder = fahrraederCount;
      counts.staffeln = staffelnCount;
    } else {
      const [materialCount, leistungenCount, kalkRegeln] = await Promise.all([
        prisma.material.count({ where: { firmaId: user.firmaId } }),
        prisma.leistung.count({ where: { firmaId: user.firmaId } }),
        prisma.kalkulationsRegeln.findUnique({ where: { firmaId: user.firmaId } }),
      ]);
      counts.materialien = materialCount;
      counts.leistungen = leistungenCount;
      hasKalkRegeln = !!kalkRegeln;
    }
  } catch (error) {
    console.error("Dashboard DB-Fehler:", error);
  }

  // Setup-Checks aus branche-config
  const setupStatus: Record<string, boolean> = {
    hasFirma,
    hasMaterial: (counts.materialien ?? 0) > 0,
    hasLeistungen: (counts.leistungen ?? 0) > 0,
    hasKalkRegeln,
    hasAngebote: (counts.angebote ?? 0) > 0,
    hasProdukte: (counts.produkte ?? 0) > 0,
    hasUnterkuenfte: (counts.unterkuenfte ?? 0) > 0,
    hasSaisons: (counts.saisons ?? 0) > 0,
    hasFahrraeder: (counts.fahrraeder ?? 0) > 0,
    hasMietdauerStaffeln: (counts.staffeln ?? 0) > 0,
  };

  const setupChecks = config.setupChecks.map((c) => ({
    label: c.label,
    done: !!setupStatus[c.key],
  }));
  const setupDone = setupChecks.filter((c) => c.done).length;
  const allDone = setupDone === setupChecks.length;

  // Dashboard-Stats aus branche-config
  const stats = config.dashboardStats.map((s) => ({
    ...s,
    value: counts[s.key] ?? 0,
  }));

  return (
    <>
      <Header
        title={`Willkommen, ${user.name}`}
        description={user.firma?.firmenname ?? ""}
      />
      <div className="p-8 space-y-8">
        {/* Setup-Fortschritt */}
        {!allDone && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-5 pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Einrichtung</h3>
                </div>
                <span className="text-sm text-muted-foreground">
                  {setupDone} von {setupChecks.length} erledigt
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(setupDone / setupChecks.length) * 100}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {setupChecks.map((c) => (
                  <Badge
                    key={c.label}
                    variant={c.done ? "default" : "outline"}
                    className="text-xs"
                  >
                    {c.done ? "\u2713" : "\u25CB"} {c.label}
                  </Badge>
                ))}
              </div>
              <Link
                href="/dashboard/tutorial"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <GraduationCap className="h-4 w-4" />
                Tutorial starten
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Link key={stat.key} href={stat.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Schnellstart</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {config.quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer border-primary/20 hover:border-primary/40">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-1">{action.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {action.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
