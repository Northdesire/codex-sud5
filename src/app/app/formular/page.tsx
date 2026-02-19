"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Trash2, Rocket, Wrench } from "lucide-react";
import { toast } from "sonner";

interface Raum {
  name: string;
  laenge: number;
  breite: number;
  hoehe: number;
  fenster: number;
  tueren: number;
}

interface ExtraItem {
  bezeichnung: string;
  kategorie: string;
  schaetzMenge: number;
  einheit: string;
  aktiv: boolean;
}

interface FormData {
  kunde: {
    name: string;
    strasse: string;
    plz: string;
    ort: string;
    email: string;
    telefon: string;
  };
  raeume: Raum[];
  optionen: {
    qualitaet: "standard" | "premium";
    decke: boolean;
    spachteln: boolean;
  };
}

const LEER_RAUM: Raum = {
  name: "Neuer Raum",
  laenge: 4.0,
  breite: 3.5,
  hoehe: 2.55,
  fenster: 1,
  tueren: 1,
};

export default function FormularPage() {
  const router = useRouter();
  const [generiert, setGeneriert] = useState(false);
  const [extras, setExtras] = useState<ExtraItem[]>([]);
  const [form, setForm] = useState<FormData>({
    kunde: { name: "", strasse: "", plz: "", ort: "", email: "", telefon: "" },
    raeume: [{ ...LEER_RAUM, name: "Wohnzimmer" }],
    optionen: { qualitaet: "standard", decke: false, spachteln: false },
  });

  // AI-Ergebnis aus sessionStorage laden
  useEffect(() => {
    const aiData = sessionStorage.getItem("ai-ergebnis");
    if (aiData) {
      try {
        const parsed = JSON.parse(aiData);
        setForm({
          kunde: parsed.kunde || form.kunde,
          raeume:
            parsed.raeume?.length > 0
              ? parsed.raeume
              : form.raeume,
          optionen: {
            qualitaet: parsed.optionen?.qualitaet || "standard",
            decke: parsed.optionen?.decke || false,
            spachteln: parsed.optionen?.spachteln || false,
          },
        });

        // Load extras from AI result
        if (Array.isArray(parsed.extras) && parsed.extras.length > 0) {
          const loadedExtras: ExtraItem[] = parsed.extras.map(
            (e: string | { bezeichnung: string; kategorie: string; schaetzMenge: number; einheit: string }) =>
              typeof e === "string"
                ? { bezeichnung: e, kategorie: "SONSTIGES", schaetzMenge: 1, einheit: "pauschal", aktiv: true }
                : { ...e, aktiv: true }
          );
          setExtras(loadedExtras);
        }

        sessionStorage.removeItem("ai-ergebnis");
        toast.success("AI-Daten übernommen");
      } catch {
        // ignore
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateKunde(field: string, value: string) {
    setForm({
      ...form,
      kunde: { ...form.kunde, [field]: value },
    });
  }

  function updateRaum(index: number, field: string, value: string | number) {
    const raeume = [...form.raeume];
    raeume[index] = { ...raeume[index], [field]: value };
    setForm({ ...form, raeume });
  }

  function addRaum() {
    setForm({ ...form, raeume: [...form.raeume, { ...LEER_RAUM }] });
  }

  function removeRaum(index: number) {
    if (form.raeume.length <= 1) return;
    const raeume = form.raeume.filter((_, i) => i !== index);
    setForm({ ...form, raeume });
  }

  async function handleGenerieren() {
    if (!form.kunde.name) {
      toast.error("Bitte Kundennamen angeben");
      return;
    }
    if (form.raeume.length === 0) {
      toast.error("Mindestens ein Raum nötig");
      return;
    }

    setGeneriert(true);

    // Formulardaten + Originaltext in sessionStorage für Angebots-Seite
    const originalText = sessionStorage.getItem("ai-originaltext") || "";
    sessionStorage.setItem("formular-daten", JSON.stringify(form));
    sessionStorage.setItem("ai-originaltext", originalText);

    // Kalkulation über API
    try {
      const res = await fetch("/api/angebote/kalkulieren", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          extras: extras.filter((e) => e.aktiv).map(({ aktiv: _, ...rest }) => rest),
        }),
      });

      const kalkulation = await res.json();

      if (!res.ok) {
        throw new Error(kalkulation.error || "Kalkulation fehlgeschlagen");
      }

      sessionStorage.setItem("kalkulation", JSON.stringify(kalkulation));

      toast.success("Angebot erstellt!");
      router.push("/app/angebot");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
      toast.error(msg);
      setGeneriert(false);
    }
  }

  return (
    <div className="px-5 pt-6 space-y-4 pb-4">
      <div>
        <h1 className="text-xl font-bold">Angebot erstellen</h1>
        <p className="text-sm text-muted-foreground">
          Kundendaten und Räume prüfen
        </p>
      </div>

      {/* Kundendaten */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Kundendaten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Name *</Label>
            <Input
              value={form.kunde.name}
              onChange={(e) => updateKunde("name", e.target.value)}
              placeholder="Familie Müller"
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">E-Mail</Label>
              <Input
                value={form.kunde.email}
                onChange={(e) => updateKunde("email", e.target.value)}
                placeholder="email@beispiel.de"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Telefon</Label>
              <Input
                value={form.kunde.telefon}
                onChange={(e) => updateKunde("telefon", e.target.value)}
                placeholder="0176 ..."
                className="h-9"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Strasse</Label>
            <Input
              value={form.kunde.strasse}
              onChange={(e) => updateKunde("strasse", e.target.value)}
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">PLZ</Label>
              <Input
                value={form.kunde.plz}
                onChange={(e) => updateKunde("plz", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Ort</Label>
              <Input
                value={form.kunde.ort}
                onChange={(e) => updateKunde("ort", e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optionen */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Optionen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={form.optionen.qualitaet === "standard" ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() =>
                setForm({
                  ...form,
                  optionen: { ...form.optionen, qualitaet: "standard" },
                })
              }
            >
              Standard
            </Badge>
            <Badge
              variant={form.optionen.qualitaet === "premium" ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() =>
                setForm({
                  ...form,
                  optionen: { ...form.optionen, qualitaet: "premium" },
                })
              }
            >
              Premium
            </Badge>
            <Badge
              variant={form.optionen.decke ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() =>
                setForm({
                  ...form,
                  optionen: { ...form.optionen, decke: !form.optionen.decke },
                })
              }
            >
              Decke {form.optionen.decke ? "Ja" : "Nein"}
            </Badge>
            <Badge
              variant={form.optionen.spachteln ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() =>
                setForm({
                  ...form,
                  optionen: {
                    ...form.optionen,
                    spachteln: !form.optionen.spachteln,
                  },
                })
              }
            >
              Spachteln {form.optionen.spachteln ? "Ja" : "Nein"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Räume */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">
            Räume ({form.raeume.length})
          </h2>
          <Button variant="outline" size="sm" onClick={addRaum}>
            <Plus className="h-4 w-4 mr-1" />
            Raum
          </Button>
        </div>

        {form.raeume.map((raum, i) => (
          <Card key={i}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <Input
                  value={raum.name}
                  onChange={(e) => updateRaum(i, "name", e.target.value)}
                  className="h-8 font-medium border-none px-0 text-sm"
                />
                {form.raeume.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeRaum(i)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Länge (m)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={raum.laenge}
                    onChange={(e) =>
                      updateRaum(i, "laenge", parseFloat(e.target.value) || 0)
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Breite (m)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={raum.breite}
                    onChange={(e) =>
                      updateRaum(i, "breite", parseFloat(e.target.value) || 0)
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Höhe (m)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={raum.hoehe}
                    onChange={(e) =>
                      updateRaum(i, "hoehe", parseFloat(e.target.value) || 0)
                    }
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Fenster
                  </Label>
                  <Input
                    type="number"
                    value={raum.fenster}
                    onChange={(e) =>
                      updateRaum(i, "fenster", parseInt(e.target.value) || 0)
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Türen
                  </Label>
                  <Input
                    type="number"
                    value={raum.tueren}
                    onChange={(e) =>
                      updateRaum(i, "tueren", parseInt(e.target.value) || 0)
                    }
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Zusatzarbeiten / Extras */}
      {extras.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Zusatzarbeiten
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {extras.map((extra, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                  extra.aktiv ? "bg-muted/50" : "bg-muted/20 opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={extra.aktiv}
                  onChange={() => {
                    const updated = [...extras];
                    updated[i] = { ...updated[i], aktiv: !updated[i].aktiv };
                    setExtras(updated);
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{extra.bezeichnung}</p>
                  <p className="text-xs text-muted-foreground">{extra.kategorie}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.1"
                    value={extra.schaetzMenge}
                    onChange={(e) => {
                      const updated = [...extras];
                      updated[i] = { ...updated[i], schaetzMenge: parseFloat(e.target.value) || 0 };
                      setExtras(updated);
                    }}
                    className="h-7 w-16 text-sm text-right"
                    disabled={!extra.aktiv}
                  />
                  <span className="text-xs text-muted-foreground w-12">{extra.einheit}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Generieren Button */}
      <Button
        className="w-full h-12 text-base"
        onClick={handleGenerieren}
        disabled={generiert}
      >
        {generiert ? (
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
        ) : (
          <Rocket className="h-5 w-5 mr-2" />
        )}
        {generiert ? "Wird berechnet..." : "Angebot generieren"}
      </Button>
    </div>
  );
}
