"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Trash2, Rocket, Ruler, SquareIcon, ArrowLeft, Truck, X, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface ArbeitsbereichArbeiten {
  waendeStreichen: boolean;
  deckeStreichen: boolean;
  grundierung: boolean;
  spachteln: boolean;
  tapeteEntfernen: boolean;
  tapezieren: boolean;
}

interface Arbeitsbereich {
  name: string;
  typ: "RAUM" | "FLAECHE";
  laenge: number;
  breite: number;
  hoehe: number;
  fenster: number;
  tueren: number;
  wandflaeche: number;
  deckenflaeche: number;
  arbeiten: ArbeitsbereichArbeiten;
}

interface ExtraItem {
  bezeichnung: string;
  kategorie: string;
  schaetzMenge: number;
  einheit: string;
  einzelpreis?: number;
  aktiv: boolean;
}

interface RaumVorlage {
  id: string;
  name: string;
  icon: string | null;
  laenge: number;
  breite: number;
  hoehe: number;
  fenster: number;
  tueren: number;
}

interface LeistungInfo {
  id: string;
  name: string;
  kategorie: string;
  einheit: string;
  preisProEinheit: number;
}

interface Kunde {
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  email: string;
  telefon: string;
}

const DEFAULT_ARBEITEN: ArbeitsbereichArbeiten = {
  waendeStreichen: true,
  deckeStreichen: false,
  grundierung: true,
  spachteln: false,
  tapeteEntfernen: false,
  tapezieren: false,
};

const LEER_BEREICH: Arbeitsbereich = {
  name: "Neuer Raum",
  typ: "RAUM",
  laenge: 4.0,
  breite: 3.5,
  hoehe: 2.55,
  fenster: 1,
  tueren: 1,
  wandflaeche: 0,
  deckenflaeche: 0,
  arbeiten: { ...DEFAULT_ARBEITEN },
};

const FENSTER_ABZUG = 1.5;
const TUER_ABZUG = 2.0;

function berechneFlaechen(b: Arbeitsbereich) {
  if (b.typ === "FLAECHE") {
    return { wand: b.wandflaeche || 0, decke: b.deckenflaeche || 0 };
  }
  const wand = Math.max(
    0,
    2 * (b.laenge + b.breite) * b.hoehe -
      b.fenster * FENSTER_ABZUG -
      b.tueren * TUER_ABZUG
  );
  const decke = b.laenge * b.breite;
  return { wand: Math.round(wand * 100) / 100, decke: Math.round(decke * 100) / 100 };
}

type ArbeitKey = keyof ArbeitsbereichArbeiten;

const ARBEIT_LABELS: Record<ArbeitKey, string> = {
  waendeStreichen: "Wände streichen",
  deckeStreichen: "Decke streichen",
  grundierung: "Grundierung",
  spachteln: "Spachteln",
  tapeteEntfernen: "Tapete entfernen",
  tapezieren: "Tapezieren",
};

const ARBEIT_KATEGORIE: Record<ArbeitKey, string> = {
  waendeStreichen: "STREICHEN",
  deckeStreichen: "STREICHEN",
  grundierung: "VORBEREITUNG",
  spachteln: "VORBEREITUNG",
  tapeteEntfernen: "TAPEZIEREN",
  tapezieren: "TAPEZIEREN",
};

const ARBEIT_NAME_HINTS: Record<ArbeitKey, string[]> = {
  waendeStreichen: ["wand", "wänd"],
  deckeStreichen: ["decke"],
  grundierung: ["grundier"],
  spachteln: ["spachtel"],
  tapeteEntfernen: ["tapete entfern", "entfern"],
  tapezieren: ["tapezier"],
};

function findPreis(leistungen: LeistungInfo[], arbeitKey: ArbeitKey, qualitaet?: "standard" | "premium"): number | null {
  const kat = ARBEIT_KATEGORIE[arbeitKey];
  const hints = ARBEIT_NAME_HINTS[arbeitKey];

  for (const hint of hints) {
    const matches = leistungen.filter(
      (l) => l.kategorie === kat && l.name.toLowerCase().includes(hint)
    );
    if (matches.length === 0) continue;
    if (matches.length === 1 || !qualitaet) return matches[0].preisProEinheit;

    // Prefer matching quality variant
    if (qualitaet === "premium") {
      const prem = matches.find((l) => l.name.toLowerCase().includes("premium"));
      return (prem ?? matches[0]).preisProEinheit;
    }
    const std =
      matches.find((l) => l.name.toLowerCase().includes("standard")) ??
      matches.find((l) => !l.name.toLowerCase().includes("premium"));
    return (std ?? matches[0]).preisProEinheit;
  }

  const fallback = leistungen.find((l) => l.kategorie === kat);
  return fallback ? fallback.preisProEinheit : null;
}

export default function FormularClient() {
  const router = useRouter();
  const [generiert, setGeneriert] = useState(false);
  const [bereiche, setBereiche] = useState<Arbeitsbereich[]>([{ ...LEER_BEREICH, name: "Wohnzimmer" }]);
  const [qualitaet, setQualitaet] = useState<"standard" | "premium">("standard");
  const [kunde, setKunde] = useState<Kunde>({ name: "", strasse: "", plz: "", ort: "", email: "", telefon: "" });
  const [extras, setExtras] = useState<ExtraItem[]>([]);
  const [anfahrtAktiv, setAnfahrtAktiv] = useState(true);
  const [anfahrtBetrag, setAnfahrtBetrag] = useState(35);
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [extraForm, setExtraForm] = useState({ bezeichnung: "", schaetzMenge: "1", einheit: "pauschal", einzelpreis: "" });
  const [raumvorlagen, setRaumvorlagen] = useState<RaumVorlage[]>([]);
  const [leistungen, setLeistungen] = useState<LeistungInfo[]>([]);

  // Daten laden bei Mount
  useEffect(() => {
    fetch("/api/raumvorlagen")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { if (Array.isArray(data)) setRaumvorlagen(data); })
      .catch(() => {});

    fetch("/api/leistungen")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { if (Array.isArray(data)) setLeistungen(data); })
      .catch(() => {});
  }, []);

  // AI-Ergebnis oder Draft aus Storage laden
  useEffect(() => {
    const aiData = sessionStorage.getItem("ai-ergebnis");
    if (aiData) {
      try {
        const parsed = JSON.parse(aiData);

        // Kunde
        if (parsed.kunde) {
          setKunde(parsed.kunde);
        }

        // Neues Format: arbeitsbereiche
        if (Array.isArray(parsed.arbeitsbereiche) && parsed.arbeitsbereiche.length > 0) {
          setBereiche(parsed.arbeitsbereiche.map((b: Partial<Arbeitsbereich>) => ({
            name: b.name || "Raum",
            typ: b.typ || "RAUM",
            laenge: b.laenge || 4.0,
            breite: b.breite || 3.5,
            hoehe: b.hoehe || 2.55,
            fenster: b.fenster ?? 1,
            tueren: b.tueren ?? 1,
            wandflaeche: b.wandflaeche || 0,
            deckenflaeche: b.deckenflaeche || 0,
            arbeiten: { ...DEFAULT_ARBEITEN, ...b.arbeiten },
          })));
          if (parsed.qualitaet) setQualitaet(parsed.qualitaet);
        }
        // Altes Format: raeume + optionen (Backward-Compat)
        else if (Array.isArray(parsed.raeume) && parsed.raeume.length > 0) {
          const decke = parsed.optionen?.decke || false;
          const spachteln = parsed.optionen?.spachteln || false;
          setBereiche(parsed.raeume.map((r: { name: string; laenge: number; breite: number; hoehe: number; fenster: number; tueren: number }) => ({
            name: r.name,
            typ: "RAUM" as const,
            laenge: r.laenge,
            breite: r.breite,
            hoehe: r.hoehe,
            fenster: r.fenster ?? 1,
            tueren: r.tueren ?? 1,
            wandflaeche: 0,
            deckenflaeche: 0,
            arbeiten: {
              waendeStreichen: true,
              deckeStreichen: decke,
              grundierung: true,
              spachteln,
              tapeteEntfernen: false,
              tapezieren: false,
            },
          })));
          if (parsed.optionen?.qualitaet) setQualitaet(parsed.optionen.qualitaet);
        }

        // Extras
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
        return; // AI-Daten haben Vorrang, kein Draft laden
      } catch {
        // ignore
      }
    }

    // Kein AI-Ergebnis → Draft aus localStorage laden
    const draft = localStorage.getItem("formular-draft");
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.kunde?.name) setKunde(parsed.kunde);
        if (Array.isArray(parsed.bereiche) && parsed.bereiche.length > 0) setBereiche(parsed.bereiche);
        if (parsed.qualitaet) setQualitaet(parsed.qualitaet);
        if (Array.isArray(parsed.extras)) setExtras(parsed.extras);
        if (typeof parsed.anfahrtAktiv === "boolean") setAnfahrtAktiv(parsed.anfahrtAktiv);
        if (typeof parsed.anfahrtBetrag === "number") setAnfahrtBetrag(parsed.anfahrtBetrag);
        toast.info("Entwurf wiederhergestellt");
      } catch {
        // ignore
      }
    }
  }, []);

  // Draft auto-save (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (kunde.name || bereiche.length > 1 || bereiche[0]?.name !== "Wohnzimmer") {
        localStorage.setItem("formular-draft", JSON.stringify({ kunde, bereiche, qualitaet, extras, anfahrtAktiv, anfahrtBetrag }));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [kunde, bereiche, qualitaet, extras, anfahrtAktiv, anfahrtBetrag]);

  function updateKunde(field: string, value: string) {
    setKunde({ ...kunde, [field]: value });
  }

  const updateBereich = useCallback((index: number, field: string, value: string | number) => {
    setBereiche((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const updateArbeiten = useCallback((index: number, arbeitKey: ArbeitKey, value: boolean) => {
    setBereiche((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        arbeiten: { ...updated[index].arbeiten, [arbeitKey]: value },
      };
      return updated;
    });
  }, []);

  function toggleModus(index: number) {
    setBereiche((prev) => {
      const updated = [...prev];
      const b = updated[index];
      if (b.typ === "RAUM") {
        // RAUM → FLAECHE: berechne Flächen aus Maßen
        const { wand, decke } = berechneFlaechen(b);
        updated[index] = { ...b, typ: "FLAECHE", wandflaeche: wand, deckenflaeche: decke };
      } else {
        // FLAECHE → RAUM: setze Standard-Maße
        updated[index] = { ...b, typ: "RAUM", laenge: 4.0, breite: 3.5, hoehe: 2.55, fenster: 1, tueren: 1 };
      }
      return updated;
    });
  }

  function addVorlage(vorlage: RaumVorlage) {
    setBereiche((prev) => [
      ...prev,
      {
        name: vorlage.name,
        typ: "RAUM",
        laenge: vorlage.laenge,
        breite: vorlage.breite,
        hoehe: vorlage.hoehe,
        fenster: vorlage.fenster,
        tueren: vorlage.tueren,
        wandflaeche: 0,
        deckenflaeche: 0,
        arbeiten: { ...DEFAULT_ARBEITEN },
      },
    ]);
  }

  function addFlaeche() {
    setBereiche((prev) => [
      ...prev,
      {
        name: "Neue Fläche",
        typ: "FLAECHE",
        laenge: 0,
        breite: 0,
        hoehe: 0,
        fenster: 0,
        tueren: 0,
        wandflaeche: 0,
        deckenflaeche: 0,
        arbeiten: { waendeStreichen: true, deckeStreichen: false, grundierung: true, spachteln: false, tapeteEntfernen: false, tapezieren: false },
      },
    ]);
  }

  function addNeu() {
    setBereiche((prev) => [...prev, { ...LEER_BEREICH }]);
  }

  function removeBereich(index: number) {
    if (bereiche.length <= 1) return;
    setBereiche((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleGenerieren() {
    if (!kunde.name) {
      toast.error("Bitte Kundennamen angeben");
      return;
    }
    if (bereiche.length === 0) {
      toast.error("Mindestens ein Arbeitsbereich nötig");
      return;
    }

    setGeneriert(true);

    // Formulardaten speichern für "Bearbeiten" und Draft-Recovery
    const formularDaten = {
      kunde,
      arbeitsbereiche: bereiche,
      qualitaet,
      extras: extras.filter((e) => e.aktiv).map(({ aktiv: _, ...rest }) => rest),
      anfahrt: anfahrtAktiv ? anfahrtBetrag : 0,
    };
    sessionStorage.setItem("formular-daten", JSON.stringify(formularDaten));
    localStorage.setItem("formular-draft", JSON.stringify({ kunde, bereiche, qualitaet, extras, anfahrtAktiv, anfahrtBetrag }));

    try {
      const res = await fetch("/api/angebote/kalkulieren", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formularDaten),
      });

      const kalkulation = await res.json();

      if (!res.ok) {
        throw new Error(kalkulation.error || "Kalkulation fehlgeschlagen");
      }

      sessionStorage.setItem("kalkulation", JSON.stringify(kalkulation));
      localStorage.removeItem("formular-draft");

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
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Angebot erstellen</h1>
          <p className="text-sm text-muted-foreground">
            Kundendaten, Bereiche und Arbeiten prüfen
          </p>
        </div>
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
              value={kunde.name}
              onChange={(e) => updateKunde("name", e.target.value)}
              placeholder="Familie Müller"
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">E-Mail</Label>
              <Input
                value={kunde.email}
                onChange={(e) => updateKunde("email", e.target.value)}
                placeholder="email@beispiel.de"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Telefon</Label>
              <Input
                value={kunde.telefon}
                onChange={(e) => updateKunde("telefon", e.target.value)}
                placeholder="0176 ..."
                className="h-9"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Straße</Label>
            <Input
              value={kunde.strasse}
              onChange={(e) => updateKunde("strasse", e.target.value)}
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">PLZ</Label>
              <Input
                value={kunde.plz}
                onChange={(e) => updateKunde("plz", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Ort</Label>
              <Input
                value={kunde.ort}
                onChange={(e) => updateKunde("ort", e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Qualität */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Qualität</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Badge
              variant={qualitaet === "standard" ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() => setQualitaet("standard")}
            >
              Standard
            </Badge>
            <Badge
              variant={qualitaet === "premium" ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() => setQualitaet("premium")}
            >
              Premium
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Arbeitsbereiche */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">
            Arbeitsbereiche ({bereiche.length})
          </h2>
          <Button variant="outline" size="sm" onClick={addNeu}>
            <Plus className="h-4 w-4 mr-1" />
            Neu
          </Button>
        </div>

        {/* Raumvorlagen Chips */}
        {raumvorlagen.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {raumvorlagen.map((v) => (
              <Badge
                key={v.id}
                variant="outline"
                className="cursor-pointer hover:bg-muted text-xs"
                onClick={() => addVorlage(v)}
              >
                {v.icon ? `${v.icon} ` : ""}{v.name}
              </Badge>
            ))}
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-muted text-xs"
              onClick={addFlaeche}
            >
              + Fläche
            </Badge>
          </div>
        )}
        {raumvorlagen.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-muted text-xs"
              onClick={addFlaeche}
            >
              + Fläche
            </Badge>
          </div>
        )}

        {/* Bereiche */}
        {bereiche.map((bereich, i) => {
          const fl = berechneFlaechen(bereich);
          return (
            <Card key={i}>
              <CardContent className="pt-4 space-y-3">
                {/* Header: Name + Modus-Toggle + Löschen */}
                <div className="flex items-center gap-2">
                  <Input
                    value={bereich.name}
                    onChange={(e) => updateBereich(i, "name", e.target.value)}
                    className="h-8 font-medium border-none px-0 text-sm flex-1"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleModus(i)}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                        bereich.typ === "RAUM"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                      title="Maße eingeben"
                    >
                      <Ruler className="h-3 w-3" />
                      Maße
                    </button>
                    <button
                      onClick={() => toggleModus(i)}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                        bereich.typ === "FLAECHE"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                      title="Fläche direkt eingeben"
                    >
                      <SquareIcon className="h-3 w-3" />
                      m²
                    </button>
                  </div>
                  {bereiche.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeBereich(i)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                {/* Maße oder Fläche */}
                {bereich.typ === "RAUM" ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Länge (m)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={bereich.laenge}
                          onChange={(e) => updateBereich(i, "laenge", parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Breite (m)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={bereich.breite}
                          onChange={(e) => updateBereich(i, "breite", parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Höhe (m)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={bereich.hoehe}
                          onChange={(e) => updateBereich(i, "hoehe", parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Fenster</Label>
                        <Input
                          type="number"
                          value={bereich.fenster}
                          onChange={(e) => updateBereich(i, "fenster", parseInt(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Türen</Label>
                        <Input
                          type="number"
                          value={bereich.tueren}
                          onChange={(e) => updateBereich(i, "tueren", parseInt(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Wandfläche (m²)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={bereich.wandflaeche}
                        onChange={(e) => updateBereich(i, "wandflaeche", parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Deckenfläche (m²)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={bereich.deckenflaeche}
                        onChange={(e) => updateBereich(i, "deckenflaeche", parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Live m²-Anzeige */}
                <p className="text-xs text-muted-foreground">
                  Wand: {fl.wand.toFixed(1)} m² · Decke: {fl.decke.toFixed(1)} m²
                </p>

                {/* Arbeiten Checkboxes */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Arbeiten</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(ARBEIT_LABELS) as ArbeitKey[]).map((key) => {
                      const aktiv = bereich.arbeiten[key];
                      const preis = findPreis(leistungen, key, qualitaet);
                      const missing = aktiv && preis === null;
                      return (
                        <button
                          key={key}
                          onClick={() => updateArbeiten(i, key, !aktiv)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors border ${
                            missing
                              ? "bg-amber-100 text-amber-800 border-amber-300"
                              : aktiv
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {missing && <AlertTriangle className="h-3 w-3" />}
                          {ARBEIT_LABELS[key]}
                          {preis !== null && (
                            <span className={aktiv ? "opacity-80" : "opacity-60"}>
                              {preis.toFixed(2).replace(".", ",")} €
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {(Object.keys(ARBEIT_LABELS) as ArbeitKey[]).some(
                    (key) => bereich.arbeiten[key] && findPreis(leistungen, key, qualitaet) === null
                  ) && (
                    <p className="text-xs text-amber-700 mt-1">
                      Einige Arbeiten haben keine passende Leistung im Katalog. Bitte im Dashboard unter Leistungen anlegen.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Anfahrt & Extras */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Weiteres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Anfahrt */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Anfahrtspauschale</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="5"
                min="0"
                value={anfahrtBetrag}
                onChange={(e) => setAnfahrtBetrag(parseFloat(e.target.value) || 0)}
                className="h-8 w-20 text-sm text-right"
                disabled={!anfahrtAktiv}
              />
              <span className="text-xs text-muted-foreground">€</span>
              <Switch
                checked={anfahrtAktiv}
                onCheckedChange={setAnfahrtAktiv}
              />
            </div>
          </div>

          {/* Extras */}
          {extras.filter(e => e.bezeichnung).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Zusatzarbeiten
              </p>
              {extras.filter(e => e.bezeichnung).map((extra) => {
                const idx = extras.indexOf(extra);
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                      extra.aktiv ? "bg-muted/50" : "bg-muted/20 opacity-60"
                    }`}
                  >
                    <Switch
                      checked={extra.aktiv}
                      onCheckedChange={(checked) => {
                        const updated = [...extras];
                        updated[idx] = { ...updated[idx], aktiv: checked };
                        setExtras(updated);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{extra.bezeichnung}</p>
                      <p className="text-xs text-muted-foreground">
                        {extra.schaetzMenge} {extra.einheit}
                        {extra.einzelpreis ? ` × ${extra.einzelpreis.toFixed(2)} €` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => setExtras(extras.filter((_, j) => j !== idx))}
                      className="text-muted-foreground hover:text-destructive p-0.5 shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Extra hinzufügen */}
          {showExtraForm ? (
            <div className="rounded-lg border p-3 space-y-2">
              <Input
                autoFocus
                placeholder="z.B. Sockelleisten streichen"
                value={extraForm.bezeichnung}
                onChange={(e) => setExtraForm({ ...extraForm, bezeichnung: e.target.value })}
                className="h-9 text-sm"
              />
              <div className="grid grid-cols-4 gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={extraForm.schaetzMenge}
                  onChange={(e) => setExtraForm({ ...extraForm, schaetzMenge: e.target.value })}
                  placeholder="Menge"
                  className="h-8 text-sm"
                />
                <select
                  value={extraForm.einheit}
                  onChange={(e) => setExtraForm({ ...extraForm, einheit: e.target.value })}
                  className="h-8 text-sm border rounded px-2 bg-background"
                >
                  <option value="pauschal">pauschal</option>
                  <option value="Stück">Stück</option>
                  <option value="lfm">lfm</option>
                  <option value="m²">m²</option>
                </select>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={extraForm.einzelpreis}
                  onChange={(e) => setExtraForm({ ...extraForm, einzelpreis: e.target.value })}
                  placeholder="€/Einheit"
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  className="h-8"
                  disabled={!extraForm.bezeichnung.trim() || !extraForm.einzelpreis}
                  onClick={() => {
                    setExtras([...extras, {
                      bezeichnung: extraForm.bezeichnung.trim(),
                      kategorie: "SONSTIGES",
                      schaetzMenge: parseFloat(extraForm.schaetzMenge) || 1,
                      einheit: extraForm.einheit,
                      einzelpreis: parseFloat(extraForm.einzelpreis) || 0,
                      aktiv: true,
                    }]);
                    setExtraForm({ bezeichnung: "", schaetzMenge: "1", einheit: "pauschal", einzelpreis: "" });
                    setShowExtraForm(false);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => setShowExtraForm(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Zusatzarbeit hinzufügen
            </Button>
          )}
        </CardContent>
      </Card>

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
