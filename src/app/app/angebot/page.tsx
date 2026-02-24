"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Pencil,
  Download,
  Save,
  Loader2,
  RefreshCw,
  Plus,
  Minus,
  X,
  PackagePlus,
  MessageSquareText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatEuro } from "@/lib/kalkulation";
import { toast } from "sonner";

interface MaterialAlt {
  id: string;
  name: string;
  kategorie: string;
  vkPreis: number;
  einheit: string;
  ergiebigkeit: number | null;
  anstriche: number | null;
}

interface BereichArbeiten {
  waendeStreichen?: boolean;
  deckeStreichen?: boolean;
  grundierung?: boolean;
  spachteln?: boolean;
  tapeteEntfernen?: boolean;
  tapezieren?: boolean;
}

interface KalkData {
  raeume: Array<{
    name: string;
    typ?: "RAUM" | "FLAECHE";
    laenge?: number;
    breite?: number;
    hoehe?: number;
    fenster?: number;
    tueren?: number;
    wandflaeche: number;
    deckenflaeche: number;
    gesamtflaeche: number;
    arbeiten?: BereichArbeiten;
  }>;
  positionen: Array<{
    posNr: number;
    typ: string;
    raumName?: string;
    bezeichnung: string;
    menge: number;
    einheit: string;
    einzelpreis: number;
    gesamtpreis: number;
    leistungId?: string;
    materialId?: string;
    materialKategorie?: string;
  }>;
  materialNetto: number;
  arbeitsNetto: number;
  anfahrt: number;
  zuschlagNetto: number;
  rabattNetto: number;
  netto: number;
  mwstSatz: number;
  mwstBetrag: number;
  brutto: number;
  materialAlternativen?: Record<string, MaterialAlt[]>;
  kunde: {
    name: string;
    strasse: string;
    plz: string;
    ort: string;
    email: string;
    telefon: string;
  };
  firma: {
    firmenname: string;
    inhaberName: string;
    inhaberTitel: string | null;
    strasse: string;
    plz: string;
    ort: string;
    telefon: string;
    email: string;
    iban: string | null;
    bic: string | null;
    bankname: string | null;
    zahlungsziel: number;
    nrPrefix?: string;
  } | null;
}

interface CustomPosition {
  id: string;
  bezeichnung: string;
  menge: number;
  einheit: string;
  einzelpreis: number;
}

const KAT_LABELS: Record<string, string> = {
  WANDFARBE: "Wandfarbe",
  GRUNDIERUNG: "Grundierung",
  SPACHTEL: "Spachtel",
  LACK: "Lack",
  VERBRAUCH: "Verbrauch",
  TAPETE: "Tapete",
  SONSTIGES: "Sonstiges",
};

const EINHEITEN = ["Stück", "Liter", "kg", "m²", "lfm", "Rolle", "pauschal"];

export default function AngebotPage() {
  const router = useRouter();
  const [data, setData] = useState<KalkData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<
    Record<string, string>
  >({});
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [addMatFilter, setAddMatFilter] = useState<string>("ALLE");
  const [customPositionen, setCustomPositionen] = useState<CustomPosition[]>(
    []
  );
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customForm, setCustomForm] = useState({
    bezeichnung: "",
    menge: "1",
    einheit: "Stück",
    einzelpreis: "",
  });
  const [originalText, setOriginalText] = useState<string>("");
  const [showOriginalText, setShowOriginalText] = useState(false);

  useEffect(() => {
    const kalk = sessionStorage.getItem("kalkulation");
    if (kalk) {
      setData(JSON.parse(kalk));
    }
    const origText = sessionStorage.getItem("ai-originaltext");
    if (origText) {
      setOriginalText(origText);
    }
  }, []);

  const recalculate = useCallback(
    async (newSelections: Record<string, string>) => {
      const formRaw = sessionStorage.getItem("formular-daten");
      if (!formRaw) {
        toast.error("Formulardaten nicht gefunden — bitte neu berechnen");
        return;
      }
      setRecalculating(true);
      try {
        const formData = JSON.parse(formRaw);
        const res = await fetch("/api/angebote/kalkulieren", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            selectedMaterials: newSelections,
          }),
        });
        if (!res.ok) throw new Error();
        const result = await res.json();
        setData(result);
        sessionStorage.setItem("kalkulation", JSON.stringify(result));
        toast.success("Neu berechnet");
      } catch {
        toast.error("Fehler bei der Neuberechnung");
      } finally {
        setRecalculating(false);
      }
    },
    []
  );

  function handleMaterialChange(kategorie: string, materialId: string) {
    const newSelections = { ...selectedMaterials, [kategorie]: materialId };
    setSelectedMaterials(newSelections);
    recalculate(newSelections);
  }

  function handleAddZusatz(materialId: string) {
    let idx = 0;
    while (selectedMaterials[`ZUSATZ_${idx}`]) idx++;
    const newSelections = {
      ...selectedMaterials,
      [`ZUSATZ_${idx}`]: materialId,
      [`ZUSATZ_MENGE_${materialId}`]: "1",
    };
    setSelectedMaterials(newSelections);
    setShowAddMaterial(false);
    setAddMatFilter("ALLE");
    recalculate(newSelections);
  }

  function handleRemoveZusatz(materialId: string) {
    const newSelections = { ...selectedMaterials };
    for (const [key, val] of Object.entries(newSelections)) {
      if (
        key.startsWith("ZUSATZ_") &&
        !key.startsWith("ZUSATZ_MENGE_") &&
        val === materialId
      ) {
        delete newSelections[key];
      }
    }
    delete newSelections[`ZUSATZ_MENGE_${materialId}`];
    setSelectedMaterials(newSelections);
    recalculate(newSelections);
  }

  function handleZusatzMengeChange(materialId: string, newMenge: number) {
    if (newMenge < 1) newMenge = 1;
    const newSelections = {
      ...selectedMaterials,
      [`ZUSATZ_MENGE_${materialId}`]: newMenge.toString(),
    };
    setSelectedMaterials(newSelections);
    recalculate(newSelections);
  }

  // --- Custom Positionen ---

  function handleAddCustom() {
    if (!customForm.bezeichnung || !customForm.einzelpreis) {
      toast.error("Name und Preis sind Pflichtfelder");
      return;
    }
    const menge = parseFloat(customForm.menge) || 1;
    const einzelpreis = parseFloat(customForm.einzelpreis) || 0;

    setCustomPositionen((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        bezeichnung: customForm.bezeichnung,
        menge,
        einheit: customForm.einheit,
        einzelpreis,
      },
    ]);
    setCustomForm({
      bezeichnung: "",
      menge: "1",
      einheit: "Stück",
      einzelpreis: "",
    });
    setShowCustomForm(false);
    setShowAddMaterial(false);
    toast.success("Material hinzugefügt");
  }

  function handleRemoveCustom(id: string) {
    setCustomPositionen((prev) => prev.filter((p) => p.id !== id));
  }

  function handleCustomMengeChange(id: string, newMenge: number) {
    if (newMenge < 1) newMenge = 1;
    setCustomPositionen((prev) =>
      prev.map((p) => (p.id === id ? { ...p, menge: newMenge } : p))
    );
  }

  // --- Totals mit Custom ---

  const customNetto = customPositionen.reduce(
    (sum, p) => sum + Math.round(p.menge * p.einzelpreis * 100) / 100,
    0
  );

  const totalNetto = data ? data.netto + customNetto : 0;
  const totalMwstBetrag = data
    ? Math.round(totalNetto * (data.mwstSatz / 100) * 100) / 100
    : 0;
  const totalBrutto = Math.round((totalNetto + totalMwstBetrag) * 100) / 100;
  const totalMaterialNetto = data ? data.materialNetto + customNetto : 0;

  // --- Save & PDF ---

  async function handleSave() {
    if (!data || saving) return;
    setSaving(true);

    // Merge custom positionen into positionen
    const maxPosNr = Math.max(0, ...data.positionen.map((p) => p.posNr));
    const allPositionen = [
      ...data.positionen,
      ...customPositionen.map((cp, i) => ({
        posNr: maxPosNr + i + 1,
        typ: "MATERIAL" as const,
        bezeichnung: cp.bezeichnung,
        menge: cp.menge,
        einheit: cp.einheit,
        einzelpreis: cp.einzelpreis,
        gesamtpreis: Math.round(cp.menge * cp.einzelpreis * 100) / 100,
      })),
    ];

    try {
      const res = await fetch("/api/angebote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kunde: data.kunde,
          positionen: allPositionen,
          raeume: data.raeume,
          materialNetto: totalMaterialNetto,
          arbeitsNetto: data.arbeitsNetto,
          anfahrt: data.anfahrt,
          zuschlagNetto: data.zuschlagNetto,
          rabattNetto: data.rabattNetto,
          netto: totalNetto,
          mwstSatz: data.mwstSatz,
          mwstBetrag: totalMwstBetrag,
          brutto: totalBrutto,
          eingabeMethode: "FORMULAR",
        }),
      });

      if (!res.ok) throw new Error("Speichern fehlgeschlagen");

      setSaved(true);
      sessionStorage.removeItem("kalkulation");
      router.push("/app/uebersicht");
    } catch (error) {
      console.error("Speichern Fehler:", error);
      alert("Fehler beim Speichern. Bitte versuche es erneut.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePDF() {
    if (!data || pdfLoading) return;
    setPdfLoading(true);

    try {
      const { generateAngebotPDF } = await import("@/lib/pdf");
      const maxPosNr = Math.max(0, ...data.positionen.map((p) => p.posNr));
      const allPositionen = [
        ...data.positionen,
        ...customPositionen.map((cp, i) => ({
          posNr: maxPosNr + i + 1,
          typ: "MATERIAL" as const,
          bezeichnung: cp.bezeichnung,
          menge: cp.menge,
          einheit: cp.einheit,
          einzelpreis: cp.einzelpreis,
          gesamtpreis: Math.round(cp.menge * cp.einzelpreis * 100) / 100,
        })),
      ];

      const blob = generateAngebotPDF({
        ...data,
        positionen: allPositionen,
        materialNetto: totalMaterialNetto,
        netto: totalNetto,
        mwstBetrag: totalMwstBetrag,
        brutto: totalBrutto,
        nummer: "Entwurf",
        datum: new Date(),
        gueltigBis: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (error) {
      console.error("PDF Fehler:", error);
      alert("Fehler beim PDF-Erstellen.");
    } finally {
      setPdfLoading(false);
    }
  }

  // --- Render ---

  if (!data) {
    return (
      <div className="px-5 pt-8 text-center">
        <p className="text-muted-foreground">Kein Angebot vorhanden</p>
        <p className="text-xs text-muted-foreground mt-1">
          Erstelle zuerst ein Angebot über AI-Eingabe oder das Formular.
        </p>
        <div className="flex gap-2 justify-center mt-4">
          <Button
            variant="outline"
            onClick={() => router.push("/app/ai")}
          >
            AI-Eingabe
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/app/formular")}
          >
            Formular
          </Button>
        </div>
      </div>
    );
  }

  const heute = new Date();
  const gueltigBis = new Date(heute);
  gueltigBis.setDate(gueltigBis.getDate() + 14);

  const datumStr = heute.toLocaleDateString("de-DE");
  const gueltigStr = gueltigBis.toLocaleDateString("de-DE");

  const leistungen = data.positionen.filter((p) => p.typ === "LEISTUNG");
  const materialien = data.positionen.filter((p) => p.typ === "MATERIAL");
  const anfahrtPos = data.positionen.find((p) => p.typ === "ANFAHRT");

  // Alle verfügbaren Materialien aus dem Katalog
  const alleMaterialien = data.materialAlternativen
    ? Object.entries(data.materialAlternativen).flatMap(([, items]) => items)
    : [];
  const usedMaterialIds = new Set(
    materialien.map((p) => p.materialId).filter(Boolean)
  );
  const verfuegbareZusatz = alleMaterialien.filter(
    (m) => !usedMaterialIds.has(m.id)
  );
  const hatKatalogMaterial = alleMaterialien.length > 0;

  // Kategorien die im "Material hinzufügen" verfügbar sind
  const verfuegbareKategorien = [
    ...new Set(verfuegbareZusatz.map((m) => m.kategorie)),
  ];
  const gefilterteZusatz =
    addMatFilter === "ALLE"
      ? verfuegbareZusatz
      : verfuegbareZusatz.filter((m) => m.kategorie === addMatFilter);

  return (
    <div className="px-4 pt-5 space-y-4 pb-4">
      {/* Recalculating Overlay */}
      {recalculating && (
        <div className="fixed inset-0 bg-background/60 z-50 flex items-center justify-center">
          <div className="flex items-center gap-2 bg-card p-4 rounded-lg shadow-lg border">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Neu berechnen...</span>
          </div>
        </div>
      )}

      {/* Originaltext der Anfrage */}
      {originalText && (
        <Card>
          <button
            onClick={() => setShowOriginalText(!showOriginalText)}
            className="w-full flex items-center justify-between px-5 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Ihre Anfrage</span>
            </div>
            {showOriginalText ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {showOriginalText && (
            <CardContent className="pt-0 pb-4 px-5">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {originalText}
              </p>
            </CardContent>
          )}
        </Card>
      )}

      {/* Angebots-Dokument */}
      <Card className="overflow-hidden">
        <CardContent className="p-5 space-y-5">
          {/* Kopf */}
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                  AI
                </div>
                <div>
                  <p className="font-bold text-sm">
                    {data.firma?.firmenname || "AIngebot"}
                  </p>
                  {data.firma?.inhaberTitel && (
                    <p className="text-[10px] text-muted-foreground">
                      {data.firma.inhaberTitel} {data.firma.inhaberName}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="text-xs">
                Entwurf
              </Badge>
              <p className="text-[10px] text-muted-foreground mt-1">
                {datumStr}
              </p>
            </div>
          </div>

          <Separator />

          {/* Kundenadresse */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">An:</p>
            <p className="font-medium text-sm">{data.kunde.name}</p>
            {data.kunde.strasse && (
              <p className="text-sm text-muted-foreground">
                {data.kunde.strasse}
              </p>
            )}
            {(data.kunde.plz || data.kunde.ort) && (
              <p className="text-sm text-muted-foreground">
                {data.kunde.plz} {data.kunde.ort}
              </p>
            )}
          </div>

          {/* Einleitung */}
          <div>
            <p className="text-sm leading-relaxed">
              Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen
              folgendes Angebot für die Malerarbeiten:
            </p>
          </div>

          {/* Bereichs-Übersicht */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Arbeitsbereiche
            </p>
            <div className="space-y-2">
              {data.raeume.map((r, i) => {
                const arbeitLabels: string[] = [];
                if (r.arbeiten?.waendeStreichen) arbeitLabels.push("Streichen");
                if (r.arbeiten?.deckeStreichen) arbeitLabels.push("Decke");
                if (r.arbeiten?.grundierung) arbeitLabels.push("Grundierung");
                if (r.arbeiten?.spachteln) arbeitLabels.push("Spachteln");
                if (r.arbeiten?.tapeteEntfernen) arbeitLabels.push("Tapete ab");
                if (r.arbeiten?.tapezieren) arbeitLabels.push("Tapezieren");

                return (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{r.name}</p>
                        {r.typ === "FLAECHE" && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            Fläche
                          </Badge>
                        )}
                      </div>
                      <p className="font-mono text-xs font-medium">
                        {r.gesamtflaeche.toFixed(1)} m²
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Wand {r.wandflaeche.toFixed(1)} m²</span>
                      {r.deckenflaeche > 0 && (
                        <span>Decke {r.deckenflaeche.toFixed(1)} m²</span>
                      )}
                    </div>
                    {arbeitLabels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {arbeitLabels.map((label) => (
                          <Badge
                            key={label}
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 font-normal"
                          >
                            {label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leistungen */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Arbeitsleistungen
            </p>
            {leistungen.length > 0 ? (
              <div className="space-y-1">
                {leistungen.map((p) => (
                  <div
                    key={p.posNr}
                    className="flex justify-between text-sm py-1"
                  >
                    <div>
                      <p>{p.bezeichnung}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.menge.toFixed(1)} {p.einheit} ×{" "}
                        {formatEuro(p.einzelpreis)}
                      </p>
                    </div>
                    <p className="font-mono font-medium shrink-0 ml-4">
                      {formatEuro(p.gesamtpreis)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">
                  Keine Leistungen hinterlegt. Bitte im Dashboard unter
                  &quot;Leistungen&quot; mindestens eine Leistung (z.B.
                  &quot;Wände streichen&quot;, Kategorie: Streichen) anlegen.
                </p>
              </div>
            )}
          </div>

          {/* Material — mit Auswahl-Dropdowns + Menge + Custom */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Material
            </p>

            {/* Katalog-Materialien */}
            {materialien.length > 0 && (
              <div className="space-y-2">
                {materialien.map((p) => {
                  const kat = p.materialKategorie;
                  const alternativen =
                    kat && data.materialAlternativen?.[kat];
                  const hasAlternatives =
                    alternativen && alternativen.length > 1;
                  const isZusatz = Object.entries(selectedMaterials).some(
                    ([key, val]) =>
                      key.startsWith("ZUSATZ_") &&
                      !key.startsWith("ZUSATZ_MENGE_") &&
                      val === p.materialId
                  );

                  return (
                    <div key={p.posNr} className="py-1">
                      <div className="flex justify-between text-sm">
                        <div className="flex-1 min-w-0">
                          {hasAlternatives ? (
                            <select
                              className="w-full text-sm font-medium bg-muted/50 border rounded px-2 py-1 appearance-none cursor-pointer"
                              value={p.materialId || ""}
                              onChange={(e) =>
                                handleMaterialChange(kat, e.target.value)
                              }
                            >
                              {alternativen.map((alt) => (
                                <option key={alt.id} value={alt.id}>
                                  {alt.name} — {formatEuro(alt.vkPreis)}/
                                  {alt.einheit}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="font-medium">{p.bezeichnung}</p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            {kat && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0"
                              >
                                {KAT_LABELS[kat] || kat}
                              </Badge>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {p.menge} {p.einheit} ×{" "}
                              {formatEuro(p.einzelpreis)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {/* Menge +/- für Zusatz-Materialien */}
                          {isZusatz && (
                            <div className="flex items-center gap-0.5 mr-1">
                              <button
                                onClick={() =>
                                  handleZusatzMengeChange(
                                    p.materialId!,
                                    p.menge - 1
                                  )
                                }
                                className="h-6 w-6 rounded border bg-muted flex items-center justify-center hover:bg-muted/80"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={p.menge}
                                onChange={(e) =>
                                  handleZusatzMengeChange(
                                    p.materialId!,
                                    parseInt(e.target.value) || 1
                                  )
                                }
                                className="w-10 h-6 text-center text-xs border rounded bg-background"
                              />
                              <button
                                onClick={() =>
                                  handleZusatzMengeChange(
                                    p.materialId!,
                                    p.menge + 1
                                  )
                                }
                                className="h-6 w-6 rounded border bg-muted flex items-center justify-center hover:bg-muted/80"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                          <p className="font-mono font-medium">
                            {formatEuro(p.gesamtpreis)}
                          </p>
                          {isZusatz && (
                            <button
                              onClick={() =>
                                handleRemoveZusatz(p.materialId!)
                              }
                              className="text-destructive hover:bg-destructive/10 rounded p-0.5"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Custom Positionen */}
            {customPositionen.length > 0 && (
              <div className="space-y-2 mt-2">
                {customPositionen.map((cp) => {
                  const gp =
                    Math.round(cp.menge * cp.einzelpreis * 100) / 100;
                  return (
                    <div key={cp.id} className="py-1">
                      <div className="flex justify-between text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{cp.bezeichnung}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1 py-0 border-violet-300 text-violet-600"
                            >
                              Eigenes
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              {cp.menge} {cp.einheit} ×{" "}
                              {formatEuro(cp.einzelpreis)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <div className="flex items-center gap-0.5 mr-1">
                            <button
                              onClick={() =>
                                handleCustomMengeChange(cp.id, cp.menge - 1)
                              }
                              className="h-6 w-6 rounded border bg-muted flex items-center justify-center hover:bg-muted/80"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={cp.menge}
                              onChange={(e) =>
                                handleCustomMengeChange(
                                  cp.id,
                                  parseInt(e.target.value) || 1
                                )
                              }
                              className="w-10 h-6 text-center text-xs border rounded bg-background"
                            />
                            <button
                              onClick={() =>
                                handleCustomMengeChange(cp.id, cp.menge + 1)
                              }
                              className="h-6 w-6 rounded border bg-muted flex items-center justify-center hover:bg-muted/80"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <p className="font-mono font-medium">
                            {formatEuro(gp)}
                          </p>
                          <button
                            onClick={() => handleRemoveCustom(cp.id)}
                            className="text-destructive hover:bg-destructive/10 rounded p-0.5"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Hinweise wenn leer */}
            {materialien.length === 0 &&
              customPositionen.length === 0 &&
              !hatKatalogMaterial && (
                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3">
                  <p className="text-xs text-amber-800">
                    Keine Materialien im Katalog. Bitte im Dashboard unter
                    &quot;Material &amp; Preise&quot; Materialien anlegen oder
                    unten eigenes Material hinzufügen.
                  </p>
                </div>
              )}

            {materialien.length === 0 &&
              customPositionen.length === 0 &&
              hatKatalogMaterial && (
                <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50 p-3 mb-2">
                  <p className="text-xs text-blue-800">
                    Keine Materialien automatisch zugeordnet. Unten manuell
                    hinzufügen oder Kategorie bei den Materialien im Dashboard
                    prüfen.
                  </p>
                </div>
              )}

            {/* ===== Material hinzufügen Panel ===== */}
            <div className="mt-2">
              {showAddMaterial ? (
                <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                  <p className="text-xs font-semibold">
                    Material hinzufügen
                  </p>

                  {/* Kategorie-Filter */}
                  {verfuegbareKategorien.length > 1 && (
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge
                        variant={
                          addMatFilter === "ALLE" ? "default" : "outline"
                        }
                        className="cursor-pointer text-[10px] px-2 py-0.5"
                        onClick={() => setAddMatFilter("ALLE")}
                      >
                        Alle
                      </Badge>
                      {verfuegbareKategorien.map((kat) => (
                        <Badge
                          key={kat}
                          variant={
                            addMatFilter === kat ? "default" : "outline"
                          }
                          className="cursor-pointer text-[10px] px-2 py-0.5"
                          onClick={() => setAddMatFilter(kat)}
                        >
                          {KAT_LABELS[kat] || kat}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Material-Liste */}
                  {gefilterteZusatz.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {gefilterteZusatz.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleAddZusatz(m.id)}
                          className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors flex justify-between items-center"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-medium truncate">
                              {m.name}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1 py-0 shrink-0"
                            >
                              {KAT_LABELS[m.kategorie] || m.kategorie}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono shrink-0 ml-2">
                            {formatEuro(m.vkPreis)}/{m.einheit}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {gefilterteZusatz.length === 0 &&
                    verfuegbareZusatz.length > 0 && (
                      <p className="text-xs text-muted-foreground py-2 text-center">
                        Keine Materialien in dieser Kategorie verfügbar
                      </p>
                    )}

                  <Separator />

                  {/* Eigenes Material Form */}
                  {showCustomForm ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold">
                        Eigenes Material
                      </p>
                      <Input
                        value={customForm.bezeichnung}
                        onChange={(e) =>
                          setCustomForm({
                            ...customForm,
                            bezeichnung: e.target.value,
                          })
                        }
                        placeholder="Bezeichnung *"
                        className="h-8 text-sm"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={customForm.menge}
                          onChange={(e) =>
                            setCustomForm({
                              ...customForm,
                              menge: e.target.value,
                            })
                          }
                          placeholder="Menge"
                          className="h-8 text-sm"
                        />
                        <select
                          value={customForm.einheit}
                          onChange={(e) =>
                            setCustomForm({
                              ...customForm,
                              einheit: e.target.value,
                            })
                          }
                          className="h-8 text-sm border rounded px-2 bg-background"
                        >
                          {EINHEITEN.map((e) => (
                            <option key={e} value={e}>
                              {e}
                            </option>
                          ))}
                        </select>
                        <Input
                          type="number"
                          step="0.01"
                          value={customForm.einzelpreis}
                          onChange={(e) =>
                            setCustomForm({
                              ...customForm,
                              einzelpreis: e.target.value,
                            })
                          }
                          placeholder="Preis *"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={handleAddCustom}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Hinzufügen
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setShowCustomForm(false)}
                        >
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-8"
                      onClick={() => setShowCustomForm(true)}
                    >
                      <PackagePlus className="h-3.5 w-3.5 mr-1" />
                      Eigenes Material eingeben
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setShowAddMaterial(false);
                      setAddMatFilter("ALLE");
                      setShowCustomForm(false);
                    }}
                  >
                    Schliessen
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setShowAddMaterial(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Material hinzufügen
                  {verfuegbareZusatz.length > 0 &&
                    ` (${verfuegbareZusatz.length} im Katalog)`}
                </Button>
              )}
            </div>
          </div>

          {/* Anfahrt */}
          {anfahrtPos && (
            <div className="flex justify-between text-sm">
              <p>Anfahrtspauschale</p>
              <p className="font-mono font-medium">
                {formatEuro(anfahrtPos.gesamtpreis)}
              </p>
            </div>
          )}

          <Separator />

          {/* Summenblock */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <p className="text-muted-foreground">Arbeitsleistungen</p>
              <p className="font-mono">{formatEuro(data.arbeitsNetto)}</p>
            </div>
            <div className="flex justify-between text-sm">
              <p className="text-muted-foreground">Material</p>
              <p className="font-mono">{formatEuro(totalMaterialNetto)}</p>
            </div>
            <div className="flex justify-between text-sm">
              <p className="text-muted-foreground">Anfahrt</p>
              <p className="font-mono">{formatEuro(data.anfahrt)}</p>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-sm font-medium">
              <p>Netto</p>
              <p className="font-mono">{formatEuro(totalNetto)}</p>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <p>MwSt. ({data.mwstSatz}%)</p>
              <p className="font-mono">{formatEuro(totalMwstBetrag)}</p>
            </div>
            <div className="flex justify-between text-lg font-bold pt-1">
              <p>Brutto</p>
              <p className="font-mono text-primary">
                {formatEuro(totalBrutto)}
              </p>
            </div>
          </div>

          <Separator />

          {/* Fusszeile */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              Gültig bis: {gueltigStr} | Zahlungsziel:{" "}
              {data.firma?.zahlungsziel || 14} Tage
            </p>
            {data.firma?.iban && (
              <p>
                Bank: {data.firma.bankname} | IBAN: {data.firma.iban}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Aktionen */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          className="h-12"
          onClick={() => {
            const formRaw = sessionStorage.getItem("formular-daten");
            if (formRaw) {
              sessionStorage.setItem("ai-ergebnis", formRaw);
            }
            router.push("/app/formular");
          }}
        >
          <Pencil className="h-4 w-4 mr-1" />
          Bearbeiten
        </Button>
        <Button
          variant="outline"
          className="h-12"
          onClick={handlePDF}
          disabled={pdfLoading}
        >
          {pdfLoading ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1" />
          )}
          PDF
        </Button>
        <Button
          className="h-12"
          onClick={handleSave}
          disabled={saving || saved}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          {saved ? "Gespeichert" : "Speichern"}
        </Button>
      </div>
    </div>
  );
}
