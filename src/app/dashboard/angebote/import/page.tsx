"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload,
  FileText,
  Image,
  Loader2,
  Check,
  Package,
  Wrench,
  ClipboardList,
  User,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface ExtractedPosition {
  posNr: number;
  typ: string;
  bezeichnung: string;
  menge: number;
  einheit: string;
  einzelpreis: number;
  gesamtpreis: number;
  raumName?: string | null;
}

interface ExtractedMaterial {
  name: string;
  kategorie: string;
  vkPreis: number;
  einheit: string;
  ergiebigkeit?: number | null;
  lieferant?: string | null;
  selected: boolean;
}

interface ExtractedLeistung {
  name: string;
  kategorie: string;
  preisProEinheit: number;
  einheit: string;
  selected: boolean;
}

interface ExtractedData {
  kunde: {
    name: string;
    strasse: string;
    plz: string;
    ort: string;
    email: string;
    telefon: string;
  };
  meta: {
    nummer: string;
    datum: string;
    typ: string;
  };
  positionen: ExtractedPosition[];
  materialien: ExtractedMaterial[];
  leistungen: ExtractedLeistung[];
  summen: {
    materialNetto: number;
    arbeitsNetto: number;
    anfahrt: number;
    zuschlagNetto: number;
    rabattNetto: number;
    netto: number;
    mwstSatz: number;
    mwstBetrag: number;
    brutto: number;
  };
  zusammenfassung: string;
}

function euro(n: number): string {
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " \u20AC";
}

const TypColors: Record<string, string> = {
  LEISTUNG: "bg-blue-100 text-blue-700",
  MATERIAL: "bg-amber-100 text-amber-700",
  ZUSCHLAG: "bg-orange-100 text-orange-700",
  RABATT: "bg-green-100 text-green-700",
  ANFAHRT: "bg-gray-100 text-gray-700",
};

export default function AngebotImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [data, setData] = useState<ExtractedData | null>(null);
  const [fileName, setFileName] = useState("");
  const [importResult, setImportResult] = useState<{
    nummer: string;
    matCreated: number;
    leistCreated: number;
    positionenCount: number;
  } | null>(null);

  async function handleFileUpload(file: File) {
    setFileName(file.name);
    setExtracting(true);
    setData(null);
    setImported(false);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ai/extract-angebot", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Extraktion fehlgeschlagen");
      }

      const extracted = await res.json();

      // Mark all materials and leistungen as selected by default
      extracted.materialien = (extracted.materialien || []).map(
        (m: ExtractedMaterial) => ({ ...m, selected: true })
      );
      extracted.leistungen = (extracted.leistungen || []).map(
        (l: ExtractedLeistung) => ({ ...l, selected: true })
      );

      setData(extracted);

      const posCount = extracted.positionen?.length || 0;
      toast.success(`${posCount} Positionen erkannt`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Fehler bei der Analyse"
      );
    } finally {
      setExtracting(false);
    }
  }

  async function handleImport() {
    if (!data) return;

    setImporting(true);
    try {
      const res = await fetch("/api/ai/import-angebot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kunde: data.kunde,
          positionen: data.positionen,
          summen: data.summen,
          materialien: data.materialien.filter((m) => m.selected),
          leistungen: data.leistungen.filter((l) => l.selected),
          meta: data.meta,
        }),
      });

      if (!res.ok) throw new Error("Import fehlgeschlagen");

      const result = await res.json();
      setImportResult(result);
      setImported(true);
      toast.success(`Angebot ${result.nummer} importiert`);
    } catch {
      toast.error("Fehler beim Import");
    } finally {
      setImporting(false);
    }
  }

  function toggleMaterial(index: number) {
    if (!data) return;
    const updated = [...data.materialien];
    updated[index] = { ...updated[index], selected: !updated[index].selected };
    setData({ ...data, materialien: updated });
  }

  function toggleLeistung(index: number) {
    if (!data) return;
    const updated = [...data.leistungen];
    updated[index] = { ...updated[index], selected: !updated[index].selected };
    setData({ ...data, leistungen: updated });
  }

  return (
    <>
      <Header
        title="Angebot / Rechnung importieren"
        description="Lade ein altes Angebot oder eine Rechnung hoch — AI extrahiert alles automatisch"
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/angebote")}>
            Zurück zu Angebote
          </Button>
        }
      />
      <div className="p-8 max-w-5xl space-y-6">
        {/* Upload */}
        <Card>
          <CardContent className="pt-6">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/*,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />

            {!extracting && !data && (
              <div
                className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <div className="flex justify-center gap-4 mb-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                    <Image className="h-6 w-6" />
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
                    <Upload className="h-6 w-6" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-1">
                  Altes Angebot oder Rechnung hochladen
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  PDF, Foto oder Screenshot — AI erkennt Positionen, Preise und Kundendaten
                </p>
                <div className="flex justify-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">PDF</Badge>
                  <Badge variant="outline">JPG/PNG</Badge>
                  <Badge variant="outline">TXT</Badge>
                </div>
              </div>
            )}

            {extracting && (
              <div className="py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
                <p className="font-medium">AI analysiert {fileName}...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Positionen, Preise und Kundendaten werden extrahiert
                </p>
              </div>
            )}

            {!extracting && data && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{data.zusammenfassung}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setData(null);
                    setImported(false);
                    setImportResult(null);
                    fileRef.current?.click();
                  }}
                >
                  Andere Datei
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {data && (
          <>
            {/* Meta + Kunde */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    {data.meta.typ === "RECHNUNG" ? "Rechnung" : "Angebot"} {data.meta.nummer}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-1">
                    <p className="text-muted-foreground">
                      Datum: {data.meta.datum ? new Date(data.meta.datum).toLocaleDateString("de-DE") : "—"}
                    </p>
                    <p className="font-mono font-medium text-lg">{euro(data.summen.brutto)}</p>
                    <p className="text-xs text-muted-foreground">
                      Netto {euro(data.summen.netto)} + {data.summen.mwstSatz}% MwSt
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Kunde
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-0.5">
                    <p className="font-medium">{data.kunde.name || "—"}</p>
                    {data.kunde.strasse && <p className="text-muted-foreground">{data.kunde.strasse}</p>}
                    {(data.kunde.plz || data.kunde.ort) && (
                      <p className="text-muted-foreground">{data.kunde.plz} {data.kunde.ort}</p>
                    )}
                    {data.kunde.email && <p className="text-xs text-muted-foreground">{data.kunde.email}</p>}
                    {data.kunde.telefon && <p className="text-xs text-muted-foreground">{data.kunde.telefon}</p>}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Positionen */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {data.positionen.length} Positionen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2 font-medium w-10">Pos</th>
                        <th className="text-left px-3 py-2 font-medium w-20">Typ</th>
                        <th className="text-left px-3 py-2 font-medium">Bezeichnung</th>
                        <th className="text-right px-3 py-2 font-medium w-24">Menge</th>
                        <th className="text-right px-3 py-2 font-medium w-24">EP</th>
                        <th className="text-right px-3 py-2 font-medium w-24">GP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.positionen.map((p, i) => (
                        <tr key={i} className={`border-t ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
                          <td className="px-3 py-2 text-muted-foreground">{p.posNr}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${TypColors[p.typ] || "bg-gray-100"}`}>
                              {p.typ}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-medium">{p.bezeichnung}</span>
                            {p.raumName && (
                              <span className="text-xs text-muted-foreground ml-2">({p.raumName})</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground">
                            {p.menge} {p.einheit}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{euro(p.einzelpreis)}</td>
                          <td className="px-3 py-2 text-right font-mono font-medium">{euro(p.gesamtpreis)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Neue Katalog-Einträge */}
            {(data.materialien.length > 0 || data.leistungen.length > 0) && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <CardTitle className="text-sm">
                      Neue Katalog-Einträge anlegen
                    </CardTitle>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Diese Materialien und Leistungen werden in deinem Katalog angelegt (oder aktualisiert)
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Materialien */}
                  {data.materialien.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-medium">{data.materialien.length} Materialien</span>
                      </div>
                      <div className="space-y-1">
                        {data.materialien.map((m, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                              !m.selected ? "opacity-40" : ""
                            }`}
                          >
                            <Checkbox
                              checked={m.selected}
                              onCheckedChange={() => toggleMaterial(i)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{m.name}</p>
                              <div className="flex gap-2 text-xs text-muted-foreground">
                                <span>{m.kategorie}</span>
                                {m.lieferant && <span>| {m.lieferant}</span>}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-mono">{euro(m.vkPreis)}</p>
                              <p className="text-xs text-muted-foreground">/{m.einheit}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Leistungen */}
                  {data.leistungen.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Wrench className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">{data.leistungen.length} Leistungen</span>
                      </div>
                      <div className="space-y-1">
                        {data.leistungen.map((l, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                              !l.selected ? "opacity-40" : ""
                            }`}
                          >
                            <Checkbox
                              checked={l.selected}
                              onCheckedChange={() => toggleLeistung(i)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{l.name}</p>
                              <span className="text-xs text-muted-foreground">{l.kategorie}</span>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-mono">{euro(l.preisProEinheit)}</p>
                              <p className="text-xs text-muted-foreground">/{l.einheit}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Import Button */}
            {imported && importResult ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                      <Check className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold">Angebot {importResult.nummer} importiert</p>
                      <p className="text-sm text-muted-foreground">
                        {importResult.positionenCount} Positionen
                        {importResult.matCreated > 0 && ` | ${importResult.matCreated} Materialien angelegt`}
                        {importResult.leistCreated > 0 && ` | ${importResult.leistCreated} Leistungen angelegt`}
                      </p>
                    </div>
                    <div className="flex gap-3 justify-center">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setData(null);
                          setImported(false);
                          setImportResult(null);
                          setFileName("");
                        }}
                      >
                        Weiteres importieren
                      </Button>
                      <Button onClick={() => router.push("/dashboard/angebote")}>
                        Zu Angeboten <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Button
                className="w-full h-12"
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Wird importiert...
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 mr-2" />
                    Angebot importieren ({data.positionen.length} Positionen
                    {data.materialien.filter((m) => m.selected).length > 0 &&
                      ` + ${data.materialien.filter((m) => m.selected).length} Materialien`}
                    {data.leistungen.filter((l) => l.selected).length > 0 &&
                      ` + ${data.leistungen.filter((l) => l.selected).length} Leistungen`}
                    )
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </div>
    </>
  );
}
