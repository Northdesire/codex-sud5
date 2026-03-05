"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, Circle, Loader2, Sparkles } from "lucide-react";
import { BRANCHE_CONFIG, type Branche, type TutorialStep } from "@/lib/branche-config";

interface SetupStatus {
  branche?: string;
  hasFirma: boolean;
  hasLeistungen: boolean;
  hasMaterial: boolean;
  hasKalkRegeln: boolean;
  hasAngebote: boolean;
  hasProdukte: boolean;
  hasUnterkuenfte: boolean;
  hasSaisons: boolean;
  hasFahrraeder?: boolean;
  hasFahrradExtras?: boolean;
  [key: string]: unknown;
}

export default function OnboardingPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [branche, setBranche] = useState<Branche>("MALER");

  useEffect(() => {
    fetch("/api/setup-status")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        if (data.branche) setBranche(data.branche as Branche);
      })
      .catch(() =>
        setStatus({
          hasFirma: false,
          hasLeistungen: false,
          hasMaterial: false,
          hasKalkRegeln: false,
          hasAngebote: false,
          hasProdukte: false,
          hasUnterkuenfte: false,
          hasSaisons: false,
          hasFahrraeder: false,
          hasFahrradExtras: false,
        })
      )
      .finally(() => setLoading(false));
  }, []);

  const config = BRANCHE_CONFIG[branche];
  const schritte = config.tutorialSteps;

  const isDone = (step: TutorialStep) => {
    if (!status) return false;
    return !!(status as Record<string, unknown>)[step.key];
  };

  const doneCount = status ? schritte.filter((s) => isDone(s)).length : 0;
  const progress = schritte.length > 0 ? Math.round((doneCount / schritte.length) * 100) : 0;

  const nextStep = schritte.find((s) => !isDone(s)) ?? null;

  return (
    <>
      <Header
        title="Onboarding"
        description={`In ${schritte.length} Schritten produktiv starten`}
      />
      <div className="p-8 max-w-4xl space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-5 pb-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-primary">Setup-Fortschritt</span>
                    </div>
                    <h2 className="text-lg font-semibold">
                      {doneCount} von {schritte.length} Schritten erledigt
                    </h2>
                  </div>
                  <Badge variant="outline">{progress}%</Badge>
                </div>

                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {nextStep ? (
                  <div className="rounded-md border bg-background p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Nächster Schritt</p>
                      <p className="font-medium">
                        {nextStep.nr}. {nextStep.title}
                      </p>
                    </div>
                    <Link href={`${nextStep.href}?guide=1`}>
                      <Button size="sm">
                        Jetzt starten
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-md border bg-background p-3">
                    <p className="font-medium">Setup abgeschlossen. Du kannst jetzt Angebote erstellen.</p>
                    <Link href="/app/ai" className="inline-block mt-2">
                      <Button size="sm">
                        Angebot starten
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              {schritte.map((schritt) => {
                const done = isDone(schritt);
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

                      <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Warum? </span>
                        {schritt.warum}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Beispiel:</span> {schritt.beispiel}
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
