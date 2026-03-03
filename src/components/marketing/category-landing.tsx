import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";

interface CategoryLandingProps {
  title: string;
  subtitle: string;
  promise: string;
  highlights: string[];
  example: string;
  ctaText: string;
  painPoints: string[];
  workflow: Array<{ title: string; text: string }>;
  faq: Array<{ question: string; answer: string }>;
  proof: Array<{ label: string; value: string }>;
}

export function CategoryLanding({
  title,
  subtitle,
  promise,
  highlights,
  example,
  ctaText,
  painPoints,
  workflow,
  faq,
  proof,
}: CategoryLandingProps) {
  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(26,107,60,0.18),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(212,168,67,0.22),transparent_40%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-14 md:py-20">
          <div className="mb-8 flex items-center justify-between">
            <Link href="/" className="text-sm font-semibold tracking-wide">
              AIngebot
            </Link>
            <div className="flex items-center gap-2 text-sm">
              <Link href="/" className="text-muted-foreground hover:text-foreground">
                Startseite
              </Link>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{subtitle}</span>
            </div>
          </div>
          <div className="space-y-5">
            <p className="text-sm font-medium text-primary">{subtitle}</p>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">{title}</h1>
            <p className="text-lg text-muted-foreground max-w-3xl">{promise}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                {ctaText}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-lg border bg-background/90 px-5 py-3 text-sm font-medium hover:bg-muted/60"
              >
                Einloggen
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {proof.map((item) => (
            <div key={item.label} className="rounded-xl border bg-card p-4">
              <p className="text-2xl font-semibold">{item.value}</p>
              <p className="text-sm text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-4 md:py-8">
        <div className="rounded-2xl border bg-card p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">Wo heute Zeit verloren geht</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {painPoints.map((item) => (
              <div key={item} className="rounded-lg border bg-background px-4 py-3 text-sm">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-2xl md:text-3xl font-semibold mb-6">So läuft es mit AIngebot</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {workflow.map((step, index) => (
            <div key={step.title} className="rounded-xl border bg-card p-5">
              <p className="mb-2 text-xs font-medium text-primary">Schritt {index + 1}</p>
              <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-6">
        <div className="grid gap-4 md:grid-cols-2">
          {highlights.map((item) => (
            <div key={item} className="rounded-xl border bg-card p-4 text-sm flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8 md:py-12">
        <div className="rounded-2xl border bg-card p-6 md:p-8">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Beispiel</p>
          <p className="text-base md:text-lg leading-relaxed">{example}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8 md:py-12">
        <h2 className="text-2xl md:text-3xl font-semibold mb-6">Häufige Fragen</h2>
        <div className="space-y-3">
          {faq.map((item) => (
            <details key={item.question} className="rounded-xl border bg-card p-4">
              <summary className="cursor-pointer font-medium">{item.question}</summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 md:pb-24">
        <div className="rounded-2xl border bg-primary text-primary-foreground p-6 md:p-10">
          <h2 className="text-2xl md:text-4xl font-semibold mb-3">Teste den Flow in unter 5 Minuten</h2>
          <p className="text-primary-foreground/85 mb-6">
            Konto anlegen, Branche auswählen, erste Anfrage einfügen, Angebot erzeugen.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-background px-5 py-3 text-sm font-medium text-foreground hover:opacity-90"
          >
            {ctaText}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
