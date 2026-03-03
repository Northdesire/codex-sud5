import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

interface CategoryLandingProps {
  title: string;
  subtitle: string;
  promise: string;
  highlights: string[];
  example: string;
  ctaText: string;
}

export function CategoryLanding({
  title,
  subtitle,
  promise,
  highlights,
  example,
  ctaText,
}: CategoryLandingProps) {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-5xl px-6 py-16 md:py-24 space-y-12">
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
              className="inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium hover:bg-muted/60"
            >
              Einloggen
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {highlights.map((item) => (
            <div key={item} className="rounded-xl border bg-card p-4 text-sm flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border bg-card p-6 md:p-8">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Beispiel</p>
          <p className="text-base md:text-lg leading-relaxed">{example}</p>
        </section>
      </section>
    </main>
  );
}
