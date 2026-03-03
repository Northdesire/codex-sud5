import Link from "next/link";
import { ArrowRight, Bike, Home as HomeIcon, Paintbrush, Package } from "lucide-react";

const categories = [
  {
    href: "/maler",
    title: "Malerbetrieb",
    icon: Paintbrush,
    text: "Räume, Flächen und Leistungen automatisch in ein kalkuliertes Angebot überführen.",
  },
  {
    href: "/shop",
    title: "Shop / E-Commerce",
    icon: Package,
    text: "Produkte, Mengen und Preise aus Anfrage oder E-Mail direkt als Angebot aufbereiten.",
  },
  {
    href: "/ferienwohnung",
    title: "Ferienwohnung",
    icon: HomeIcon,
    text: "Anreise, Abreise, Gäste und Extras in Sekunden als professionelles Angebot erzeugen.",
  },
  {
    href: "/fahrradverleih",
    title: "Fahrradverleih",
    icon: Bike,
    text: "Mietdauer, Radtypen und Zusatzoptionen automatisch strukturieren und bepreisen.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="max-w-4xl space-y-6">
          <p className="text-sm font-medium text-primary">AIngebot</p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">
            Schreib dein Angebot in 60 Sekunden
          </h1>
          <p className="text-lg text-muted-foreground">
            Anfrage, Sprachmemo oder Screenshot hochladen. AIngebot extrahiert
            Kundendaten, erkennt Positionen und erstellt ein professionelles Angebot.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Kostenlos starten
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium hover:bg-muted/60"
            >
              Einloggen
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-2xl md:text-3xl font-semibold mb-6">Branchenlösungen</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {categories.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl border bg-card p-6 hover:bg-muted/40 transition-colors">
              <item.icon className="h-6 w-6 text-primary mb-3" />
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground mb-3">{item.text}</p>
              <span className="text-sm font-medium inline-flex items-center gap-1">
                Mehr erfahren <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
