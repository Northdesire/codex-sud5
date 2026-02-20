"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, Save, Download, CalendarDays, Users, Home } from "lucide-react";
import { toast } from "sonner";
import { formatEuro } from "@/lib/kalkulation";

interface SaisonPreis {
  id: string;
  saisonId: string;
  preisProNacht: number;
  saison: Saison;
}

interface Komplex {
  id: string;
  name: string;
}

interface Unterkunft {
  id: string;
  name: string;
  beschreibung: string | null;
  typ: string;
  kapazitaet: number;
  preisProNacht: number;
  aktiv: boolean;
  komplexId: string | null;
  komplex: Komplex | null;
  saisonPreise: SaisonPreis[];
}

interface Saison {
  id: string;
  name: string;
  von: string;
  bis: string;
  faktor: number;
}

interface FewoExtra {
  id: string;
  name: string;
  preis: number;
  einheit: string;
  unterkunftTypen: string[];
  aktiv: boolean;
}

interface Kunde {
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  email: string;
  telefon: string;
}

export default function FewoFormularPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editAngebotId, setEditAngebotId] = useState<string | null>(null);

  // Stammdaten
  const [unterkuenfte, setUnterkuenfte] = useState<Unterkunft[]>([]);
  const [saisons, setSaisons] = useState<Saison[]>([]);
  const [extras, setExtras] = useState<FewoExtra[]>([]);

  // Formular
  const [kunde, setKunde] = useState<Kunde>({
    name: "", strasse: "", plz: "", ort: "", email: "", telefon: "",
  });
  const [anreise, setAnreise] = useState("");
  const [abreise, setAbreise] = useState("");
  const [personen, setPersonen] = useState(2);
  const [selectedUnterkunftId, setSelectedUnterkunftId] = useState("");
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());
  const [mwstSatz] = useState(7);

  // Nächte berechnen
  const naechte = useMemo(() => {
    if (!anreise || !abreise) return 0;
    const diff = new Date(abreise).getTime() - new Date(anreise).getTime();
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
  }, [anreise, abreise]);

  // Saison erkennen anhand Anreisedatum
  const erkAnnteSaison = useMemo(() => {
    if (!anreise || saisons.length === 0) return null;
    const d = new Date(anreise);
    return saisons.find((s) => {
      const von = new Date(s.von);
      const bis = new Date(s.bis);
      return d >= von && d <= bis;
    }) || null;
  }, [anreise, saisons]);

  const selectedUnterkunft = unterkuenfte.find((u) => u.id === selectedUnterkunftId) || null;

  // Extras filtern: nur die passend zum Unterkunft-Typ anzeigen
  const filteredExtras = useMemo(() => {
    if (!selectedUnterkunft) return extras;
    return extras.filter(
      (e) => e.unterkunftTypen.length === 0 || e.unterkunftTypen.includes(selectedUnterkunft.typ)
    );
  }, [extras, selectedUnterkunft]);

  // Effektiver Preis pro Nacht: SaisonPreis wenn vorhanden, sonst Basispreis
  const effektiverPreisProNacht = useMemo(() => {
    if (!selectedUnterkunft) return 0;
    if (erkAnnteSaison) {
      const sp = selectedUnterkunft.saisonPreise?.find(
        (p) => p.saisonId === erkAnnteSaison.id
      );
      if (sp) return sp.preisProNacht;
    }
    return selectedUnterkunft.preisProNacht;
  }, [selectedUnterkunft, erkAnnteSaison]);

  // Kalkulation
  const unterkunftNetto = useMemo(() => {
    if (!selectedUnterkunft || naechte === 0) return 0;
    return Math.round(naechte * effektiverPreisProNacht * 100) / 100;
  }, [selectedUnterkunft, naechte, effektiverPreisProNacht]);

  const extrasNetto = useMemo(() => {
    let sum = 0;
    for (const extraId of selectedExtras) {
      const extra = extras.find((e) => e.id === extraId);
      if (!extra) continue;
      switch (extra.einheit) {
        case "pauschal":
          sum += extra.preis;
          break;
        case "pro Nacht":
          sum += extra.preis * naechte;
          break;
        case "pro Person":
          sum += extra.preis * personen;
          break;
        case "pro Nacht/Person":
          sum += extra.preis * naechte * personen;
          break;
        default:
          sum += extra.preis;
      }
    }
    return Math.round(sum * 100) / 100;
  }, [selectedExtras, extras, naechte, personen]);

  const netto = unterkunftNetto + extrasNetto;
  const mwstBetrag = Math.round(netto * (mwstSatz / 100) * 100) / 100;
  const brutto = Math.round((netto + mwstBetrag) * 100) / 100;

  // Daten laden
  useEffect(() => {
    Promise.all([
      fetch("/api/unterkuenfte").then((r) => r.json()),
      fetch("/api/saisons").then((r) => r.json()),
      fetch("/api/fewo-extras").then((r) => r.json()),
    ]).then(([u, s, e]) => {
      if (Array.isArray(u)) setUnterkuenfte(u.filter((x: Unterkunft) => x.aktiv));
      if (Array.isArray(s)) setSaisons(s);
      if (Array.isArray(e)) setExtras(e.filter((x: FewoExtra) => x.aktiv));
    }).catch(() => {});

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
        if (parsed.anreise) setAnreise(parsed.anreise);
        if (parsed.abreise) setAbreise(parsed.abreise);
        if (parsed.personen) setPersonen(parsed.personen);
        // Wünsche → Extras auto-matchen (wird nach Extras-Laden gemacht)
        if (parsed.wuensche) {
          sessionStorage.setItem("fewo-wuensche", JSON.stringify(parsed.wuensche));
        }
        sessionStorage.removeItem("ai-ergebnis");
      } catch {
        // ignore
      }
    }
  }, []);

  // Wenn Extras geladen: AI-Wünsche matchen
  useEffect(() => {
    if (extras.length === 0) return;
    const wuenscheRaw = sessionStorage.getItem("fewo-wuensche");
    if (!wuenscheRaw) return;
    try {
      const wuensche: string[] = JSON.parse(wuenscheRaw);
      const matched = new Set<string>();
      for (const wunsch of wuensche) {
        const w = wunsch.toLowerCase();
        const match = extras.find(
          (e) => e.name.toLowerCase().includes(w) || w.includes(e.name.toLowerCase())
        );
        if (match) matched.add(match.id);
      }
      if (matched.size > 0) setSelectedExtras(matched);
      sessionStorage.removeItem("fewo-wuensche");
    } catch {
      // ignore
    }
  }, [extras]);

  // Edit-Modus: Angebot laden
  useEffect(() => {
    if (!editAngebotId) return;
    fetch(`/api/angebote/${editAngebotId}`)
      .then((r) => r.json())
      .then((a) => {
        if (!a || a.error) return;
        setKunde({
          name: a.kundeName || "",
          strasse: a.kundeStrasse || "",
          plz: a.kundePlz || "",
          ort: a.kundeOrt || "",
          email: a.kundeEmail || "",
          telefon: a.kundeTelefon || "",
        });
        if (a.anreise) setAnreise(a.anreise.split("T")[0]);
        if (a.abreise) setAbreise(a.abreise.split("T")[0]);
        if (a.personen) setPersonen(a.personen);
        // Positionen → Unterkunft + Extras zuordnen
        if (Array.isArray(a.positionen)) {
          // Unterkunft-Position finden (typ PRODUKT, erste Position)
          // Extras werden nach dem Laden der Stammdaten gematcht
          sessionStorage.setItem("fewo-edit-positionen", JSON.stringify(a.positionen));
        }
      })
      .catch(() => {});
  }, [editAngebotId]);

  // Edit-Positionen matchen nachdem Stammdaten geladen
  useEffect(() => {
    if (unterkuenfte.length === 0 || extras.length === 0) return;
    const posRaw = sessionStorage.getItem("fewo-edit-positionen");
    if (!posRaw) return;
    try {
      const positionen: Array<{ typ: string; bezeichnung: string }> = JSON.parse(posRaw);
      // Unterkunft matchen
      const unterkunftPos = positionen.find((p) => p.typ === "PRODUKT");
      if (unterkunftPos) {
        const match = unterkuenfte.find(
          (u) => unterkunftPos.bezeichnung.toLowerCase().includes(u.name.toLowerCase())
        );
        if (match) setSelectedUnterkunftId(match.id);
      }
      // Extras matchen
      const extraPositionen = positionen.filter((p) => p.typ === "ZUSCHLAG");
      const matched = new Set<string>();
      for (const pos of extraPositionen) {
        const match = extras.find(
          (e) => pos.bezeichnung.toLowerCase().includes(e.name.toLowerCase())
        );
        if (match) matched.add(match.id);
      }
      if (matched.size > 0) setSelectedExtras(matched);
      sessionStorage.removeItem("fewo-edit-positionen");
    } catch {
      // ignore
    }
  }, [unterkuenfte, extras]);

  // Auto-select erste Unterkunft wenn nur eine vorhanden
  useEffect(() => {
    if (unterkuenfte.length === 1 && !selectedUnterkunftId) {
      setSelectedUnterkunftId(unterkuenfte[0].id);
    }
  }, [unterkuenfte, selectedUnterkunftId]);

  function toggleExtra(id: string) {
    setSelectedExtras((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function extraBetrag(extra: FewoExtra): number {
    switch (extra.einheit) {
      case "pauschal": return extra.preis;
      case "pro Nacht": return extra.preis * naechte;
      case "pro Person": return extra.preis * personen;
      case "pro Nacht/Person": return extra.preis * naechte * personen;
      default: return extra.preis;
    }
  }

  async function handleSave() {
    if (!kunde.name) {
      toast.error("Bitte Gastnamen angeben");
      return;
    }
    if (!selectedUnterkunft) {
      toast.error("Bitte Unterkunft auswählen");
      return;
    }
    if (naechte === 0) {
      toast.error("Bitte Anreise und Abreise angeben");
      return;
    }
    setSaving(true);

    // Positionen aufbauen
    const positionen = [];
    let posNr = 1;

    // Unterkunft als Hauptposition
    const saisonHinweis = erkAnnteSaison ? ` (${erkAnnteSaison.name})` : "";
    positionen.push({
      posNr: posNr++,
      typ: "PRODUKT",
      bezeichnung: `${selectedUnterkunft.name}${saisonHinweis} — ${naechte} Nächte`,
      menge: naechte,
      einheit: "Nacht",
      einzelpreis: Math.round(effektiverPreisProNacht * 100) / 100,
      gesamtpreis: unterkunftNetto,
    });

    // Extras als Zuschlag-Positionen
    for (const extraId of selectedExtras) {
      const extra = extras.find((e) => e.id === extraId);
      if (!extra) continue;
      const betrag = extraBetrag(extra);
      let menge = 1;
      let einheit = extra.einheit;
      const ep = extra.preis;

      switch (extra.einheit) {
        case "pro Nacht":
          menge = naechte;
          einheit = "Nacht";
          break;
        case "pro Person":
          menge = personen;
          einheit = "Person";
          break;
        case "pro Nacht/Person":
          menge = naechte * personen;
          einheit = "Nacht/Pers.";
          break;
        default:
          menge = 1;
          einheit = "pauschal";
      }

      positionen.push({
        posNr: posNr++,
        typ: "ZUSCHLAG",
        bezeichnung: extra.name,
        menge,
        einheit,
        einzelpreis: ep,
        gesamtpreis: Math.round(betrag * 100) / 100,
      });
    }

    try {
      const payload = {
        kunde,
        positionen,
        raeume: [],
        materialNetto: 0,
        arbeitsNetto: unterkunftNetto,
        anfahrt: 0,
        zuschlagNetto: extrasNetto,
        rabattNetto: 0,
        netto,
        mwstSatz,
        mwstBetrag,
        brutto,
        eingabeMethode: "FORMULAR",
        anreise,
        abreise,
        naechte,
        personen,
      };

      let res: Response;
      if (editAngebotId) {
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
    if (!selectedUnterkunft || naechte === 0) return;
    setPdfLoading(true);

    try {
      const { generateAngebotPDF } = await import("@/lib/pdf");

      const positionen = [];
      let posNr = 1;
      const pdfSaisonHinweis = erkAnnteSaison ? ` (${erkAnnteSaison.name})` : "";
      positionen.push({
        posNr: posNr++,
        typ: "PRODUKT" as const,
        bezeichnung: `${selectedUnterkunft.name}${pdfSaisonHinweis} — ${naechte} Nächte`,
        menge: naechte,
        einheit: "Nacht",
        einzelpreis: Math.round(effektiverPreisProNacht * 100) / 100,
        gesamtpreis: unterkunftNetto,
      });
      for (const extraId of selectedExtras) {
        const extra = extras.find((e) => e.id === extraId);
        if (!extra) continue;
        const betrag = extraBetrag(extra);
        positionen.push({
          posNr: posNr++,
          typ: "ZUSCHLAG" as const,
          bezeichnung: extra.name,
          menge: 1,
          einheit: extra.einheit,
          einzelpreis: extra.preis,
          gesamtpreis: Math.round(betrag * 100) / 100,
        });
      }

      const blob = generateAngebotPDF({
        positionen,
        raeume: [],
        materialNetto: 0,
        arbeitsNetto: unterkunftNetto,
        anfahrt: 0,
        zuschlagNetto: extrasNetto,
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
      a.download = `Angebot_${kunde.name.replace(/\s+/g, "_") || "FeWo"}.pdf`;
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
            {editAngebotId ? "Angebot bearbeiten" : "FeWo-Angebot erstellen"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Unterkunft, Zeitraum und Extras konfigurieren
          </p>
        </div>
      </div>

      {/* Kundendaten / Gast */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Gast
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Name *</Label>
            <Input
              value={kunde.name}
              onChange={(e) => setKunde({ ...kunde, name: e.target.value })}
              placeholder="Max Mustermann"
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

      {/* Aufenthalt */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Aufenthalt
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Anreise *</Label>
              <Input
                type="date"
                value={anreise}
                onChange={(e) => setAnreise(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Abreise *</Label>
              <Input
                type="date"
                value={abreise}
                onChange={(e) => setAbreise(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nächte</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-mono font-medium">
                {naechte > 0 ? naechte : "—"}
              </div>
            </div>
            <div>
              <Label className="text-xs">Personen *</Label>
              <Input
                type="number"
                min={1}
                value={personen}
                onChange={(e) => setPersonen(parseInt(e.target.value) || 1)}
                className="h-9"
              />
            </div>
          </div>
          {erkAnnteSaison && (
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span>Saison: <strong>{erkAnnteSaison.name}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unterkunft */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Home className="h-4 w-4" />
            Unterkunft
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {unterkuenfte.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              Noch keine Unterkünfte angelegt. Bitte zuerst im Dashboard anlegen.
            </p>
          ) : (
            <>
              <select
                value={selectedUnterkunftId}
                onChange={(e) => setSelectedUnterkunftId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— Unterkunft wählen —</option>
                {(() => {
                  const withKomplex = unterkuenfte.filter((u) => u.komplex);
                  const withoutKomplex = unterkuenfte.filter((u) => !u.komplex);
                  const komplexNames = [...new Set(withKomplex.map((u) => u.komplex!.name))];

                  return (
                    <>
                      {komplexNames.map((kName) => (
                        <optgroup key={kName} label={kName}>
                          {withKomplex.filter((u) => u.komplex!.name === kName).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} — {formatEuro(u.preisProNacht)}/Nacht (max. {u.kapazitaet} Pers.)
                            </option>
                          ))}
                        </optgroup>
                      ))}
                      {withoutKomplex.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} — {formatEuro(u.preisProNacht)}/Nacht (max. {u.kapazitaet} Pers.)
                        </option>
                      ))}
                    </>
                  );
                })()}
              </select>
              {selectedUnterkunft && (
                <div className="rounded-md bg-muted/50 px-3 py-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Grundpreis/Nacht</span>
                    <span className="font-mono">{formatEuro(selectedUnterkunft.preisProNacht)}</span>
                  </div>
                  {effektiverPreisProNacht !== selectedUnterkunft.preisProNacht && (
                    <div className="flex justify-between text-sm">
                      <span>Saisonpreis/Nacht{erkAnnteSaison ? ` (${erkAnnteSaison.name})` : ""}</span>
                      <span className="font-mono font-medium">
                        {formatEuro(Math.round(effektiverPreisProNacht * 100) / 100)}
                      </span>
                    </div>
                  )}
                  {naechte > 0 && (
                    <>
                      <Separator className="my-1" />
                      <div className="flex justify-between text-sm font-medium">
                        <span>{naechte} Nächte</span>
                        <span className="font-mono">{formatEuro(unterkunftNetto)}</span>
                      </div>
                    </>
                  )}
                  {selectedUnterkunft.beschreibung && (
                    <p className="text-xs text-muted-foreground mt-1">{selectedUnterkunft.beschreibung}</p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Extras */}
      {filteredExtras.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Extras</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredExtras.map((extra) => {
              const checked = selectedExtras.has(extra.id);
              const betrag = extraBetrag(extra);
              return (
                <label
                  key={extra.id}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors ${
                    checked ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleExtra(extra.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{extra.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatEuro(extra.preis)} {extra.einheit}
                    </p>
                  </div>
                  {checked && naechte > 0 && (
                    <span className="text-sm font-mono font-medium shrink-0">
                      {formatEuro(Math.round(betrag * 100) / 100)}
                    </span>
                  )}
                </label>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Summenblock */}
      {selectedUnterkunft && naechte > 0 && (
        <Card>
          <CardContent className="pt-5 space-y-2">
            <div className="flex justify-between text-sm">
              <p>Unterkunft ({naechte} Nächte)</p>
              <p className="font-mono">{formatEuro(unterkunftNetto)}</p>
            </div>
            {extrasNetto > 0 && (
              <div className="flex justify-between text-sm">
                <p>Extras</p>
                <p className="font-mono">{formatEuro(extrasNetto)}</p>
              </div>
            )}
            <Separator />
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
          disabled={pdfLoading || !selectedUnterkunft || naechte === 0}
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
          disabled={saving || saved || !selectedUnterkunft || naechte === 0}
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
