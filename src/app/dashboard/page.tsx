import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Paintbrush, ClipboardList, FileSpreadsheet } from "lucide-react";
import Link from "next/link";

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

  let kundenCount = 0;
  let materialCount = 0;
  let leistungenCount = 0;
  let angeboteCount = 0;

  try {
    [kundenCount, materialCount, leistungenCount, angeboteCount] =
      await Promise.all([
        prisma.kunde.count({ where: { firmaId: user.firmaId } }),
        prisma.material.count({ where: { firmaId: user.firmaId } }),
        prisma.leistung.count({ where: { firmaId: user.firmaId } }),
        prisma.angebot.count({ where: { firmaId: user.firmaId } }),
      ]);
  } catch (error) {
    console.error("Dashboard DB-Fehler:", error);
  }

  const stats = [
    {
      label: "Kunden",
      value: kundenCount,
      icon: Users,
      href: "/dashboard/kunden",
      color: "text-blue-600",
    },
    {
      label: "Materialien",
      value: materialCount,
      icon: Paintbrush,
      href: "/dashboard/material",
      color: "text-emerald-600",
    },
    {
      label: "Leistungen",
      value: leistungenCount,
      icon: ClipboardList,
      href: "/dashboard/leistungen",
      color: "text-amber-600",
    },
    {
      label: "Angebote",
      value: angeboteCount,
      icon: FileSpreadsheet,
      href: "/dashboard/angebote",
      color: "text-purple-600",
    },
  ];

  return (
    <>
      <Header
        title={`Willkommen, ${user.name}`}
        description={user.firma?.firmenname ?? ""}
      />
      <div className="p-8 space-y-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Link key={stat.label} href={stat.href}>
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
            <Link href="/dashboard/firma">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-primary/20 hover:border-primary/40">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-1">Firmendaten pflegen</h3>
                  <p className="text-sm text-muted-foreground">
                    Logo, Kontaktdaten und Einstellungen hinterlegen
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/material">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-primary/20 hover:border-primary/40">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-1">Material anlegen</h3>
                  <p className="text-sm text-muted-foreground">
                    Einkaufs- und Verkaufspreise verwalten
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/leistungen">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-primary/20 hover:border-primary/40">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-1">Leistungen definieren</h3>
                  <p className="text-sm text-muted-foreground">
                    Preise pro Einheit und Material-Verknüpfungen
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
