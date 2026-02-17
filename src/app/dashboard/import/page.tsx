"use client";

import { useState, useRef } from "react";
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
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface ExtractedItem {
  name: string;
  typ: "MATERIAL" | "LEISTUNG";
  kategorie: string;
  leistungsKat?: string | null;
  ekPreis: number;
  vkPreis: number;
  preisProEinheit?: number | null;
  einheit: string;
  ergiebigkeit?: number | null;
  anstriche?: number | null;
  lieferant?: string | null;
  artikelNr?: string | null;
  selected?: boolean;
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [summary, setSummary] = useState("");
  const [fileName, setFileName] = useState("");

  async function handleFileUpload(file: File) {
    setFileName(file.name);
    setExtracting(true);
    setItems([]);
    setSummary("");
    setImported(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ai/extract-catalog", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Extraktion fehlgeschlagen");
      }

      const data = await res.json();
      setItems(
        (data.produkte || []).map((p: ExtractedItem) => ({
          ...p,
          selected: true,
        }))
      );
      setSummary(data.zusammenfassung || "");

      if (data.produkte?.length > 0) {
        toast.success(`${data.produkte.length} Produkte erkannt`);
      } else {
        toast.info("Keine Produkte im Dokument gefunden");
      }
    } catch (error) {
      console.error("Extraktion Fehler:", error);
      toast.error(
        error instanceof Error ? error.message : "Fehler bei der Analyse"
      );
    } finally {
      setExtracting(false);
    }
  }

  async function handleImport() {
    const selected = items.filter((i) => i.selected);
    if (selected.length === 0) {
      toast.error("Keine Produkte ausgewählt");
      return;
    }

    setImporting(true);
    try {
      const res = await fetch("/api/ai/import-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: selected }),
      });

      if (!res.ok) throw new Error("Import fehlgeschlagen");

      const result = await res.json();
      setImported(true);
      toast.success(
        `${result.materialCount} Materialien + ${result.leistungCount} Leistungen importiert${result.skipCount > 0 ? ` (${result.skipCount} übersprungen)` : ""}`
      );
    } catch (error) {
      console.error("Import Fehler:", error);
      toast.error("Fehler beim Import");
    } finally {
      setImporting(false);
    }
  }

  function toggleItem(index: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  }

  function toggleAll(selected: boolean) {
    setItems((prev) => prev.map((item) => ({ ...item, selected })));
  }

  const materialCount = items.filter(
    (i) => i.typ === "MATERIAL" && i.selected
  ).length;
  const leistungCount = items.filter(
    (i) => i.typ === "LEISTUNG" && i.selected
  ).length;

  return (
    <>
      <Header
        title="AI-Import"
        description="Lade Preislisten, Kataloge oder Fotos hoch — AI extrahiert Materialien & Leistungen"
      />
      <div className="p-8 max-w-4xl space-y-6">
        {/* Upload-Bereich */}
        <Card>
          <CardContent className="pt-6">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/*,.txt,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />

            {!extracting && items.length === 0 && (
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
                  Datei hochladen
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  PDF-Preisliste, Foto einer Preistabelle, oder Textdatei
                </p>
                <div className="flex justify-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">PDF</Badge>
                  <Badge variant="outline">JPG/PNG</Badge>
                  <Badge variant="outline">TXT/CSV</Badge>
                </div>
              </div>
            )}

            {extracting && (
              <div className="py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
                <p className="font-medium">AI analysiert {fileName}...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Produkte & Preise werden extrahiert
                </p>
              </div>
            )}

            {!extracting && items.length > 0 && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{summary}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setItems([]);
                    setSummary("");
                    setImported(false);
                    fileRef.current?.click();
                  }}
                >
                  Andere Datei
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ergebnisse */}
        {items.length > 0 && (
          <>
            {/* Aktions-Leiste */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">
                    {items.length} erkannt
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Package className="h-3 w-3" />
                  {materialCount} Mat.
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Wrench className="h-3 w-3" />
                  {leistungCount} Leist.
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAll(true)}
                >
                  Alle
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAll(false)}
                >
                  Keine
                </Button>
              </div>
            </div>

            {/* Produkt-Liste */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Erkannte Produkte & Leistungen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {items.map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 py-3 ${!item.selected ? "opacity-40" : ""}`}
                    >
                      <Checkbox
                        checked={item.selected}
                        onCheckedChange={() => toggleItem(i)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">
                            {item.name}
                          </p>
                          <Badge
                            variant={
                              item.typ === "MATERIAL"
                                ? "secondary"
                                : "outline"
                            }
                            className="text-[10px] shrink-0"
                          >
                            {item.typ === "MATERIAL" ? "Material" : "Leistung"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{item.kategorie}</span>
                          {item.lieferant && <span>· {item.lieferant}</span>}
                          {item.ergiebigkeit && (
                            <span>· {item.ergiebigkeit} m²/{item.einheit}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {item.typ === "MATERIAL" ? (
                          <>
                            <p className="text-sm font-mono font-medium">
                              {item.vkPreis.toFixed(2)} €
                            </p>
                            {item.ekPreis > 0 && (
                              <p className="text-[10px] text-muted-foreground">
                                EK: {item.ekPreis.toFixed(2)} €
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-sm font-mono font-medium">
                            {(item.preisProEinheit || item.vkPreis).toFixed(2)}{" "}
                            €/{item.einheit}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Import Button */}
            <Button
              className="w-full h-12"
              onClick={handleImport}
              disabled={
                importing ||
                imported ||
                items.filter((i) => i.selected).length === 0
              }
            >
              {imported ? (
                <>
                  <Check className="h-5 w-5 mr-2" />
                  Importiert!
                </>
              ) : importing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Wird importiert...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 mr-2" />
                  {materialCount + leistungCount} Produkte importieren
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </>
  );
}
