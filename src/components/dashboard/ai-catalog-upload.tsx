"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  Loader2,
  Sparkles,
  Package,
  Wrench,
  Check,
  FileText,
  Image,
} from "lucide-react";
import { toast } from "sonner";

interface ExtractedItem {
  name: string;
  typ?: "MATERIAL" | "LEISTUNG" | "PRODUKT";
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
  beschreibung?: string | null;
  selected: boolean;
}

function euro(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " \u20AC";
}

interface AICatalogUploadProps {
  /** "material" zeigt nur Materialien, "leistung" nur Leistungen, "produkt" für Shop-Produkte, "all" zeigt beide */
  filterTyp?: "material" | "leistung" | "produkt" | "all";
  /** Callback nach erfolgreichem Import — z.B. Tabelle neu laden */
  onImported?: () => void;
}

export function AICatalogUpload({ filterTyp = "all", onImported }: AICatalogUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [summary, setSummary] = useState("");
  const [fileName, setFileName] = useState("");

  async function handleFile(file: File) {
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Datei zu groß (max. 4 MB)", {
        description: "Bitte eine kleinere Datei verwenden oder als Foto abfotografieren",
      });
      return;
    }

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
        let errorMsg = "Extraktion fehlgeschlagen";
        try {
          const err = await res.json();
          errorMsg = err.error || errorMsg;
        } catch {
          if (res.status === 413) errorMsg = "Datei zu groß (max. 4 MB)";
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      let produkte: ExtractedItem[] = (data.produkte || []).map((p: ExtractedItem) => ({
        ...p,
        selected: true,
      }));

      // Filter by type if needed (Shop products don't have typ field)
      if (filterTyp === "material") {
        produkte = produkte.filter((p) => p.typ === "MATERIAL");
      } else if (filterTyp === "leistung") {
        produkte = produkte.filter((p) => p.typ === "LEISTUNG");
      } else if (filterTyp === "produkt") {
        // Shop mode: all items are products, mark them
        produkte = produkte.map((p) => ({ ...p, typ: "PRODUKT" as const }));
      }

      setItems(produkte);
      setSummary(data.zusammenfassung || "");

      if (produkte.length > 0) {
        toast.success(`${produkte.length} Einträge erkannt`);
      } else {
        toast.info("Keine passenden Einträge gefunden");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fehler bei der Analyse");
    } finally {
      setExtracting(false);
    }
  }

  async function handleImport() {
    const selected = items.filter((i) => i.selected);
    if (selected.length === 0) {
      toast.error("Keine Einträge ausgewählt");
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

      const parts: string[] = [];
      if (result.produktCount > 0) parts.push(`${result.produktCount} Produkte`);
      if (result.materialCount > 0) parts.push(`${result.materialCount} Materialien`);
      if (result.leistungCount > 0) parts.push(`${result.leistungCount} Leistungen`);
      if (result.skipCount > 0) parts.push(`${result.skipCount} übersprungen`);

      toast.success(parts.join(" + ") + " importiert");
      onImported?.();
    } catch {
      toast.error("Fehler beim Import");
    } finally {
      setImporting(false);
    }
  }

  function toggleItem(index: number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    );
  }

  function toggleAll(selected: boolean) {
    setItems((prev) => prev.map((item) => ({ ...item, selected })));
  }

  const selectedCount = items.filter((i) => i.selected).length;
  const produkteCount = items.filter((i) => i.typ === "PRODUKT" && i.selected).length;
  const materialCount = items.filter((i) => i.typ === "MATERIAL" && i.selected).length;
  const leistungCount = items.filter((i) => i.typ === "LEISTUNG" && i.selected).length;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true);
          // Reset state
          if (imported) {
            setItems([]);
            setSummary("");
            setImported(false);
            setFileName("");
          }
        }}
      >
        <Sparkles className="h-4 w-4 mr-1" />
        AI-Import
      </Button>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,image/*,.txt,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI-Import aus Dokument
            </DialogTitle>
          </DialogHeader>

          {/* Upload area */}
          {!extracting && items.length === 0 && (
            <div
              className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <div className="flex justify-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="h-10 w-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Image className="h-5 w-5" />
                </div>
              </div>
              <h3 className="font-semibold mb-1">Preisliste, Rechnung oder Katalog hochladen</h3>
              <p className="text-sm text-muted-foreground mb-3">
                AI erkennt automatisch {filterTyp === "produkt" ? "Produkte" : filterTyp === "material" ? "Materialien" : filterTyp === "leistung" ? "Leistungen" : "Materialien & Leistungen"} mit Preisen
              </p>
              <div className="flex justify-center gap-2 text-xs">
                <Badge variant="outline">PDF</Badge>
                <Badge variant="outline">Foto</Badge>
                <Badge variant="outline">Text</Badge>
              </div>
            </div>
          )}

          {/* Extracting */}
          {extracting && (
            <div className="py-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
              <p className="font-medium">AI analysiert {fileName}...</p>
            </div>
          )}

          {/* Results */}
          {!extracting && items.length > 0 && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{summary}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  setItems([]);
                  setSummary("");
                  setImported(false);
                  fileRef.current?.click();
                }}>
                  Andere Datei
                </Button>
              </div>

              {/* Stats + toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-medium">{items.length} erkannt</span>
                  {produkteCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Package className="h-3 w-3" /> {produkteCount} Prod.
                    </span>
                  )}
                  {materialCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Package className="h-3 w-3" /> {materialCount} Mat.
                    </span>
                  )}
                  {leistungCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Wrench className="h-3 w-3" /> {leistungCount} Leist.
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => toggleAll(true)}>Alle</Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleAll(false)}>Keine</Button>
                </div>
              </div>

              {/* Items list */}
              <div className="divide-y max-h-[40vh] overflow-y-auto rounded-lg border">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-3 py-2.5 ${!item.selected ? "opacity-40" : ""}`}
                  >
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={() => toggleItem(i)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        {item.typ && item.typ !== "PRODUKT" && (
                          <Badge
                            variant={item.typ === "MATERIAL" ? "secondary" : "outline"}
                            className="text-[10px] shrink-0"
                          >
                            {item.typ === "MATERIAL" ? "Material" : "Leistung"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{item.kategorie || item.leistungsKat}</span>
                        {item.lieferant && <span>| {item.lieferant}</span>}
                        {item.artikelNr && <span>| {item.artikelNr}</span>}
                        {item.ergiebigkeit && <span>| {item.ergiebigkeit} m²/{item.einheit}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono">{euro(item.vkPreis)}/{item.einheit}</p>
                      {item.ekPreis > 0 && item.ekPreis !== item.vkPreis && (
                        <p className="text-[10px] text-muted-foreground font-mono">EK {euro(item.ekPreis)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Import button */}
              <Button
                className="w-full"
                onClick={handleImport}
                disabled={importing || imported || selectedCount === 0}
              >
                {imported ? (
                  <><Check className="h-4 w-4 mr-2" /> Importiert!</>
                ) : importing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Wird importiert...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" /> {selectedCount} Einträge importieren</>
                )}
              </Button>

              {imported && (
                <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>
                  Fertig
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
