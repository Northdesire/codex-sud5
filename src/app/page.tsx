import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bike,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  Home,
  Paintbrush,
  Package,
  Upload,
} from "lucide-react";

export const metadata: Metadata = {
  title: "AIngebot | Angebote in 60 Sekunden",
  description:
    "AIngebot erstellt professionelle Angebote aus Sprachmemos, E-Mails oder Screenshots. Für Maler, Shop, Ferienwohnung und Fahrradverleih.",
};

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
    icon: Home,
    text: "Anreise, Abreise, Gäste und Extras in Sekunden als professionelles Angebot erzeugen.",
  },
  {
    href: "/fahrradverleih",
    title: "Fahrradverleih",
    icon: Bike,
    text: "Mietdauer, Radtypen und Zusatzoptionen automatisch strukturieren und bepreisen.",
  },
];

const pricing = [
  {
    name: "Basic",
    price: "29€",
    hint: "pro Monat",
    features: ["1 Benutzer", "Angebotserstellung per AI", "PDF-Export"],
    cta: "Basic testen",
    highlight: false,
  },
  {
    name: "Pro",
    price: "49€",
    hint: "pro Monat",
    features: [
      "Unbegrenzte Angebote",
      "Eigene Produktdatenbank",
      "Branchenspezifische Vorlagen",
      "Rechnungsmodul",
    ],
    cta: "Pro testen",
    highlight: true,
  },
  {
    name: "Premium",
    price: "79€",
    hint: "pro Monat",
    features: ["Team-Zugänge", "Angebots-Tracking", "API/Integrationen", "Priorisierter Support"],
    cta: "Premium testen",
    highlight: false,
  },
];

const faqs = [
  {
    question: "Für wen ist AIngebot gebaut?",
    answer:
      "Für kleine und mittlere Betriebe, die regelmäßig Angebote schreiben und schneller reagieren wollen: aktuell Maler, Shop/E-Commerce, Ferienwohnung und Fahrradverleih.",
  },
  {
    question: "Wie schnell bin ich startklar?",
    answer:
      "In der Regel in wenigen Minuten. Du legst dein Konto an, wählst die Branche und kannst sofort die erste Anfrage in ein Angebot umwandeln.",
  },
  {
    question: "Kann ich Inhalte vor dem Versand bearbeiten?",
    answer:
      "Ja. Die AI erstellt den Entwurf, du prüfst und passt Positionen, Texte oder Preise an, bevor das Angebot als PDF versendet wird.",
  },
  {
    question: "Gibt es eine Testphase?",
    answer: "Ja, 14 Tage kostenlos testen. Danach kannst du den passenden Plan wählen.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(26,107,60,0.2),transparent_46%),radial-gradient(circle_at_bottom_left,rgba(212,168,67,0.22),transparent_40%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-12 md:py-20">
          <header className="mb-12 flex items-center justify-between">
            <Link href="/" className="text-sm font-semibold tracking-wide">
              AIngebot
            </Link>
            <div className="flex items-center gap-2 md:gap-3">
              <Link
                href="/login"
                className="rounded-lg border bg-background/90 px-4 py-2 text-sm font-medium hover:bg-muted/60"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Kostenlos starten
              </Link>
            </div>
          </header>

          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div className="space-y-6">
              <p className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-1.5 text-xs font-medium">
                <Clock3 className="h-3.5 w-3.5 text-primary" />
                Angebots-Erstellung in 60 Sekunden
              </p>
              <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">
                Schreib dein Angebot wie eine Sprachnachricht
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                AIngebot verwandelt Anfrage-Texte, Screenshots und Sprachmemos in
                strukturierte, professionelle Angebote. Ohne Word-Template, ohne Copy-Paste.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  14 Tage kostenlos testen
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/maler"
                  className="inline-flex items-center gap-2 rounded-lg border bg-background/90 px-5 py-3 text-sm font-medium hover:bg-muted/60"
                >
                  Branchen ansehen
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border bg-card/95 p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Vorher vs. Nachher</p>
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="font-medium mb-1">Vorher</p>
                  <p className="text-muted-foreground">
                    20-40 Minuten pro Angebot, Daten aus WhatsApp/E-Mail manuell übertragen.
                  </p>
                </div>
                <div className="rounded-lg border bg-primary/5 p-3">
                  <p className="font-medium mb-1">Nachher mit AIngebot</p>
                  <p className="text-muted-foreground">
                    60 Sekunden bis zum Entwurf, strukturierte Positionen, sofort versandbares PDF.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-2xl font-semibold">60 Sek.</p>
            <p className="text-sm text-muted-foreground">bis zum Angebotsentwurf</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-2xl font-semibold">4 Branchen</p>
            <p className="text-sm text-muted-foreground">mit eigener Logik & Workflows</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-2xl font-semibold">14 Tage</p>
            <p className="text-sm text-muted-foreground">kostenlos testen</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-2xl font-semibold">SaaS</p>
            <p className="text-sm text-muted-foreground">ab 29€ pro Monat</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-2xl md:text-3xl font-semibold mb-6">In 3 Schritten zum Angebot</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-card p-5">
            <Upload className="h-5 w-5 text-primary mb-3" />
            <h3 className="font-semibold mb-2">1. Anfrage hochladen</h3>
            <p className="text-sm text-muted-foreground">
              Text, Sprachmemo oder Screenshot einfügen und direkt starten.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <BrainCircuit className="h-5 w-5 text-primary mb-3" />
            <h3 className="font-semibold mb-2">2. AI extrahiert Positionen</h3>
            <p className="text-sm text-muted-foreground">
              Kundendaten, Mengen und Leistungen werden strukturiert erkannt.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <FileSpreadsheet className="h-5 w-5 text-primary mb-3" />
            <h3 className="font-semibold mb-2">3. Angebot versenden</h3>
            <p className="text-sm text-muted-foreground">
              Entwurf prüfen, PDF erzeugen, versenden und nachverfolgen.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
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

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-2xl md:text-3xl font-semibold mb-6">Preise</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {pricing.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-6 ${
                plan.highlight ? "bg-primary text-primary-foreground border-primary/60" : "bg-card"
              }`}
            >
              <p className={`text-sm ${plan.highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {plan.name}
              </p>
              <p className="mt-2 text-4xl font-semibold">{plan.price}</p>
              <p className={`text-sm ${plan.highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {plan.hint}
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <CheckCircle2 className={`mt-0.5 h-4 w-4 ${plan.highlight ? "text-primary-foreground" : "text-primary"}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className={`mt-6 inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-medium ${
                  plan.highlight
                    ? "bg-background text-foreground hover:opacity-90"
                    : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-2xl md:text-3xl font-semibold mb-6">Häufige Fragen</h2>
        <div className="space-y-3">
          {faqs.map((item) => (
            <details key={item.question} className="rounded-xl border bg-card p-4">
              <summary className="cursor-pointer font-medium">{item.question}</summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 md:pb-24">
        <div className="rounded-2xl border bg-primary p-6 md:p-10 text-primary-foreground">
          <h2 className="text-2xl md:text-4xl font-semibold mb-3">Bereit für dein erstes Angebot in 60 Sekunden?</h2>
          <p className="text-primary-foreground/85 mb-6">
            Starte jetzt den kostenlosen Test und prüfe den kompletten Flow mit deinem echten Anfrage-Text.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-background px-5 py-3 text-sm font-medium text-foreground hover:opacity-90"
            >
              Jetzt kostenlos starten
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-primary-foreground/40 bg-transparent px-5 py-3 text-sm font-medium hover:bg-primary-foreground/10"
            >
              Zum Login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
