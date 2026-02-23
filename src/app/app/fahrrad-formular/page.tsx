"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, Save, Download, CalendarDays, Users, Bike, Percent, Plus, Trash2, Mail, Minus } from "lucide-react";
import { toast } from "sonner";
import { formatEuro } from "@/lib/kalkulation";

interface FahrradPreis {
  id: string;
  tag: number;
  gesamtpreis: number;
}

interface Fahrrad {
  id: string;
  name: string;
  kategorie: string;
  beschreibung: string | null;
  aktiv: boolean;
  preisProWeitererTag?: number | null;
  preise: FahrradPreis[];
}

interface FahrradExtra {
  id: string;
  name: string;
  preis: number;
  einheit: string;
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

export default function FahrradFormularPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedAngebotId, setSavedAngebotId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [editAngebotId, setEditAngebotId] = useState<string | null>(null);

  // Stammdaten
  const [fahrraeder, setFahrraeder] = useState<Fahrrad[]>([]);
  const [extras, setExtras] = useState<FahrradExtra[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [firma, setFirma] = useState<any>(null);
  const [einleitungsText, setEinleitungsText] = useState("");
  const [schlussText, setSchlussText] = useState("");

  // Formular
  const [kunde, setKunde] = useState<Kunde>({
    name: "", strasse: "", plz: "", ort: "", email: "", telefon: "",
  });
  const [mietbeginn, setMietbeginn] = useState("");
  const [mietende, setMietende] = useState("");
  const [personen, setPersonen] = useState(1);
  const [bikeSelection, setBikeSelection] = useState<Record<string, number>>({});
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());
  const [rabattProzent, setRabattProzent] = useState("");
  const [rabattGrund, setRabattGrund] = useState("");
  const mwstSatz = 19;

  // Custom Extras
  const [customExtras, setCustomExtras] = useState<Array<{
    id: string; name: string; preis: string; einheit: string;
  }>>([]);

  // Auscheck-Tag Preise
  const [auscheckPreise, setAuscheckPreise] = useState<Record<string, number[]>>({});
  const [auscheckSelection, setAuscheckSelection] = useState<Record<string, number | null>>({});

  // Tage berechnen (inklusiv: 23.-26. = 4 Tage)
  const tage = useMemo(() => {
    if (!mietbeginn || !mietende) return 0;
    const diff = new Date(mietende).getTime() - new Date(mietbeginn).getTime();
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
  }, [mietbeginn, mietende]);

  // Ob Auscheck-Preise konfiguriert sind
  const hasAuscheckPreise = Object.keys(auscheckPreise).length > 0;

  // Miettage = tage - 1 wenn Auscheck konfiguriert, sonst tage
  const miettage = hasAuscheckPreise && tage > 1 ? tage - 1 : tage;

  // Gesamtpreis für ein Fahrrad bei gegebener Tagesanzahl
  function getPreisFuerTage(fahrrad: Fahrrad, anzahlTage: number): number | null {
    if (anzahlTage <= 0 || fahrrad.preise.length === 0) return null;
    // Exakten Tag suchen (1-14)
    const exact = fahrrad.preise.find((p) => p.tag === anzahlTage);
    if (exact) return exact.gesamtpreis;
    // Falls tage > 14: 14-Tage-Preis + Aufpreis pro weiterem Tag
    if (anzahlTage > 14) {
      const sorted = [...fahrrad.preise].sort((a, b) => b.tag - a.tag);
      if (sorted.length === 0) return null;
      const basisPreis = sorted[0].gesamtpreis; // höchster verfügbarer Preis (i.d.R. 14 Tage)
      if (fahrrad.preisProWeitererTag != null && fahrrad.preisProWeitererTag > 0) {
        const zusatzTage = anzahlTage - sorted[0].tag;
        return basisPreis + zusatzTage * fahrrad.preisProWeitererTag;
      }
      return basisPreis; // Fallback: kein Aufpreis definiert
    }
    return null;
  }

  // Gewählte Fahrräder (nur die mit Menge > 0)
  const selectedBikes = useMemo(() => {
    return fahrraeder
      .filter((f) => (bikeSelection[f.id] || 0) > 0)
      .map((f) => ({ ...f, menge: bikeSelection[f.id] }));
  }, [fahrraeder, bikeSelection]);

  const hasBikes = selectedBikes.length > 0;

  // Fahrrad-Brutto (alle Preise sind brutto) — nutzt miettage statt tage
  const fahrradBrutto = useMemo(() => {
    if (!hasBikes || miettage === 0) return 0;
    return Math.round(
      selectedBikes.reduce((sum, bike) => {
        const preis = getPreisFuerTage(bike, miettage);
        if (preis == null) return sum;
        return sum + preis * bike.menge;
      }, 0) * 100
    ) / 100;
  }, [selectedBikes, hasBikes, miettage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auscheck-Tag Brutto: gewählter Preis × Anzahl pro Kategorie
  const auscheckBrutto = useMemo(() => {
    if (!hasAuscheckPreise || tage <= 1) return 0;
    let sum = 0;
    for (const bike of selectedBikes) {
      const kat = bike.kategorie;
      const chosen = auscheckSelection[kat];
      if (chosen != null && chosen > 0) {
        sum += chosen * bike.menge;
      }
    }
    return Math.round(sum * 100) / 100;
  }, [selectedBikes, auscheckSelection, hasAuscheckPreise, tage]);

  // Extras-Brutto (alle Preise sind brutto)
  const extrasBrutto = useMemo(() => {
    let sum = 0;
    for (const extraId of selectedExtras) {
      const extra = extras.find((e) => e.id === extraId);
      if (!extra) continue;
      switch (extra.einheit) {
        case "pauschal": sum += extra.preis; break;
        case "pro Tag": sum += extra.preis * tage; break;
        case "pro Person": sum += extra.preis * personen; break;
        case "pro Tag/Person": sum += extra.preis * tage * personen; break;
        default: sum += extra.preis;
      }
    }
    for (const ce of customExtras) {
      const p = parseFloat(ce.preis) || 0;
      if (p <= 0) continue;
      switch (ce.einheit) {
        case "pauschal": sum += p; break;
        case "pro Tag": sum += p * tage; break;
        case "pro Person": sum += p * personen; break;
        case "pro Tag/Person": sum += p * tage * personen; break;
        default: sum += p;
      }
    }
    return Math.round(sum * 100) / 100;
  }, [selectedExtras, extras, tage, personen, customExtras]);

  // Rabatt (auf Brutto)
  const rabattBrutto = useMemo(() => {
    const pct = parseFloat(rabattProzent);
    if (!pct || pct <= 0) return 0;
    return Math.round((fahrradBrutto + auscheckBrutto + extrasBrutto) * (pct / 100) * 100) / 100;
  }, [fahrradBrutto, auscheckBrutto, extrasBrutto, rabattProzent]);

  // Alle Preise sind brutto → MwSt rückwärts herausrechnen
  const brutto = Math.round((fahrradBrutto + auscheckBrutto + extrasBrutto - rabattBrutto) * 100) / 100;
  const netto = Math.round(brutto / (1 + mwstSatz / 100) * 100) / 100;
  const mwstBetrag = Math.round((brutto - netto) * 100) / 100;

  // Daten laden
  useEffect(() => {
    Promise.all([
      fetch("/api/fahrraeder").then((r) => r.json()),
      fetch("/api/fahrrad-extras").then((r) => r.json()),
      fetch("/api/firma").then((r) => r.json()),
      fetch("/api/textvorlagen").then((r) => r.json()),
      fetch("/api/auscheck-preise").then((r) => r.json()),
    ]).then(([f, e, fi, tv, ap]) => {
      if (Array.isArray(f)) setFahrraeder(f.filter((x: Fahrrad) => x.aktiv));
      if (Array.isArray(e)) setExtras(e.filter((x: FahrradExtra) => x.aktiv));
      if (fi && !fi.error) setFirma(fi);
      if (Array.isArray(ap)) {
        const map: Record<string, number[]> = {};
        for (const a of ap) {
          if (a.kategorie && Array.isArray(a.preisOptionen) && a.preisOptionen.length > 0) {
            map[a.kategorie] = a.preisOptionen;
          }
        }
        setAuscheckPreise(map);
      }
      if (Array.isArray(tv)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const intro = tv.find((v: any) => v.typ === "ANGEBOT_INTRO" && v.aktiv);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const schluss = tv.find((v: any) => v.typ === "ANGEBOT_SCHLUSS" && v.aktiv);
        if (intro) setEinleitungsText(intro.text);
        if (schluss) setSchlussText(schluss.text);
      }
    }).catch(() => {});

    // AI-Ergebnis prüfen
    const aiRaw = sessionStorage.getItem("ai-ergebnis");
    if (aiRaw) {
      try {
        const ai = JSON.parse(aiRaw);
        if (ai.kunde) {
          setKunde({
            name: ai.kunde.name || "",
            strasse: ai.kunde.strasse || "",
            plz: ai.kunde.plz || "",
            ort: ai.kunde.ort || "",
            email: ai.kunde.email || "",
            telefon: ai.kunde.telefon || "",
          });
        }
        if (ai.mietbeginn) setMietbeginn(ai.mietbeginn);
        if (ai.mietende) setMietende(ai.mietende);
        if (ai.personen) setPersonen(ai.personen);
        // Fahrrad-Matching wird im separaten useEffect erledigt
        if (ai.fahrraeder && ai.fahrraeder.length > 0) {
          sessionStorage.setItem("fahrrad-ai-bikes", JSON.stringify(ai.fahrraeder));
        }
        // Wünsche/Extras-Matching wird im separaten useEffect erledigt
        if (ai.wuensche && ai.wuensche.length > 0) {
          sessionStorage.setItem("fahrrad-ai-wuensche", JSON.stringify(ai.wuensche));
        }
      } catch {
        // ignore
      }
      sessionStorage.removeItem("ai-ergebnis");
      sessionStorage.removeItem("ai-originaltext");
    }

    // Edit-Modus prüfen
    const editId = sessionStorage.getItem("edit-angebot-id");
    if (editId) {
      setEditAngebotId(editId);
      sessionStorage.removeItem("edit-angebot-id");
    }
  }, []);

  // AI-Fahrräder matchen (wenn Katalog geladen)
  useEffect(() => {
    if (fahrraeder.length === 0) return;
    const bikesRaw = sessionStorage.getItem("fahrrad-ai-bikes");
    if (!bikesRaw) return;
    try {
      const aiBikes: Array<{ name: string; menge: number }> = JSON.parse(bikesRaw);
      const sel: Record<string, number> = {};
      for (const ab of aiBikes) {
        // Exakte Match oder Teil-Match
        const match = fahrraeder.find((f) =>
          f.name.toLowerCase() === ab.name.toLowerCase() ||
          f.name.toLowerCase().includes(ab.name.toLowerCase()) ||
          ab.name.toLowerCase().includes(f.name.toLowerCase())
        );
        if (match) {
          sel[match.id] = (sel[match.id] || 0) + ab.menge;
        }
      }
      if (Object.keys(sel).length > 0) setBikeSelection(sel);
      sessionStorage.removeItem("fahrrad-ai-bikes");
    } catch {
      // ignore
    }
  }, [fahrraeder]);

  // AI-Wünsche matchen → Extras automatisch auswählen (wenn Extras geladen)
  useEffect(() => {
    if (extras.length === 0) return;
    const wuenscheRaw = sessionStorage.getItem("fahrrad-ai-wuensche");
    if (!wuenscheRaw) return;
    try {
      const wuensche: string[] = JSON.parse(wuenscheRaw);
      const matched = new Set<string>();
      for (const wunsch of wuensche) {
        const wunschLower = wunsch.toLowerCase();
        const match = extras.find((e) =>
          e.name.toLowerCase() === wunschLower ||
          e.name.toLowerCase().includes(wunschLower) ||
          wunschLower.includes(e.name.toLowerCase())
        );
        if (match) matched.add(match.id);
      }
      if (matched.size > 0) {
        setSelectedExtras((prev) => {
          const next = new Set(prev);
          for (const id of matched) next.add(id);
          return next;
        });
      }
      sessionStorage.removeItem("fahrrad-ai-wuensche");
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
        if (a.anreise) setMietbeginn(a.anreise.split("T")[0]);
        if (a.abreise) setMietende(a.abreise.split("T")[0]);
        if (a.personen) setPersonen(a.personen);
        if (Array.isArray(a.positionen)) {
          sessionStorage.setItem("fahrrad-edit-positionen", JSON.stringify(a.positionen));
        }
      })
      .catch(() => {});
  }, [editAngebotId]);

  // Edit-Positionen matchen
  useEffect(() => {
    if (fahrraeder.length === 0) return;
    const posRaw = sessionStorage.getItem("fahrrad-edit-positionen");
    if (!posRaw) return;
    try {
      const positionen: Array<{ typ: string; bezeichnung: string; menge: number; einzelpreis: number }> = JSON.parse(posRaw);
      const bikePos = positionen.filter((p) => p.typ === "PRODUKT");
      const sel: Record<string, number> = {};
      for (const pos of bikePos) {
        const mengeMatch = pos.bezeichnung.match(/^(\d+)\u00d7\s+(.+?)\s+\u2014/);
        if (mengeMatch) {
          const menge = parseInt(mengeMatch[1]);
          const name = mengeMatch[2];
          const match = fahrraeder.find((f) => f.name === name);
          if (match) sel[match.id] = menge;
        }
      }
      if (Object.keys(sel).length > 0) setBikeSelection(sel);
      // Extras matchen
      const extraPos = positionen.filter((p) => p.typ === "ZUSCHLAG");
      const matched = new Set<string>();
      for (const pos of extraPos) {
        const match = extras.find(
          (e) => pos.bezeichnung.toLowerCase().includes(e.name.toLowerCase())
        );
        if (match) matched.add(match.id);
      }
      if (matched.size > 0) setSelectedExtras(matched);
      sessionStorage.removeItem("fahrrad-edit-positionen");
    } catch {
      // ignore
    }
  }, [fahrraeder, extras]);

  function toggleExtra(id: string) {
    setSelectedExtras((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function extraBetrag(extra: FahrradExtra): number {
    switch (extra.einheit) {
      case "pauschal": return extra.preis;
      case "pro Tag": return extra.preis * tage;
      case "pro Person": return extra.preis * personen;
      case "pro Tag/Person": return extra.preis * tage * personen;
      default: return extra.preis;
    }
  }

  function customExtraBetrag(ce: { preis: string; einheit: string }): number {
    const p = parseFloat(ce.preis) || 0;
    switch (ce.einheit) {
      case "pauschal": return p;
      case "pro Tag": return p * tage;
      case "pro Person": return p * personen;
      case "pro Tag/Person": return p * tage * personen;
      default: return p;
    }
  }

  function buildPositionen() {
    const positionen = [];
    let posNr = 1;

    // Fahrräder als PRODUKT-Positionen (miettage statt tage)
    for (const bike of selectedBikes) {
      const preis = getPreisFuerTage(bike, miettage);
      if (preis == null) continue;
      const tageLabel = hasAuscheckPreise && tage > 1
        ? `${miettage} Miettage`
        : `${tage} ${tage === 1 ? "Tag" : "Tage"}`;
      positionen.push({
        posNr: posNr++,
        typ: "PRODUKT",
        bezeichnung: `${bike.menge}\u00d7 ${bike.name} \u2014 ${tageLabel}`,
        menge: bike.menge,
        einheit: "Stk.",
        einzelpreis: Math.round(preis * 100) / 100,
        gesamtpreis: Math.round(preis * bike.menge * 100) / 100,
      });
    }

    // Auscheck-Tag Positionen pro Kategorie
    if (hasAuscheckPreise && tage > 1) {
      const katMengen: Record<string, number> = {};
      for (const bike of selectedBikes) {
        katMengen[bike.kategorie] = (katMengen[bike.kategorie] || 0) + bike.menge;
      }
      for (const [kat, menge] of Object.entries(katMengen)) {
        const chosen = auscheckSelection[kat];
        if (chosen != null && chosen > 0) {
          positionen.push({
            posNr: posNr++,
            typ: "ZUSCHLAG",
            bezeichnung: `Auscheck-Tag ${kat} (${menge}\u00d7 ${formatEuro(chosen)})`,
            menge,
            einheit: "Stk.",
            einzelpreis: chosen,
            gesamtpreis: Math.round(chosen * menge * 100) / 100,
          });
        }
      }
    }

    // Extras als ZUSCHLAG-Positionen
    for (const extraId of selectedExtras) {
      const extra = extras.find((e) => e.id === extraId);
      if (!extra) continue;
      const betrag = extraBetrag(extra);
      let menge = 1;
      let einheit = extra.einheit;

      switch (extra.einheit) {
        case "pro Tag": menge = tage; einheit = "Tag"; break;
        case "pro Person": menge = personen; einheit = "Person"; break;
        case "pro Tag/Person": menge = tage * personen; einheit = "Tag/Pers."; break;
        default: menge = 1; einheit = "pauschal";
      }

      positionen.push({
        posNr: posNr++,
        typ: "ZUSCHLAG",
        bezeichnung: `${extra.name} (${extra.einheit})`,
        menge,
        einheit,
        einzelpreis: extra.preis,
        gesamtpreis: Math.round(betrag * 100) / 100,
      });
    }

    // Custom Extras
    for (const ce of customExtras) {
      const p = parseFloat(ce.preis) || 0;
      if (!ce.name || p <= 0) continue;
      const betrag = customExtraBetrag(ce);
      let menge = 1;
      let einheit = ce.einheit;

      switch (ce.einheit) {
        case "pro Tag": menge = tage; einheit = "Tag"; break;
        case "pro Person": menge = personen; einheit = "Person"; break;
        case "pro Tag/Person": menge = tage * personen; einheit = "Tag/Pers."; break;
        default: menge = 1; einheit = "pauschal";
      }

      positionen.push({
        posNr: posNr++,
        typ: "ZUSCHLAG",
        bezeichnung: ce.name,
        menge,
        einheit,
        einzelpreis: p,
        gesamtpreis: Math.round(betrag * 100) / 100,
      });
    }

    // Rabatt
    if (rabattBrutto > 0) {
      positionen.push({
        posNr: posNr++,
        typ: "RABATT",
        bezeichnung: rabattGrund ? `Rabatt (${rabattProzent}%) \u2014 ${rabattGrund}` : `Rabatt (${rabattProzent}%)`,
        menge: 1,
        einheit: "pauschal",
        einzelpreis: -rabattBrutto,
        gesamtpreis: -rabattBrutto,
      });
    }

    return positionen;
  }

  async function handleSave() {
    if (!kunde.name) {
      toast.error("Bitte Kundennamen angeben");
      return;
    }
    if (!hasBikes) {
      toast.error("Bitte mindestens ein Fahrrad auswählen");
      return;
    }
    if (tage === 0) {
      toast.error("Bitte Mietbeginn und Mietende angeben");
      return;
    }
    setSaving(true);

    const positionen = buildPositionen();

    try {
      const payload = {
        kunde,
        positionen,
        raeume: [],
        materialNetto: 0,
        arbeitsNetto: Math.round((fahrradBrutto + auscheckBrutto) / (1 + mwstSatz / 100) * 100) / 100,
        anfahrt: 0,
        zuschlagNetto: Math.round(extrasBrutto / (1 + mwstSatz / 100) * 100) / 100,
        rabattNetto: Math.round(rabattBrutto / (1 + mwstSatz / 100) * 100) / 100,
        netto,
        mwstSatz,
        mwstBetrag,
        brutto,
        eingabeMethode: "FORMULAR",
        einleitungsText: einleitungsText || undefined,
        schlussText: schlussText || undefined,
        anreise: mietbeginn,
        abreise: mietende,
        naechte: tage,
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

      const result = await res.json();
      const angId = editAngebotId || result.id;
      setSaved(true);
      setSavedAngebotId(angId);
      toast.success(editAngebotId ? "Angebot aktualisiert!" : "Angebot gespeichert!");
    } catch (error) {
      console.error("Speichern Fehler:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handlePDF() {
    if (!hasBikes || tage === 0) return;
    setPdfLoading(true);

    try {
      const { generateAngebotPDF } = await import("@/lib/pdf");
      const positionen = buildPositionen();

      const blob = generateAngebotPDF({
        positionen,
        raeume: [],
        materialNetto: 0,
        arbeitsNetto: Math.round((fahrradBrutto + auscheckBrutto) / (1 + mwstSatz / 100) * 100) / 100,
        anfahrt: 0,
        zuschlagNetto: Math.round(extrasBrutto / (1 + mwstSatz / 100) * 100) / 100,
        rabattNetto: Math.round(rabattBrutto / (1 + mwstSatz / 100) * 100) / 100,
        netto,
        mwstSatz,
        mwstBetrag,
        brutto,
        kunde,
        firma,
        nummer: "Entwurf",
        datum: new Date(),
        gueltigBis: new Date(Date.now() + (firma?.angebotsGueltig || 14) * 24 * 60 * 60 * 1000),
        einleitungsText: einleitungsText || undefined,
        schlussText: schlussText || undefined,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Angebot_${kunde.name.replace(/\s+/g, "_") || "Fahrrad"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF Fehler:", error);
      toast.error("Fehler beim PDF-Erstellen");
    } finally {
      setPdfLoading(false);
    }
  }

  // Kategorien für Gruppierung
  const kategorien = [...new Set(fahrraeder.map((f) => f.kategorie).filter(Boolean))];

  return (
    <div className="px-5 pt-6 space-y-4 pb-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">
            {editAngebotId ? "Angebot bearbeiten" : "Fahrrad-Angebot erstellen"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Fahrräder, Mietdauer und Extras konfigurieren
          </p>
        </div>
      </div>

      {/* Kundendaten */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Kunde
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

      {/* Mietdauer */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Mietdauer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Mietbeginn *</Label>
              <Input
                type="date"
                value={mietbeginn}
                onChange={(e) => setMietbeginn(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Mietende *</Label>
              <Input
                type="date"
                value={mietende}
                onChange={(e) => setMietende(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tage</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-mono font-medium">
                {tage > 0
                  ? hasAuscheckPreise && tage > 1
                    ? `${tage} (${miettage} Miettage + 1 Auscheck-Tag)`
                    : tage
                  : "\u2014"}
              </div>
            </div>
            <div>
              <Label className="text-xs">Personen</Label>
              <Input
                type="number"
                min={1}
                value={personen}
                onChange={(e) => setPersonen(parseInt(e.target.value) || 1)}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fahrräder auswählen */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bike className="h-4 w-4" />
            Fahrräder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {fahrraeder.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              Noch keine Fahrräder angelegt. Bitte zuerst im Dashboard anlegen.
            </p>
          ) : (
            <>
              {kategorien.map((kat) => {
                const bikes = fahrraeder.filter((f) => f.kategorie === kat);
                return (
                  <div key={kat}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {kat}
                    </p>
                    <div className="space-y-2">
                      {bikes.map((bike) => {
                        const menge = bikeSelection[bike.id] || 0;
                        const preis = miettage > 0 ? getPreisFuerTage(bike, miettage) : null;
                        return (
                          <div
                            key={bike.id}
                            className={`flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                              menge > 0 ? "border-primary bg-primary/5" : ""
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{bike.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {preis != null
                                  ? `${formatEuro(preis)} für ${hasAuscheckPreise && tage > 1 ? `${miettage} Miettage` : `${tage} ${tage === 1 ? "Tag" : "Tage"}`}`
                                  : tage > 0
                                    ? "Kein Preis hinterlegt"
                                    : "Mietdauer wählen"}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  setBikeSelection((prev) => ({
                                    ...prev,
                                    [bike.id]: Math.max(0, (prev[bike.id] || 0) - 1),
                                  }))
                                }
                                disabled={menge === 0}
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <span className="w-8 text-center text-sm font-mono font-medium">
                                {menge}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  setBikeSelection((prev) => ({
                                    ...prev,
                                    [bike.id]: (prev[bike.id] || 0) + 1,
                                  }))
                                }
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            {menge > 0 && preis != null && (
                              <span className="text-sm font-mono font-medium shrink-0 ml-1">
                                {formatEuro(Math.round(preis * menge * 100) / 100)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Auscheck-Tag Preisauswahl pro Kategorie */}
                    {hasAuscheckPreise && tage > 1 && auscheckPreise[kat] && bikes.some((b) => (bikeSelection[b.id] || 0) > 0) && (
                      <div className="mt-2 rounded-md bg-muted/50 px-3 py-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">
                          Auscheck-Tag Preis ({kat}):
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {auscheckPreise[kat].map((preis) => {
                            const selected = auscheckSelection[kat] === preis;
                            return (
                              <button
                                key={preis}
                                type="button"
                                className={`rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
                                  selected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background border-border hover:border-primary/50"
                                }`}
                                onClick={() =>
                                  setAuscheckSelection((prev) => ({
                                    ...prev,
                                    [kat]: selected ? null : preis,
                                  }))
                                }
                              >
                                {formatEuro(preis)}
                              </button>
                            );
                          })}
                        </div>
                        {auscheckSelection[kat] != null && auscheckSelection[kat]! > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            = {formatEuro(auscheckSelection[kat]!)} \u00d7{" "}
                            {bikes.reduce((s, b) => s + (bikeSelection[b.id] || 0), 0)} ={" "}
                            {formatEuro(
                              auscheckSelection[kat]! *
                                bikes.reduce((s, b) => s + (bikeSelection[b.id] || 0), 0)
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Fahrräder ohne Kategorie */}
              {fahrraeder.filter((f) => !f.kategorie).length > 0 && (
                <div className="space-y-2">
                  {fahrraeder.filter((f) => !f.kategorie).map((bike) => {
                    const menge = bikeSelection[bike.id] || 0;
                    const preis = miettage > 0 ? getPreisFuerTage(bike, miettage) : null;
                    return (
                      <div
                        key={bike.id}
                        className={`flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                          menge > 0 ? "border-primary bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{bike.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {preis != null
                              ? `${formatEuro(preis)} für ${hasAuscheckPreise && tage > 1 ? `${miettage} Miettage` : `${tage} ${tage === 1 ? "Tag" : "Tage"}`}`
                              : tage > 0
                                ? "Kein Preis hinterlegt"
                                : "Mietdauer wählen"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setBikeSelection((prev) => ({
                                ...prev,
                                [bike.id]: Math.max(0, (prev[bike.id] || 0) - 1),
                              }))
                            }
                            disabled={menge === 0}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="w-8 text-center text-sm font-mono font-medium">
                            {menge}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setBikeSelection((prev) => ({
                                ...prev,
                                [bike.id]: (prev[bike.id] || 0) + 1,
                              }))
                            }
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {menge > 0 && preis != null && (
                          <span className="text-sm font-mono font-medium shrink-0 ml-1">
                            {formatEuro(Math.round(preis * menge * 100) / 100)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Summary */}
              {hasBikes && tage > 0 && (
                <div className="rounded-md bg-muted/50 px-3 py-2 space-y-1">
                  {selectedBikes.map((bike) => {
                    const preis = getPreisFuerTage(bike, miettage);
                    if (preis == null) return null;
                    return (
                      <div key={bike.id} className="flex justify-between text-sm">
                        <span>{bike.menge}\u00d7 {bike.name}</span>
                        <span className="font-mono">{formatEuro(Math.round(preis * bike.menge * 100) / 100)}</span>
                      </div>
                    );
                  })}
                  <Separator className="my-1" />
                  <div className="flex justify-between text-sm font-medium">
                    <span>Fahrräder ({hasAuscheckPreise && tage > 1 ? `${miettage} Miettage` : `${tage} ${tage === 1 ? "Tag" : "Tage"}`})</span>
                    <span className="font-mono">{formatEuro(fahrradBrutto)}</span>
                  </div>
                  {auscheckBrutto > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Auscheck-Tag</span>
                        <span className="font-mono">{formatEuro(auscheckBrutto)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Extras */}
      {extras.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Extras</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {extras.map((extra) => {
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
                  {checked && tage > 0 && (
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

      {/* Eigene Extras */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Eigene Extras</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCustomExtras((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), name: "", preis: "", einheit: "pauschal" },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Hinzufügen
            </Button>
          </CardTitle>
        </CardHeader>
        {customExtras.length > 0 && (
          <CardContent className="space-y-3">
            {customExtras.map((ce, idx) => (
              <div key={ce.id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={ce.name}
                    onChange={(e) => {
                      const updated = [...customExtras];
                      updated[idx] = { ...ce, name: e.target.value };
                      setCustomExtras(updated);
                    }}
                    placeholder="Name des Extras"
                    className="h-8 flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setCustomExtras((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={ce.preis}
                    onChange={(e) => {
                      const updated = [...customExtras];
                      updated[idx] = { ...ce, preis: e.target.value };
                      setCustomExtras(updated);
                    }}
                    placeholder="Preis (EUR)"
                    className="h-8"
                  />
                  <select
                    value={ce.einheit}
                    onChange={(e) => {
                      const updated = [...customExtras];
                      updated[idx] = { ...ce, einheit: e.target.value };
                      setCustomExtras(updated);
                    }}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="pauschal">pauschal</option>
                    <option value="pro Tag">pro Tag</option>
                    <option value="pro Person">pro Person</option>
                    <option value="pro Tag/Person">pro Tag/Person</option>
                  </select>
                </div>
                {ce.name && parseFloat(ce.preis) > 0 && tage > 0 && (
                  <div className="text-xs text-muted-foreground text-right font-mono">
                    = {formatEuro(Math.round(customExtraBetrag(ce) * 100) / 100)}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Rabatt */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Rabatt
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Rabatt (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={rabattProzent}
                onChange={(e) => setRabattProzent(e.target.value)}
                placeholder="0"
                className="h-9"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Grund (optional)</Label>
              <Input
                value={rabattGrund}
                onChange={(e) => setRabattGrund(e.target.value)}
                placeholder="z.B. Stammkunde, Gruppenrabatt"
                className="h-9"
              />
            </div>
          </div>
          {rabattBrutto > 0 && (
            <div className="rounded-md bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              Rabatt: \u2212{formatEuro(rabattBrutto)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summenblock */}
      {hasBikes && tage > 0 && (
        <Card>
          <CardContent className="pt-5 space-y-2">
            <div className="flex justify-between text-sm">
              <p>Fahrräder ({hasAuscheckPreise && tage > 1 ? `${miettage} Miettage` : `${tage} ${tage === 1 ? "Tag" : "Tage"}`})</p>
              <p className="font-mono">{formatEuro(fahrradBrutto)}</p>
            </div>
            {auscheckBrutto > 0 && (
              <div className="flex justify-between text-sm">
                <p>Auscheck-Tag</p>
                <p className="font-mono">{formatEuro(auscheckBrutto)}</p>
              </div>
            )}
            {extrasBrutto > 0 && (
              <div className="flex justify-between text-sm">
                <p>Extras</p>
                <p className="font-mono">{formatEuro(extrasBrutto)}</p>
              </div>
            )}
            {rabattBrutto > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <p>Rabatt ({rabattProzent}%){rabattGrund ? ` \u2014 ${rabattGrund}` : ""}</p>
                <p className="font-mono">\u2212{formatEuro(rabattBrutto)}</p>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-sm">
              <p>Netto</p>
              <p className="font-mono">{formatEuro(netto)}</p>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <p>MwSt. ({mwstSatz}%)</p>
              <p className="font-mono">{formatEuro(mwstBetrag)}</p>
            </div>
            <div className="flex justify-between text-lg font-bold pt-1">
              <p>Brutto</p>
              <p className="font-mono text-primary">{formatEuro(brutto)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aktionen */}
      {saved && savedAngebotId ? (
        <div className="space-y-2">
          <Button
            className="w-full h-12"
            onClick={async () => {
              if (!kunde.email) {
                toast.error("Keine E-Mail-Adresse beim Kunden hinterlegt");
                return;
              }
              setSending(true);
              try {
                const res = await fetch(`/api/angebote/${savedAngebotId}/senden`, { method: "POST" });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  throw new Error(err.error || "Senden fehlgeschlagen");
                }
                toast.success("Angebot per E-Mail versendet!");
                router.push(`/app/uebersicht/${savedAngebotId}`);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Fehler beim Senden");
              } finally {
                setSending(false);
              }
            }}
            disabled={sending || !kunde.email}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Angebot per Mail versenden
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-10"
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
              variant="outline"
              className="h-10"
              onClick={() => router.push(`/app/uebersicht/${savedAngebotId}`)}
            >
              Zur Übersicht
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            className="h-12"
            onClick={handlePDF}
            disabled={pdfLoading || !hasBikes || tage === 0}
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
            disabled={saving || !hasBikes || tage === 0}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {editAngebotId ? "Änderungen speichern" : "Angebot speichern"}
          </Button>
        </div>
      )}
    </div>
  );
}
