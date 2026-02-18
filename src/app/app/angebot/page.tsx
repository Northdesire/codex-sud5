"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Pencil, Download, Save, Loader2, RefreshCw, Plus, X } from "lucide-react";
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

interface KalkData {
  raeume: Array<{
    name: string;
    laenge?: number;
    breite?: number;
    hoehe?: number;
    fenster?: number;
    tueren?: number;
    wandflaeche: number;
    deckenflaeche: number;
    gesamtflaeche: number;
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

const KAT_LABELS: Record<string, string> = {
  WANDFARBE: "Wandfarbe",
  GRUNDIERUNG: "Grundierung",
  SPACHTEL: "Spachtel",
  LACK: "Lack",
  VERBRAUCH: "Verbrauch",
  TAPETE: "Tapete",
  SONSTIGES: "Sonstiges",
};

export default function AngebotPage() {
  const router = useRouter();
  const [data, setData] = useState<KalkData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<Record<string, string>>({});
  const [showAddMaterial, setShowAddMaterial] = useState(false);

  useEffect(() => {
    const kalk = sessionStorage.getItem("kalkulation");
    if (kalk) {
      setData(JSON.parse(kalk));
    }
  }, []);

  const recalculate = useCallback(async (newSelections: Record<string, string>) => {
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
        body: JSON.stringify({ ...formData, selectedMaterials: newSelections }),
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
  }, []);

  function handleMaterialChange(kategorie: string, materialId: string) {
    const newSelections = { ...selectedMaterials, [kategorie]: materialId };
    setSelectedMaterials(newSelections);
    recalculate(newSelections);
  }

  function handleAddZusatz(materialId: string) {
    // Find next free ZUSATZ key
    let idx = 0;
    while (selectedMaterials[`ZUSATZ_${idx}`]) idx++;
    const newSelections = {
      ...selectedMaterials,
      [`ZUSATZ_${idx}`]: materialId,
      [`ZUSATZ_MENGE_${materialId}`]: "1",
    };
    setSelectedMaterials(newSelections);
    setShowAddMaterial(false);
    recalculate(newSelections);
  }

  function handleRemoveZusatz(materialId: string) {
    const newSelections = { ...selectedMaterials };
    // Find and remove the ZUSATZ entry for this materialId
    for (const [key, val] of Object.entries(newSelections)) {
      if (key.startsWith("ZUSATZ_") && !key.startsWith("ZUSATZ_MENGE_") && val === materialId) {
        delete newSelections[key];
      }
    }
    delete newSelections[`ZUSATZ_MENGE_${materialId}`];
    setSelectedMaterials(newSelections);
    recalculate(newSelections);
  }

  async function handleSave() {
    if (!data || saving) return;
    setSaving(true);

    try {
      const res = await fetch("/api/angebote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kunde: data.kunde,
          positionen: data.positionen,
          raeume: data.raeume,
          materialNetto: data.materialNetto,
          arbeitsNetto: data.arbeitsNetto,
          anfahrt: data.anfahrt,
          zuschlagNetto: data.zuschlagNetto,
          rabattNetto: data.rabattNetto,
          netto: data.netto,
          mwstSatz: data.mwstSatz,
          mwstBetrag: data.mwstBetrag,
          brutto: data.brutto,
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
      const blob = generateAngebotPDF({
        ...data,
        nummer: "Entwurf",
        datum: new Date(),
        gueltigBis: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const kundenName = data.kunde.name.replace(/\s+/g, "_");
      a.download = `Angebot_${kundenName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF Fehler:", error);
      alert("Fehler beim PDF-Erstellen.");
    } finally {
      setPdfLoading(false);
    }
  }

  if (!data) {
    return (
      <div className="px-5 pt-8 text-center">
        <p className="text-muted-foreground">Kein Angebot vorhanden</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/app/formular")}
        >
          Zum Formular
        </Button>
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
  const anfahrt = data.positionen.find((p) => p.typ === "ANFAHRT");

  // Alle verfügbaren Materialien aus dem Katalog
  const alleMaterialien = data.materialAlternativen
    ? Object.entries(data.materialAlternativen).flatMap(([, items]) => items)
    : [];
  const usedMaterialIds = new Set(materialien.map((p) => p.materialId).filter(Boolean));
  const verfuegbareZusatz = alleMaterialien.filter((m) => !usedMaterialIds.has(m.id));
  const hatKatalogMaterial = alleMaterialien.length > 0;

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

          {/* Raum-Übersicht */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Raumübersicht
            </p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-1.5 text-xs font-medium">
                      Raum
                    </th>
                    <th className="text-right px-3 py-1.5 text-xs font-medium">
                      Wand
                    </th>
                    <th className="text-right px-3 py-1.5 text-xs font-medium">
                      Decke
                    </th>
                    <th className="text-right px-3 py-1.5 text-xs font-medium">
                      Gesamt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.raeume.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5">{r.name}</td>
                      <td className="text-right px-3 py-1.5 font-mono text-xs">
                        {r.wandflaeche.toFixed(1)} m²
                      </td>
                      <td className="text-right px-3 py-1.5 font-mono text-xs">
                        {r.deckenflaeche > 0
                          ? `${r.deckenflaeche.toFixed(1)} m²`
                          : "–"}
                      </td>
                      <td className="text-right px-3 py-1.5 font-mono text-xs font-medium">
                        {r.gesamtflaeche.toFixed(1)} m²
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                        {p.menge.toFixed(1)} {p.einheit} × {formatEuro(p.einzelpreis)}
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
                  Keine Leistungen hinterlegt. Bitte im Dashboard unter &quot;Leistungen&quot; mindestens eine Leistung (z.B. &quot;Wände streichen&quot;, Kategorie: Streichen) anlegen.
                </p>
              </div>
            )}
          </div>

          {/* Material — mit Auswahl-Dropdowns */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Material
            </p>

            {materialien.length > 0 && (
              <div className="space-y-2">
                {materialien.map((p) => {
                  const kat = p.materialKategorie;
                  const alternativen = kat && data.materialAlternativen?.[kat];
                  const hasAlternatives = alternativen && alternativen.length > 1;
                  const isZusatz = Object.entries(selectedMaterials).some(
                    ([key, val]) => key.startsWith("ZUSATZ_") && !key.startsWith("ZUSATZ_MENGE_") && val === p.materialId
                  );

                  return (
                    <div key={p.posNr} className="py-1">
                      <div className="flex justify-between text-sm">
                        <div className="flex-1 min-w-0">
                          {hasAlternatives ? (
                            <select
                              className="w-full text-sm font-medium bg-muted/50 border rounded px-2 py-1 appearance-none cursor-pointer"
                              value={p.materialId || ""}
                              onChange={(e) => handleMaterialChange(kat, e.target.value)}
                            >
                              {alternativen.map((alt) => (
                                <option key={alt.id} value={alt.id}>
                                  {alt.name} — {formatEuro(alt.vkPreis)}/{alt.einheit}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="font-medium">{p.bezeichnung}</p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            {kat && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {KAT_LABELS[kat] || kat}
                              </Badge>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {p.menge} {p.einheit} × {formatEuro(p.einzelpreis)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <p className="font-mono font-medium">
                            {formatEuro(p.gesamtpreis)}
                          </p>
                          {isZusatz && (
                            <button
                              onClick={() => handleRemoveZusatz(p.materialId!)}
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

            {materialien.length === 0 && !hatKatalogMaterial && (
              <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">
                  Keine Materialien im Katalog. Bitte im Dashboard unter &quot;Material &amp; Preise&quot; Materialien anlegen (z.B. Wandfarbe, Grundierung).
                </p>
              </div>
            )}

            {materialien.length === 0 && hatKatalogMaterial && (
              <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50 p-3 mb-2">
                <p className="text-xs text-blue-800">
                  Keine Materialien automatisch zugeordnet. Materialien unten manuell hinzufügen oder Kategorie (WANDFARBE, GRUNDIERUNG) bei den Materialien im Dashboard prüfen.
                </p>
              </div>
            )}

            {/* Material hinzufügen — IMMER sichtbar wenn Katalog-Material existiert */}
            {verfuegbareZusatz.length > 0 && (
              <div className="mt-2">
                {showAddMaterial ? (
                  <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                    <p className="text-xs font-medium">Material hinzufügen:</p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {verfuegbareZusatz.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleAddZusatz(m.id)}
                          className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors flex justify-between items-center"
                        >
                          <div>
                            <span className="font-medium">{m.name}</span>
                            <Badge variant="outline" className="text-[10px] px-1 py-0 ml-2">
                              {KAT_LABELS[m.kategorie] || m.kategorie}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatEuro(m.vkPreis)}/{m.einheit}
                          </span>
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => setShowAddMaterial(false)}
                    >
                      Abbrechen
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
                    Material hinzufügen ({verfuegbareZusatz.length} verfügbar)
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Anfahrt */}
          {anfahrt && (
            <div className="flex justify-between text-sm">
              <p>Anfahrtspauschale</p>
              <p className="font-mono font-medium">
                {formatEuro(anfahrt.gesamtpreis)}
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
              <p className="font-mono">{formatEuro(data.materialNetto)}</p>
            </div>
            <div className="flex justify-between text-sm">
              <p className="text-muted-foreground">Anfahrt</p>
              <p className="font-mono">{formatEuro(data.anfahrt)}</p>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-sm font-medium">
              <p>Netto</p>
              <p className="font-mono">{formatEuro(data.netto)}</p>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <p>MwSt. ({data.mwstSatz}%)</p>
              <p className="font-mono">{formatEuro(data.mwstBetrag)}</p>
            </div>
            <div className="flex justify-between text-lg font-bold pt-1">
              <p>Brutto</p>
              <p className="font-mono text-primary">
                {formatEuro(data.brutto)}
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
          onClick={() => router.push("/app/formular")}
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
