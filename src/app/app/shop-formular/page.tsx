"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Trash2, Rocket, ArrowLeft, Save, Download, AlertTriangle, MessageSquareText, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { formatEuro } from "@/lib/kalkulation";

interface Produkt {
  id: string;
  name: string;
  kategorie: string;
  artikelNr: string | null;
  vkPreis: number;
  einheit: string;
}

interface ShopPosition {
  id: string;
  produktId: string | null;
  name: string;
  menge: number;
  einheit: string;
  einzelpreis: number;
  fromAi?: boolean;
}

interface Kunde {
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  email: string;
  telefon: string;
}

export default function ShopFormularPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editAngebotId, setEditAngebotId] = useState<string | null>(null);
  const [produkte, setProdukte] = useState<Produkt[]>([]);
  const [positionen, setPositionen] = useState<ShopPosition[]>([]);
  const [kunde, setKunde] = useState<Kunde>({
    name: "", strasse: "", plz: "", ort: "", email: "", telefon: "",
  });
  const [mwstSatz, setMwstSatz] = useState(19);
  const [originalText, setOriginalText] = useState("");
  const [originalImage, setOriginalImage] = useState("");
  const [showOriginalText, setShowOriginalText] = useState(false);

  // Produkte und AI-Ergebnis laden
  useEffect(() => {
    fetch("/api/produkte")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProdukte(data);
      })
      .catch(() => {});

    // MwSt-Satz laden
    fetch("/api/firma/branche")
      .then((r) => r.json())
      .catch(() => {});

    // Edit-Modus prüfen
    const editId = sessionStorage.getItem("edit-angebot-id");
    if (editId) {
      setEditAngebotId(editId);
      sessionStorage.removeItem("edit-angebot-id");
    }

    // AI-Ergebnis laden
    const aiData = sessionStorage.getItem("ai-ergebnis");
    if (aiData) {
      try {
        const parsed = JSON.parse(aiData);
        if (parsed.kunde) setKunde(parsed.kunde);
        if (Array.isArray(parsed.produkte)) {
          setPositionen(
            parsed.produkte.map((p: { name: string; menge: number; einheit?: string; preis?: number }, i: number) => ({
              id: `ai_${i}`,
              produktId: null,
              name: p.name || "",
              menge: p.menge || 1,
              einheit: p.einheit || "Stk.",
              einzelpreis: p.preis || 0,
              fromAi: true,
            }))
          );
        }
        sessionStorage.removeItem("ai-ergebnis");
      } catch {
        // ignore
      }
    }

    const aiOriginal = sessionStorage.getItem("ai-originaltext");
    if (aiOriginal) {
      setOriginalText(aiOriginal);
      sessionStorage.removeItem("ai-originaltext");
    }
    const aiImage = sessionStorage.getItem("ai-originalimage");
    if (aiImage) {
      setOriginalImage(aiImage);
      sessionStorage.removeItem("ai-originalimage");
    }
  }, []);

  // Wenn Produkte geladen: AI-Positionen mit Katalog matchen
  useEffect(() => {
    if (produkte.length === 0) return;
    setPositionen((prev) =>
      prev.map((pos) => {
        if (pos.produktId) return pos;
        // Versuche Produkt im Katalog zu finden
        const match = produkte.find(
          (p) => p.name.toLowerCase().includes(pos.name.toLowerCase()) ||
                 pos.name.toLowerCase().includes(p.name.toLowerCase())
        );
        if (match) {
          return {
            ...pos,
            produktId: match.id,
            name: match.name,
            einzelpreis: match.vkPreis,
            einheit: match.einheit,
          };
        }
        return pos;
      })
    );
  }, [produkte]);

  function addPosition() {
    setPositionen([
      ...positionen,
      {
        id: `new_${Date.now()}`,
        produktId: null,
        name: "",
        menge: 1,
        einheit: "Stk.",
        einzelpreis: 0,
      },
    ]);
  }

  function addVersand() {
    setPositionen([
      ...positionen,
      {
        id: `versand_${Date.now()}`,
        produktId: null,
        name: "Versandkosten",
        menge: 1,
        einheit: "pauschal",
        einzelpreis: 0,
      },
    ]);
  }

  function removePosition(id: string) {
    setPositionen(positionen.filter((p) => p.id !== id));
  }

  function updatePosition(id: string, field: string, value: string | number) {
    setPositionen((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  }

  function selectProdukt(posId: string, produktId: string) {
    const prod = produkte.find((p) => p.id === produktId);
    if (!prod) return;
    setPositionen((prev) =>
      prev.map((p) =>
        p.id === posId
          ? { ...p, produktId: prod.id, name: prod.name, einzelpreis: prod.vkPreis, einheit: prod.einheit }
          : p
      )
    );
  }

  // Berechnungen
  const netto = positionen.reduce(
    (sum, p) => sum + Math.round(p.menge * p.einzelpreis * 100) / 100,
    0
  );
  const mwstBetrag = Math.round(netto * (mwstSatz / 100) * 100) / 100;
  const brutto = Math.round((netto + mwstBetrag) * 100) / 100;

  async function handleSave() {
    if (!kunde.name) {
      toast.error("Bitte Kundennamen angeben");
      return;
    }
    if (positionen.length === 0) {
      toast.error("Mindestens eine Position nötig");
      return;
    }
    setSaving(true);

    const angebotPositionen = positionen.map((p, i) => ({
      posNr: i + 1,
      typ: "PRODUKT" as const,
      bezeichnung: p.name,
      menge: p.menge,
      einheit: p.einheit,
      einzelpreis: p.einzelpreis,
      gesamtpreis: Math.round(p.menge * p.einzelpreis * 100) / 100,
    }));

    try {
      const payload = {
        kunde,
        positionen: angebotPositionen,
        raeume: [],
        materialNetto: 0,
        arbeitsNetto: netto,
        anfahrt: 0,
        zuschlagNetto: 0,
        rabattNetto: 0,
        netto,
        mwstSatz,
        mwstBetrag,
        brutto,
        eingabeMethode: "FORMULAR",
      };

      let res: Response;
      if (editAngebotId) {
        // Bestehendes Angebot aktualisieren
        res = await fetch(`/api/angebote/${editAngebotId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            kundeName: kunde.name,
            kundeStrasse: kunde.strasse,
            kundePlz: kunde.plz,
            kundeOrt: kunde.ort,
            kundeEmail: kunde.email,
            kundeTelefon: kunde.telefon,
          }),
        });
      } else {
        // Neues Angebot erstellen
        res = await fetch("/api/angebote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error("Speichern fehlgeschlagen");

      setSaved(true);
      toast.success(editAngebotId ? "Angebot aktualisiert!" : "Angebot gespeichert!");
      router.push(editAngebotId ? `/app/uebersicht/${editAngebotId}` : "/app/uebersicht");
    } catch (error) {
      console.error("Speichern Fehler:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handlePDF() {
    if (positionen.length === 0) return;
    setPdfLoading(true);

    try {
      const { generateAngebotPDF } = await import("@/lib/pdf");
      const allPositionen = positionen.map((p, i) => ({
        posNr: i + 1,
        typ: "PRODUKT" as const,
        bezeichnung: p.name,
        menge: p.menge,
        einheit: p.einheit,
        einzelpreis: p.einzelpreis,
        gesamtpreis: Math.round(p.menge * p.einzelpreis * 100) / 100,
      }));

      const blob = generateAngebotPDF({
        positionen: allPositionen,
        raeume: [],
        materialNetto: 0,
        arbeitsNetto: netto,
        anfahrt: 0,
        zuschlagNetto: 0,
        rabattNetto: 0,
        netto,
        mwstSatz,
        mwstBetrag,
        brutto,
        kunde,
        firma: null,
        nummer: "Entwurf",
        datum: new Date(),
        gueltigBis: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Angebot_${kunde.name.replace(/\s+/g, "_") || "Shop"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF Fehler:", error);
      toast.error("Fehler beim PDF-Erstellen");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="px-5 pt-6 space-y-4 pb-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">
            {editAngebotId ? "Angebot bearbeiten" : "Shop-Angebot erstellen"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Produkte auswählen und Mengen angeben
          </p>
        </div>
      </div>

      {/* Originaltext der Anfrage */}
      {(originalText || originalImage) && (
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
            <CardContent className="pt-0 pb-4 px-5 space-y-3">
              {originalImage && (
                <img src={originalImage} alt="Anfrage" className="rounded-md max-h-64 object-contain" />
              )}
              {originalText && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {originalText}
                </p>
              )}
            </CardContent>
          )}
        </Card>
      )}

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
              onChange={(e) => setKunde({ ...kunde, name: e.target.value })}
              placeholder="Max Mustermann GmbH"
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">E-Mail</Label>
              <Input
                value={kunde.email}
                onChange={(e) => setKunde({ ...kunde, email: e.target.value })}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Telefon</Label>
              <Input
                value={kunde.telefon}
                onChange={(e) => setKunde({ ...kunde, telefon: e.target.value })}
                className="h-9"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Straße</Label>
            <Input
              value={kunde.strasse}
              onChange={(e) => setKunde({ ...kunde, strasse: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">PLZ</Label>
              <Input
                value={kunde.plz}
                onChange={(e) => setKunde({ ...kunde, plz: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Ort</Label>
              <Input
                value={kunde.ort}
                onChange={(e) => setKunde({ ...kunde, ort: e.target.value })}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Produktpositionen */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Positionen</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addPosition}>
                <Plus className="h-4 w-4 mr-1" />
                Produkt
              </Button>
              <Button variant="outline" size="sm" onClick={addVersand}>
                <Plus className="h-4 w-4 mr-1" />
                Versand
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {positionen.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Noch keine Positionen. Klicke auf &ldquo;+ Produkt&rdquo; oder nutze die AI-Eingabe.
            </p>
          )}

          {positionen.map((pos) => {
            const isUnmatchedAi = pos.fromAi && !pos.produktId;
            const matchedProdukt = pos.produktId ? produkte.find((p) => p.id === pos.produktId) : null;
            return (
            <div key={pos.id} className={`rounded-lg border p-3 space-y-2 ${isUnmatchedAi ? "border-yellow-400 bg-yellow-50/50" : ""}`}>
              {isUnmatchedAi && (
                <div className="flex items-center gap-1.5 text-yellow-700 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Nicht im Katalog gefunden — bitte Preis prüfen
                </div>
              )}
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  {/* Produkt-Auswahl */}
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Produkt</Label>
                    {produkte.length > 0 ? (
                      <select
                        value={pos.produktId || "custom"}
                        onChange={(e) => {
                          if (e.target.value === "custom") {
                            updatePosition(pos.id, "produktId", "");
                          } else {
                            selectProdukt(pos.id, e.target.value);
                          }
                        }}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      >
                        <option value="custom">-- Nicht im Katalog --</option>
                        {produkte.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({formatEuro(p.vkPreis)}/{p.einheit})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={pos.name}
                        onChange={(e) => updatePosition(pos.id, "name", e.target.value)}
                        placeholder="Produktname"
                        className="h-9"
                      />
                    )}
                    {matchedProdukt?.artikelNr && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Art.-Nr.: {matchedProdukt.artikelNr}</p>
                    )}
                  </div>

                  {/* Wenn kein Produkt aus Katalog: Name manuell */}
                  {produkte.length > 0 && !pos.produktId && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Bezeichnung</Label>
                      <Input
                        value={pos.name}
                        onChange={(e) => updatePosition(pos.id, "name", e.target.value)}
                        placeholder="z.B. Spezial-Adapter"
                        className="h-9"
                      />
                    </div>
                  )}

                  {/* Menge, Einheit, Preis */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Menge</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="1"
                        value={pos.menge}
                        onChange={(e) => updatePosition(pos.id, "menge", parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Einheit</Label>
                      <Input
                        value={pos.einheit}
                        onChange={(e) => updatePosition(pos.id, "einheit", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">VK-Preis</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={pos.einzelpreis}
                        onChange={(e) => updatePosition(pos.id, "einzelpreis", parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Gesamt + Löschen */}
                <div className="flex flex-col items-end gap-1 pt-5">
                  <p className="font-mono text-sm font-medium">
                    {formatEuro(Math.round(pos.menge * pos.einzelpreis * 100) / 100)}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removePosition(pos.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Summenblock */}
      {positionen.length > 0 && (
        <Card>
          <CardContent className="pt-5 space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <p>Netto</p>
              <p className="font-mono">{formatEuro(netto)}</p>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <p>MwSt. ({mwstSatz}%)</p>
              <p className="font-mono">{formatEuro(mwstBetrag)}</p>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <p>Brutto</p>
              <p className="font-mono text-primary">{formatEuro(brutto)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aktionen */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          className="h-12"
          onClick={handlePDF}
          disabled={pdfLoading || positionen.length === 0}
        >
          {pdfLoading ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1" />
          )}
          PDF
        </Button>
        <Button
          className="h-12 col-span-2"
          onClick={handleSave}
          disabled={saving || saved || positionen.length === 0}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          {saved ? "Gespeichert" : editAngebotId ? "Änderungen speichern" : "Angebot speichern"}
        </Button>
      </div>
    </div>
  );
}
