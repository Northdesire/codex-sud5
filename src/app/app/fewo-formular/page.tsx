"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, Save, Download, CalendarDays, Users, Home, Percent, Plus, Trash2, AlertTriangle, Mail, MessageSquareText, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { formatEuro } from "@/lib/kalkulation";

interface SaisonPreis {
  id: string;
  saisonId: string;
  preisProNacht: number;
  gastPreise: Record<string, number> | null;
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
  gastPreise: Record<string, number> | null;
  aktiv: boolean;
  komplexId: string | null;
  komplex: Komplex | null;
  saisonPreise: SaisonPreis[];
  icalUrl: string | null;
}

interface Saison {
  id: string;
  name: string;
  von: string;
  bis: string;
  faktor: number;
  mindestaufenthalt: number;
}

interface FewoExtra {
  id: string;
  name: string;
  preis: number;
  einheit: string;
  unterkunftTypen: string[];
  aktiv: boolean;
  vorausgewaehlt: boolean;
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
  const [savedAngebotId, setSavedAngebotId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [editAngebotId, setEditAngebotId] = useState<string | null>(null);
  const [originalText, setOriginalText] = useState("");
  const [showOriginalText, setShowOriginalText] = useState(false);

  // Stammdaten
  const [unterkuenfte, setUnterkuenfte] = useState<Unterkunft[]>([]);
  const [saisons, setSaisons] = useState<Saison[]>([]);
  const [extras, setExtras] = useState<FewoExtra[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [firma, setFirma] = useState<any>(null);
  const [einleitungsText, setEinleitungsText] = useState("");
  const [schlussText, setSchlussText] = useState("");

  // Formular
  const [kunde, setKunde] = useState<Kunde>({
    name: "", strasse: "", plz: "", ort: "", email: "", telefon: "",
  });
  const [anreise, setAnreise] = useState("");
  const [abreise, setAbreise] = useState("");
  const [personen, setPersonen] = useState(2);
  const [selectedUnterkunftIds, setSelectedUnterkunftIds] = useState<string[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());
  const [rabattProzent, setRabattProzent] = useState("");
  const [rabattGrund, setRabattGrund] = useState("");
  const [mwstSatz] = useState(7);

  // Custom Extras
  const [customExtras, setCustomExtras] = useState<Array<{
    id: string; name: string; preis: string; einheit: string;
  }>>([]);

  // iCal Verfügbarkeit
  const [verfuegbarkeit, setVerfuegbarkeit] = useState<Record<string, { verfuegbar: boolean; konflikt?: string }>>({});

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

  const selectedUnterkuenfte = useMemo(() =>
    selectedUnterkunftIds
      .map(id => unterkuenfte.find(u => u.id === id))
      .filter((u): u is Unterkunft => !!u),
    [selectedUnterkunftIds, unterkuenfte]
  );
  const hasUnterkunft = selectedUnterkuenfte.length > 0;

  // Extras filtern: nur die passend zu IRGENDEINEM gewählten Unterkunft-Typ
  const filteredExtras = useMemo(() => {
    if (!hasUnterkunft) return extras;
    const typen = new Set(selectedUnterkuenfte.map(u => u.typ));
    return extras.filter(
      (e) => e.unterkunftTypen.length === 0 || e.unterkunftTypen.some(t => typen.has(t))
    );
  }, [extras, selectedUnterkuenfte, hasUnterkunft]);

  // Lookup: exact match for guestCount, otherwise highest tier ≤ guestCount
  function lookupGastPreis(gastPreise: Record<string, number> | null | undefined, guestCount: number): number | null {
    if (!gastPreise) return null;
    const exact = gastPreise[String(guestCount)];
    if (exact !== undefined) return exact;
    // Find highest tier ≤ guestCount
    let best: number | null = null;
    let bestKey = 0;
    for (const [k, v] of Object.entries(gastPreise)) {
      const num = parseInt(k);
      if (!isNaN(num) && num <= guestCount && num > bestKey) {
        bestKey = num;
        best = v;
      }
    }
    return best;
  }

  // Effektiver Preis pro Nacht (4-Stufen-Cascade)
  // 1. Saison gastPreise[personen]
  // 2. Saison preisProNacht
  // 3. Basis gastPreise[personen]
  // 4. Basis preisProNacht
  function getEffektiverPreis(unterkunft: Unterkunft): number {
    if (erkAnnteSaison) {
      const preise = unterkunft.saisonPreise ?? [];
      const sp = preise.find((p) => p.saisonId === erkAnnteSaison.id)
        || preise.find((p) => p.saison?.name === erkAnnteSaison.name);
      if (sp) {
        const gastPreis = lookupGastPreis(sp.gastPreise, personen);
        if (gastPreis !== null) return gastPreis; // Stufe 1
        return sp.preisProNacht; // Stufe 2
      }
    }
    const basisGastPreis = lookupGastPreis(unterkunft.gastPreise, personen);
    if (basisGastPreis !== null) return basisGastPreis; // Stufe 3
    return unterkunft.preisProNacht; // Stufe 4
  }

  // Kalkulation: summiert über alle gewählten Unterkünfte
  const unterkunftNetto = useMemo(() => {
    if (!hasUnterkunft || naechte === 0) return 0;
    return Math.round(
      selectedUnterkuenfte.reduce((sum, u) => sum + naechte * getEffektiverPreis(u), 0) * 100
    ) / 100;
  }, [selectedUnterkuenfte, hasUnterkunft, naechte, erkAnnteSaison, personen]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // Custom Extras
    for (const ce of customExtras) {
      const p = parseFloat(ce.preis) || 0;
      if (p <= 0) continue;
      switch (ce.einheit) {
        case "pauschal":
          sum += p;
          break;
        case "pro Nacht":
          sum += p * naechte;
          break;
        case "pro Person":
          sum += p * personen;
          break;
        case "pro Nacht/Person":
          sum += p * naechte * personen;
          break;
        default:
          sum += p;
      }
    }
    return Math.round(sum * 100) / 100;
  }, [selectedExtras, extras, naechte, personen, customExtras]);

  // Preise sind brutto (inkl. 7% USt) — Netto rausrechnen
  const rabattBrutto = useMemo(() => {
    const pct = parseFloat(rabattProzent);
    if (!pct || pct <= 0) return 0;
    return Math.round((unterkunftNetto + extrasNetto) * (pct / 100) * 100) / 100;
  }, [unterkunftNetto, extrasNetto, rabattProzent]);

  const brutto = Math.round((unterkunftNetto + extrasNetto - rabattBrutto) * 100) / 100;
  const netto = Math.round((brutto / (1 + mwstSatz / 100)) * 100) / 100;
  const mwstBetrag = Math.round((brutto - netto) * 100) / 100;

  // Daten laden
  useEffect(() => {
    Promise.all([
      fetch("/api/unterkuenfte").then((r) => r.json()),
      fetch("/api/saisons").then((r) => r.json()),
      fetch("/api/fewo-extras").then((r) => r.json()),
      fetch("/api/firma").then((r) => r.json()),
      fetch("/api/textvorlagen").then((r) => r.json()),
    ]).then(([u, s, e, f, tv]) => {
      if (Array.isArray(u)) setUnterkuenfte(u.filter((x: Unterkunft) => x.aktiv));
      if (Array.isArray(s)) setSaisons(s);
      if (Array.isArray(e)) {
        const aktive = e.filter((x: FewoExtra) => x.aktiv);
        setExtras(aktive);
        // Vorausgewählte automatisch selektieren (nur bei neuer Eingabe, nicht bei Edit/AI)
        const editId = sessionStorage.getItem("edit-angebot-id");
        const aiData = sessionStorage.getItem("ai-ergebnis");
        if (!editId && !aiData) {
          const preSelected = new Set(aktive.filter((x: FewoExtra) => x.vorausgewaehlt).map((x: FewoExtra) => x.id));
          if (preSelected.size > 0) setSelectedExtras(preSelected);
        }
      }
      if (f && !f.error) setFirma(f);
      if (Array.isArray(tv)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const intro = tv.find((v: any) => v.typ === "ANGEBOT_INTRO" && v.aktiv);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const schluss = tv.find((v: any) => v.typ === "ANGEBOT_SCHLUSS" && v.aktiv);
        if (intro) setEinleitungsText(intro.text);
        if (schluss) setSchlussText(schluss.text);
      }
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
        const wuensche: string[] = parsed.wuensche || [];
        if (parsed.hund) wuensche.push("Hund");
        if (wuensche.length > 0) {
          sessionStorage.setItem("fewo-wuensche", JSON.stringify(wuensche));
        }
        sessionStorage.removeItem("ai-ergebnis");
      } catch {
        // ignore
      }
    }

    // Original-Anfragetext laden (für KI-personalisierte Mails)
    const aiOriginal = sessionStorage.getItem("ai-originaltext");
    if (aiOriginal) {
      setOriginalText(aiOriginal);
      sessionStorage.removeItem("ai-originaltext");
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
      // Alle Unterkunft-Positionen matchen
      const unterkunftPositionen = positionen.filter((p) => p.typ === "PRODUKT");
      const matchedIds: string[] = [];
      for (const pos of unterkunftPositionen) {
        const match = unterkuenfte.find(
          (u) => pos.bezeichnung.toLowerCase().includes(u.name.toLowerCase())
        );
        if (match) matchedIds.push(match.id);
      }
      if (matchedIds.length > 0) setSelectedUnterkunftIds(matchedIds);
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

  // Auto-select: Erst einzelne passende Unterkunft, sonst greedy Kombination
  useEffect(() => {
    if (unterkuenfte.length === 0 || selectedUnterkunftIds.length > 0) return;
    // 1) Einzelne Unterkunft die reicht?
    const einzeln = unterkuenfte.find((u) => u.kapazitaet >= personen);
    if (einzeln) {
      setSelectedUnterkunftIds([einzeln.id]);
      return;
    }
    // 2) Greedy: Zimmer der Reihe nach hinzufügen bis Kapazität reicht
    let kapazitaet = 0;
    const ids: string[] = [];
    for (const u of unterkuenfte) {
      ids.push(u.id);
      kapazitaet += u.kapazitaet;
      if (kapazitaet >= personen) break;
    }
    if (kapazitaet >= personen) {
      setSelectedUnterkunftIds(ids);
    }
  }, [unterkuenfte, personen]); // eslint-disable-line react-hooks/exhaustive-deps

  // iCal Verfügbarkeit prüfen wenn Anreise + Abreise gesetzt
  useEffect(() => {
    if (!anreise || !abreise) return;
    const hasIcal = unterkuenfte.some((u) => u.icalUrl);
    if (!hasIcal) return;

    fetch(`/api/unterkuenfte/verfuegbarkeit?von=${anreise}&bis=${abreise}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === "object" && !data.error) {
          setVerfuegbarkeit(data);
        }
      })
      .catch(() => {});
  }, [anreise, abreise, unterkuenfte]);

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

  function customExtraBetrag(ce: { preis: string; einheit: string }): number {
    const p = parseFloat(ce.preis) || 0;
    switch (ce.einheit) {
      case "pauschal": return p;
      case "pro Nacht": return p * naechte;
      case "pro Person": return p * personen;
      case "pro Nacht/Person": return p * naechte * personen;
      default: return p;
    }
  }

  async function handleSave() {
    if (!kunde.name) {
      toast.error("Bitte Gastnamen angeben");
      return;
    }
    if (!hasUnterkunft) {
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

    // Unterkünfte als Hauptpositionen (je 1 PRODUKT-Position pro Unterkunft)
    const saisonHinweis = erkAnnteSaison ? ` (${erkAnnteSaison.name})` : "";
    for (const u of selectedUnterkuenfte) {
      const preis = getEffektiverPreis(u);
      positionen.push({
        posNr: posNr++,
        typ: "PRODUKT",
        bezeichnung: `${u.name}${saisonHinweis} — ${naechte} Nächte`,
        menge: naechte,
        einheit: "Nacht",
        einzelpreis: Math.round(preis * 100) / 100,
        gesamtpreis: Math.round(naechte * preis * 100) / 100,
      });
    }

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

    // Custom Extras als Zuschlag-Positionen
    for (const ce of customExtras) {
      const p = parseFloat(ce.preis) || 0;
      if (!ce.name || p <= 0) continue;
      const betrag = customExtraBetrag(ce);
      let menge = 1;
      let einheit = ce.einheit;

      switch (ce.einheit) {
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
        bezeichnung: ce.name,
        menge,
        einheit,
        einzelpreis: p,
        gesamtpreis: Math.round(betrag * 100) / 100,
      });
    }

    // Rabatt als eigene Position
    if (rabattBrutto > 0) {
      positionen.push({
        posNr: posNr++,
        typ: "RABATT",
        bezeichnung: rabattGrund ? `Rabatt (${rabattProzent}%) — ${rabattGrund}` : `Rabatt (${rabattProzent}%)`,
        menge: 1,
        einheit: "pauschal",
        einzelpreis: -rabattBrutto,
        gesamtpreis: -rabattBrutto,
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
        rabattNetto: rabattBrutto,
        netto,
        mwstSatz,
        mwstBetrag,
        brutto,
        eingabeMethode: "FORMULAR",
        originalText: originalText || undefined,
        einleitungsText: einleitungsText || undefined,
        schlussText: schlussText || undefined,
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
    if (!hasUnterkunft || naechte === 0) return;
    setPdfLoading(true);

    try {
      const { generateAngebotPDF } = await import("@/lib/pdf");

      const positionen = [];
      let posNr = 1;
      const pdfSaisonHinweis = erkAnnteSaison ? ` (${erkAnnteSaison.name})` : "";
      for (const u of selectedUnterkuenfte) {
        const preis = getEffektiverPreis(u);
        positionen.push({
          posNr: posNr++,
          typ: "PRODUKT" as const,
          bezeichnung: `${u.name}${pdfSaisonHinweis} — ${naechte} Nächte`,
          menge: naechte,
          einheit: "Nacht",
          einzelpreis: Math.round(preis * 100) / 100,
          gesamtpreis: Math.round(naechte * preis * 100) / 100,
        });
      }
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
      for (const ce of customExtras) {
        const p = parseFloat(ce.preis) || 0;
        if (!ce.name || p <= 0) continue;
        const betrag = customExtraBetrag(ce);
        positionen.push({
          posNr: posNr++,
          typ: "ZUSCHLAG" as const,
          bezeichnung: ce.name,
          menge: 1,
          einheit: ce.einheit,
          einzelpreis: p,
          gesamtpreis: Math.round(betrag * 100) / 100,
        });
      }
      if (rabattBrutto > 0) {
        positionen.push({
          posNr: posNr++,
          typ: "RABATT" as const,
          bezeichnung: rabattGrund ? `Rabatt (${rabattProzent}%) — ${rabattGrund}` : `Rabatt (${rabattProzent}%)`,
          menge: 1,
          einheit: "pauschal",
          einzelpreis: -rabattBrutto,
          gesamtpreis: -rabattBrutto,
        });
      }

      const blob = generateAngebotPDF({
        positionen,
        raeume: [],
        materialNetto: 0,
        arbeitsNetto: unterkunftNetto,
        anfahrt: 0,
        zuschlagNetto: extrasNetto,
        rabattNetto: rabattBrutto,
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
      window.open(url, "_blank");
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
          {erkAnnteSaison ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span>Saison: <strong>{erkAnnteSaison.name}</strong></span>
              </div>
              {erkAnnteSaison.mindestaufenthalt > 1 && naechte > 0 && naechte < erkAnnteSaison.mindestaufenthalt && (
                <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{erkAnnteSaison.name}: Mindestaufenthalt {erkAnnteSaison.mindestaufenthalt} Nächte (aktuell: {naechte})</span>
                </div>
              )}
            </div>
          ) : anreise && saisons.length > 0 ? (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Kein Saison-Zeitraum für dieses Anreisedatum hinterlegt
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Unterkunft */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Unterkünfte
            </span>
            {unterkuenfte.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedUnterkunftIds(prev => [...prev, ""])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Zimmer hinzufügen
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {unterkuenfte.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              Noch keine Unterkünfte angelegt. Bitte zuerst im Dashboard anlegen.
            </p>
          ) : (
            <>
              {selectedUnterkunftIds.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Noch kein Zimmer gewählt. Klicke &ldquo;Zimmer hinzufügen&rdquo;.
                </p>
              )}
              {selectedUnterkunftIds.map((uid, idx) => {
                const u = unterkuenfte.find(x => x.id === uid) || null;
                const preis = u ? getEffektiverPreis(u) : 0;

                const renderOptions = () => {
                  // Bereits gewählte Zimmer ausschließen (außer aktuelle Zeile)
                  const andereIds = new Set(selectedUnterkunftIds.filter((_, i) => i !== idx));
                  const verfuegbar = unterkuenfte.filter(x => !andereIds.has(x.id));
                  const withKomplex = verfuegbar.filter((x) => x.komplex);
                  const withoutKomplex = verfuegbar.filter((x) => !x.komplex);
                  const komplexNames = [...new Set(withKomplex.map((x) => x.komplex!.name))];

                  const statusSuffix = (x: Unterkunft) => {
                    const v = verfuegbarkeit[x.id];
                    if (v && !v.verfuegbar) return " (belegt)";
                    return "";
                  };

                  const preisLabel = (x: Unterkunft) => formatEuro(getEffektiverPreis(x));

                  return (
                    <>
                      {komplexNames.map((kName) => (
                        <optgroup key={kName} label={kName}>
                          {withKomplex.filter((x) => x.komplex!.name === kName).map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name} — {preisLabel(x)}/Nacht (max. {x.kapazitaet} Pers.){statusSuffix(x)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                      {withoutKomplex.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name} — {preisLabel(x)}/Nacht (max. {x.kapazitaet} Pers.){statusSuffix(x)}
                        </option>
                      ))}
                    </>
                  );
                };

                return (
                  <div key={idx} className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={uid}
                        onChange={(e) => {
                          const updated = [...selectedUnterkunftIds];
                          updated[idx] = e.target.value;
                          setSelectedUnterkunftIds(updated);
                        }}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      >
                        <option value="">— Unterkunft wählen —</option>
                        {renderOptions()}
                      </select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => setSelectedUnterkunftIds(prev => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    {uid && verfuegbarkeit[uid]?.verfuegbar === false && (
                      <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>Belegt im gewählten Zeitraum (laut iCal)</span>
                      </div>
                    )}
                    {u && (
                      <div className="flex justify-between text-sm text-muted-foreground px-1">
                        <span>{u.name} — max. {u.kapazitaet} Pers.</span>
                        <span className="font-mono">{formatEuro(preis)}/Nacht</span>
                      </div>
                    )}
                    {u && erkAnnteSaison && (() => {
                      const preise = u.saisonPreise ?? [];
                      const hatSaisonPreis = preise.some(
                        (p) => p.saisonId === erkAnnteSaison.id || p.saison?.name === erkAnnteSaison.name
                      );
                      if (!hatSaisonPreis) return (
                        <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                          Saison &ldquo;{erkAnnteSaison.name}&rdquo; erkannt, aber kein Saisonpreis hinterlegt → Grundpreis.
                        </div>
                      );
                      return null;
                    })()}
                  </div>
                );
              })}
              {/* Summary */}
              {hasUnterkunft && naechte > 0 && (
                <div className="rounded-md bg-muted/50 px-3 py-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Kapazität gesamt</span>
                    <span className="font-mono font-medium">
                      {selectedUnterkuenfte.reduce((s, u) => s + u.kapazitaet, 0)} Personen
                    </span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between text-sm font-medium">
                    <span>
                      {selectedUnterkuenfte.length > 1
                        ? `${selectedUnterkuenfte.length} Unterkünfte × ${naechte} Nächte`
                        : `${naechte} Nächte`}
                    </span>
                    <span className="font-mono">{formatEuro(unterkunftNetto)}</span>
                  </div>
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

      {/* Eigenes Extra */}
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
                    <option value="pro Nacht">pro Nacht</option>
                    <option value="pro Person">pro Person</option>
                    <option value="pro Nacht/Person">pro Nacht/Person</option>
                  </select>
                </div>
                {ce.name && parseFloat(ce.preis) > 0 && naechte > 0 && (
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
                placeholder="z.B. Stammgast, Frühbucher"
                className="h-9"
              />
            </div>
          </div>
          {rabattBrutto > 0 && (
            <div className="rounded-md bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              Rabatt: −{formatEuro(rabattBrutto)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summenblock */}
      {hasUnterkunft && naechte > 0 && (
        <Card>
          <CardContent className="pt-5 space-y-2">
            <div className="flex justify-between text-sm">
              <p>
                {selectedUnterkuenfte.length > 1
                  ? `${selectedUnterkuenfte.length} Unterkünfte (${naechte} Nächte)`
                  : `Unterkunft (${naechte} Nächte)`}
              </p>
              <p className="font-mono">{formatEuro(unterkunftNetto)}</p>
            </div>
            {extrasNetto > 0 && (
              <div className="flex justify-between text-sm">
                <p>Extras</p>
                <p className="font-mono">{formatEuro(extrasNetto)}</p>
              </div>
            )}
            {rabattBrutto > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <p>Rabatt ({rabattProzent}%){rabattGrund ? ` — ${rabattGrund}` : ""}</p>
                <p className="font-mono">−{formatEuro(rabattBrutto)}</p>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <p>Gesamt (brutto)</p>
              <p className="font-mono text-primary">{formatEuro(brutto)}</p>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <p>darin enthalten {mwstSatz}% USt.</p>
              <p className="font-mono">{formatEuro(mwstBetrag)}</p>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <p>Netto</p>
              <p className="font-mono">{formatEuro(netto)}</p>
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
                toast.error("Keine E-Mail-Adresse beim Gast hinterlegt");
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
            disabled={pdfLoading || !hasUnterkunft || naechte === 0}
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
            disabled={saving || !hasUnterkunft || naechte === 0}
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
