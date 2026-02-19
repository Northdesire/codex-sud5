"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { HelpTour } from "@/components/dashboard/help-tour";

interface KalkRegeln {
  verschnittFaktor: number;
  standardAnstriche: number;
  grundierungImmer: boolean;
  abklebebandProRaum: number;
  abdeckfolieProRaum: number;
  acrylProRaum: number;
  anfahrtKlein: number;
  anfahrtGross: number;
  anfahrtSchwelle: number;
  fensterAbzug: number;
  tuerAbzug: number;
  standardQualitaet: string;
  deckeStandard: boolean;
  grundierungStandard: boolean;
  zuschlagAutoErkennen: boolean;
}

const DEFAULTS: KalkRegeln = {
  verschnittFaktor: 10,
  standardAnstriche: 2,
  grundierungImmer: true,
  abklebebandProRaum: 2,
  abdeckfolieProRaum: 1,
  acrylProRaum: 0,
  anfahrtKlein: 35,
  anfahrtGross: 55,
  anfahrtSchwelle: 3,
  fensterAbzug: 1.5,
  tuerAbzug: 2.0,
  standardQualitaet: "standard",
  deckeStandard: false,
  grundierungStandard: true,
  zuschlagAutoErkennen: true,
};

export default function KalkulationPage() {
  return <Suspense><KalkulationContent /></Suspense>;
}

function KalkulationContent() {
  const searchParams = useSearchParams();
  const guideMode = searchParams.get("guide") === "1";

  const [regeln, setRegeln] = useState<KalkRegeln>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/kalkregeln")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) setRegeln({ ...DEFAULTS, ...data });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/kalkregeln", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regeln),
      });
      if (!res.ok) throw new Error();
      toast.success("Kalkulationsregeln gespeichert");
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof KalkRegeln>(key: K, value: KalkRegeln[K]) {
    setRegeln((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <>
        <Header title="Kalkulationsregeln" description="Material-Berechnung, Anfahrt und Flächen-Formeln" />
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Kalkulationsregeln"
        description="Material-Berechnung, Anfahrt und Flächen-Formeln"
        actions={
          <div className="flex gap-2">
            <HelpTour
              autoStart={guideMode && !loading}
              steps={[
                { element: "[data-tour='material-berechnung']", popover: { title: "Material-Berechnung", description: "Verschnitt-Faktor wird auf den Materialbedarf aufgeschlagen (Standard 10%). Standard-Anstriche gelten wenn das Material keine eigene Angabe hat. Die Defaults passen für die meisten Betriebe." } },
                { element: "[data-tour='anfahrt']", popover: { title: "Anfahrtspauschale", description: "Wird automatisch auf jedes Angebot addiert. Klein = wenige Räume, Gross = viele Räume. Ab der Schwelle (Raumanzahl) gilt die Groß-Pauschale." } },
                { element: "[data-tour='abzuege']", popover: { title: "Flächen-Abzüge", description: "Pro Fenster/Tür wird diese m²-Zahl von der Wandfläche abgezogen. Standard: 1,5 m² pro Fenster, 2 m² pro Tür. Kannst du anpassen wenn deine Fenster/Türen grösser oder kleiner sind." } },
              ]}
            />
            <Button variant="outline" size="sm" onClick={() => setRegeln(DEFAULTS)}>
              <RotateCcw className="h-4 w-4 mr-1" /> Defaults
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Speichern
            </Button>
          </div>
        }
      />
      <div className="p-8 max-w-4xl space-y-6">
        {/* Material-Berechnung */}
        <Card data-tour="material-berechnung">
          <CardHeader>
            <CardTitle className="text-base">Material-Berechnung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Verschnitt-Faktor (%)</Label>
                <Input
                  type="number" step="1" min="0" max="50"
                  value={regeln.verschnittFaktor}
                  onChange={(e) => update("verschnittFaktor", parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground mt-1">Aufschlag auf Materialbedarf</p>
              </div>
              <div>
                <Label>Standard-Anstriche</Label>
                <Input
                  type="number" step="1" min="1" max="3"
                  value={regeln.standardAnstriche}
                  onChange={(e) => update("standardAnstriche", parseInt(e.target.value) || 2)}
                />
                <p className="text-xs text-muted-foreground mt-1">Wenn Material keine Angabe hat</p>
              </div>
              <div>
                <Label>Grundierung immer</Label>
                <div className="flex items-center gap-2 h-9 mt-0.5">
                  <button
                    onClick={() => update("grundierungImmer", !regeln.grundierungImmer)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      regeln.grundierungImmer ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      regeln.grundierungImmer ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                  <Badge variant={regeln.grundierungImmer ? "default" : "secondary"} className="text-xs">
                    {regeln.grundierungImmer ? "Ja" : "Nein"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Verbrauchsmaterial */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verbrauchsmaterial pro Raum</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Abklebeband (Rollen)</Label>
                <Input
                  type="number" step="1" min="0"
                  value={regeln.abklebebandProRaum}
                  onChange={(e) => update("abklebebandProRaum", parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Abdeckfolie (Stk.)</Label>
                <Input
                  type="number" step="1" min="0"
                  value={regeln.abdeckfolieProRaum}
                  onChange={(e) => update("abdeckfolieProRaum", parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Acryl-Kartuschen</Label>
                <Input
                  type="number" step="1" min="0"
                  value={regeln.acrylProRaum}
                  onChange={(e) => update("acrylProRaum", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Anfahrt */}
        <Card data-tour="anfahrt">
          <CardHeader>
            <CardTitle className="text-base">Anfahrtspauschale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Klein-Auftrag</Label>
                <div className="relative">
                  <Input
                    type="number" step="5" min="0"
                    value={regeln.anfahrtKlein}
                    onChange={(e) => update("anfahrtKlein", parseFloat(e.target.value) || 0)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                </div>
              </div>
              <div>
                <Label>Groß-Auftrag</Label>
                <div className="relative">
                  <Input
                    type="number" step="5" min="0"
                    value={regeln.anfahrtGross}
                    onChange={(e) => update("anfahrtGross", parseFloat(e.target.value) || 0)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                </div>
              </div>
              <div>
                <Label>Schwelle (Räume)</Label>
                <Input
                  type="number" step="1" min="1"
                  value={regeln.anfahrtSchwelle}
                  onChange={(e) => update("anfahrtSchwelle", parseInt(e.target.value) || 3)}
                />
                <p className="text-xs text-muted-foreground mt-1">Ab dieser Raumzahl: Groß-Pauschale</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Flächen-Abzüge */}
        <Card data-tour="abzuege">
          <CardHeader>
            <CardTitle className="text-base">Flächen-Abzüge</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fenster-Abzug (m²)</Label>
                <Input
                  type="number" step="0.1" min="0"
                  value={regeln.fensterAbzug}
                  onChange={(e) => update("fensterAbzug", parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground mt-1">Pro Fenster von Wandfläche abziehen</p>
              </div>
              <div>
                <Label>Tür-Abzug (m²)</Label>
                <Input
                  type="number" step="0.1" min="0"
                  value={regeln.tuerAbzug}
                  onChange={(e) => update("tuerAbzug", parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground mt-1">Pro Tür von Wandfläche abziehen</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI-Defaults */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI-Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Standard-Qualität</Label>
                <select
                  className="w-full h-9 rounded-md border px-3 text-sm"
                  value={regeln.standardQualitaet}
                  onChange={(e) => update("standardQualitaet", e.target.value)}
                >
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
              <div>
                <Label>Decke standard</Label>
                <div className="flex items-center gap-2 h-9 mt-0.5">
                  <button
                    onClick={() => update("deckeStandard", !regeln.deckeStandard)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      regeln.deckeStandard ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      regeln.deckeStandard ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                  <Badge variant={regeln.deckeStandard ? "default" : "secondary"} className="text-xs">
                    {regeln.deckeStandard ? "Ja" : "Nein"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Decke immer mitnehmen?</p>
              </div>
              <div>
                <Label>Zuschläge auto</Label>
                <div className="flex items-center gap-2 h-9 mt-0.5">
                  <button
                    onClick={() => update("zuschlagAutoErkennen", !regeln.zuschlagAutoErkennen)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      regeln.zuschlagAutoErkennen ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      regeln.zuschlagAutoErkennen ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                  <Badge variant={regeln.zuschlagAutoErkennen ? "default" : "secondary"} className="text-xs">
                    {regeln.zuschlagAutoErkennen ? "An" : "Aus"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Zuschläge automatisch berechnen</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
