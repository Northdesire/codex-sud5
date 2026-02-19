"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  ClipboardList,
  Paintbrush,
  Calculator,
  Sparkles,
  CheckCircle2,
  Circle,
  ArrowRight,
} from "lucide-react";
import { Loader2 } from "lucide-react";

interface SetupStatus {
  hasFirma: boolean;
  hasLeistungen: boolean;
  hasMaterial: boolean;
  hasKalkRegeln: boolean;
  hasAngebote: boolean;
}

const SCHRITTE = [
  {
    key: "hasFirma" as const,
    nr: 1,
    title: "Firmendaten",
    icon: Building2,
    href: "/dashboard/firma",
    warum:
      "Deine Firmendaten erscheinen auf jedem Angebot: Briefkopf, Fusszeile, Bankverbindung.",
    beispiel:
      "Firmenname, Adresse, Telefon, IBAN, Logo hochladen.",
    color: "text-blue-600",
  },
  {
    key: "hasMaterial" as const,
    nr: 2,
    title: "Material & Preise",
    icon: Paintbrush,
    href: "/dashboard/material",
    warum:
      "Materialien werden zuerst angelegt, weil Leistungen darauf verweisen. Jede Farbe, Grundierung oder Spachtel bekommt einen EK- und VK-Preis und eine Ergiebigkeit (m² pro Liter). Das Angebot berechnet daraus automatisch den Materialbedarf.",
    beispiel:
      'Lege z.B. an: "Caparol CapaMaxx" (Kategorie: Wandfarbe, VK 18,90 €/Liter, Ergiebigkeit 7 m²/Liter) und "Tiefengrund" (Kategorie: Grundierung, VK 8,50 €/Liter).',
    color: "text-emerald-600",
  },
  {
    key: "hasLeistungen" as const,
    nr: 3,
    title: "Leistungen anlegen",
    icon: ClipboardList,
    href: "/dashboard/leistungen",
    warum:
      "Leistungen sind deine Arbeitspreise pro m². Jede Leistung kann mit einer Material-Kategorie verknüpft werden — z.B. 'Wände streichen' mit Wandfarbe. So weiss die Kalkulation, welches Material automatisch berechnet wird. Ohne Leistung = kein Arbeitspreis auf dem Angebot.",
    beispiel:
      'Lege z.B. an: "Wände streichen Standard" (Kategorie: Streichen, 8,50 €/m², Material: Wandfarbe) und "Wände streichen Premium" (12 €/m², Material: Wandfarbe). Für Vorarbeiten: "Grundierung" (3 €/m², Material: Grundierung).',
    color: "text-amber-600",
  },
  {
    key: "hasKalkRegeln" as const,
    nr: 4,
    title: "Kalkulationsregeln",
    icon: Calculator,
    href: "/dashboard/kalkulation",
    warum:
      "Hier stellst du ein, wie die Kalkulation rechnet: Wieviel Verschnitt aufgeschlagen wird, wieviele Anstriche Standard sind und wie hoch die Anfahrtspauschale ist. Diese Werte gelten für alle Angebote.",
    beispiel:
      "Verschnitt 10% (= 10% mehr Material), 2 Anstriche, Anfahrt klein 35 € / gross 55 €, Fenster-Abzug 1,5 m² pro Fenster.",
    color: "text-purple-600",
  },
  {
    key: "hasAngebote" as const,
    nr: 5,
    title: "Erstes Angebot erstellen",
    icon: Sparkles,
    href: "/app/ai",
    warum:
      "Alles testen: AI-Eingabe oder Formular ausfüllen und das erste Angebot generieren.",
    beispiel:
      'Text eingeben wie: "3 Zimmer streichen, Wohnzimmer 5x4m, Schlafzimmer 4x3.5m".',
    color: "text-rose-600",
  },
];

export default function TutorialPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/setup-status")
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() =>
        setStatus({
          hasFirma: false,
          hasLeistungen: false,
          hasMaterial: false,
          hasKalkRegeln: false,
          hasAngebote: false,
        })
      )
      .finally(() => setLoading(false));
  }, []);

  const doneCount = status
    ? SCHRITTE.filter((s) => status[s.key]).length
    : 0;

  return (
    <>
      <Header
        title="Einrichtungs-Guide"
        description="In 5 Schritten zum ersten Angebot"
      />
      <div className="p-8 max-w-3xl space-y-6">
        {/* Fortschrittsbalken */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Fortschritt</span>
                <span className="text-muted-foreground">
                  {doneCount} von {SCHRITTE.length} erledigt
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{
                    width: `${(doneCount / SCHRITTE.length) * 100}%`,
                  }}
                />
              </div>
              <div className="flex gap-1.5">
                {SCHRITTE.map((s) => {
                  const done = status?.[s.key] ?? false;
                  return (
                    <Badge
                      key={s.key}
                      variant={done ? "default" : "outline"}
                      className="text-xs"
                    >
                      {done ? "✓" : "○"} {s.title}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Schritte */}
            <div className="space-y-4">
              {SCHRITTE.map((schritt) => {
                const done = status?.[schritt.key] ?? false;
                return (
                  <Card
                    key={schritt.key}
                    className={done ? "border-primary/30 bg-primary/5" : ""}
                  >
                    <CardContent className="pt-5 pb-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                              done
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <schritt.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">
                                {schritt.nr}. {schritt.title}
                              </h3>
                              {done ? (
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Warum */}
                      <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Warum?{" "}
                        </span>
                        {schritt.warum}
                      </div>

                      {/* Beispiel */}
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Beispiel:</span>{" "}
                        {schritt.beispiel}
                      </p>

                      <Link href={done ? schritt.href : `${schritt.href}?guide=1`}>
                        <Button
                          variant={done ? "outline" : "default"}
                          size="sm"
                          className="mt-1"
                        >
                          {done ? "Anzeigen" : "Jetzt einrichten"}
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
