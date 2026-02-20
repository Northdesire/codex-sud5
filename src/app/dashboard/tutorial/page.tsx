"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, ArrowRight, Loader2 } from "lucide-react";
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
  [key: string]: unknown;
}

export default function TutorialPage() {
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

  return (
    <>
      <Header
        title="Einrichtungs-Guide"
        description={`In ${schritte.length} Schritten zum ersten Angebot`}
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
                  {doneCount} von {schritte.length} erledigt
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{
                    width: `${(doneCount / schritte.length) * 100}%`,
                  }}
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {schritte.map((s) => {
                  const done = isDone(s);
                  return (
                    <Badge
                      key={s.key}
                      variant={done ? "default" : "outline"}
                      className="text-xs"
                    >
                      {done ? "\u2713" : "\u25CB"} {s.title}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Schritte */}
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
