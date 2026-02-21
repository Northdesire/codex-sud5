"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Brain, ClipboardPaste, Mic, MicOff, Loader2, Check, ChevronRight,
  User, Ruler, Paintbrush, Camera, ImageIcon, X, Package, CalendarDays, Home,
} from "lucide-react";
import { toast } from "sonner";
import { compressForUpload } from "@/lib/compress";
import { useBranche, useBrancheLoading } from "@/lib/branche-context";

const DEMO_TEXT_MALER = `Hallo Herr Schneider,

wir haben eine 3-Zimmer-Wohnung in der Gartenstraße 8, 26721 Emden und würden gerne alle Räume streichen lassen.

Wohnzimmer: ca. 5,2 x 4,1 m, 2 Fenster, 1 Tür
Schlafzimmer: ca. 4,0 x 3,5 m, 1 Fenster, 1 Tür
Kinderzimmer: ca. 3,5 x 3,0 m, 1 Fenster, 1 Tür

Deckenhöhe ist überall 2,55m. Wir hätten gerne eine hochwertige Farbe (Caparol oder ähnlich). Die Decken sollen auch gestrichen werden.

Können Sie uns ein Angebot machen?

Mit freundlichen Grüßen
Familie Müller
Tel: 0176 1234567
mueller@email.de`;

const DEMO_TEXT_SHOP = `Hallo,

wir benötigen ein Angebot für folgende Artikel:

- 5x Laptop Dell XPS 15
- 10x USB-C Kabel 2m
- 2x Monitor 27 Zoll 4K
- 3x Tastatur Logitech MX Keys
- 1x Docking Station USB-C

Bitte mit Mengenrabatt wenn möglich.

Firma TechStart GmbH
Berliner Str. 42, 10115 Berlin
Tel: 030 12345678
bestellung@techstart.de`;

const DEMO_TEXT_FEWO = `Hallo,

wir würden gerne vom 15. bis 22. Juli bei Ihnen Urlaub machen. Wir sind 2 Erwachsene und 2 Kinder (8 und 12 Jahre) und haben einen Hund dabei.

Haben Sie noch eine Ferienwohnung frei? Wir hätten gerne Frühstück und Bettwäsche. Ein Parkplatz wäre auch super.

Können Sie uns ein Angebot machen?

Mit freundlichen Grüßen
Familie Weber
Hauptstraße 15, 80331 München
Tel: 0171 9876543
weber@email.de`;

interface FewoResultParsed {
  anreise: string;
  abreise: string;
  personen: number;
  hund: boolean;
  wuensche: string[];
}

interface ArbeitsbereichArbeiten {
  waendeStreichen: boolean;
  deckeStreichen: boolean;
  grundierung: boolean;
  spachteln: boolean;
  tapeteEntfernen: boolean;
  tapezieren: boolean;
}

interface ArbeitsbereichParsed {
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

interface ShopProduktParsed {
  name: string;
  menge: number;
  einheit: string;
  preis?: number;
}

interface ParsedResult {
  kunde: {
    name: string;
    strasse: string;
    plz: string;
    ort: string;
    email: string;
    telefon: string;
  };
  // Maler-spezifisch
  arbeitsbereiche?: ArbeitsbereichParsed[];
  qualitaet?: "standard" | "premium";
  extras?: Array<string | { bezeichnung: string; kategorie: string; schaetzMenge: number; einheit: string }>;
  // Shop-spezifisch
  produkte?: ShopProduktParsed[];
  // FEWO-spezifisch
  anreise?: string;
  abreise?: string;
  personen?: number;
  hund?: boolean;
  wuensche?: string[];
  // Gemeinsam
  confidence: { kunde: number; raeume: number; optionen: number };
}

const ARBEIT_LABELS: Record<keyof ArbeitsbereichArbeiten, string> = {
  waendeStreichen: "Streichen",
  deckeStreichen: "Decke",
  grundierung: "Grundierung",
  spachteln: "Spachteln",
  tapeteEntfernen: "Tapete ab",
  tapezieren: "Tapezieren",
};

const FENSTER_ABZUG = 1.5;
const TUER_ABZUG = 2.0;

function berechneWandflaeche(b: ArbeitsbereichParsed) {
  if (b.typ === "FLAECHE") return b.wandflaeche || 0;
  return Math.max(
    0,
    2 * (b.laenge + b.breite) * b.hoehe -
      b.fenster * FENSTER_ABZUG -
      b.tueren * TUER_ABZUG
  );
}

const ANALYSE_SCHRITTE_MALER = [
  { icon: "📖", text: "Text wird gelesen..." },
  { icon: "👤", text: "Kundendaten extrahieren..." },
  { icon: "📐", text: "Bereiche & Maße erkennen..." },
  { icon: "🎨", text: "Arbeiten & Qualität bestimmen..." },
  { icon: "✅", text: "Fertig!" },
];

const ANALYSE_SCHRITTE_SHOP = [
  { icon: "📖", text: "Text wird gelesen..." },
  { icon: "👤", text: "Kundendaten extrahieren..." },
  { icon: "📦", text: "Produkte & Mengen erkennen..." },
  { icon: "✅", text: "Fertig!" },
];

const ANALYSE_SCHRITTE_FEWO = [
  { icon: "📖", text: "Text wird gelesen..." },
  { icon: "👤", text: "Gästedaten extrahieren..." },
  { icon: "📅", text: "Reisedaten erkennen..." },
  { icon: "🎯", text: "Wünsche & Extras erfassen..." },
  { icon: "✅", text: "Fertig!" },
];

export default function AIEingabePage() {
  const router = useRouter();
  const branche = useBranche();
  const brancheLoading = useBrancheLoading();
  const [modus, setModus] = useState<"wahl" | "text" | "sprache">("wahl");
  const [text, setText] = useState("");
  const [analysiert, setAnalysiert] = useState(false);
  const [analysierSchritt, setAnalysierSchritt] = useState(-1);
  const [ergebnis, setErgebnis] = useState<ParsedResult | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const isShop = branche === "SHOP";
  const isFewo = branche === "FEWO";
  const ANALYSE_SCHRITTE = isFewo ? ANALYSE_SCHRITTE_FEWO : isShop ? ANALYSE_SCHRITTE_SHOP : ANALYSE_SCHRITTE_MALER;
  const DEMO_TEXT = isFewo ? DEMO_TEXT_FEWO : isShop ? DEMO_TEXT_SHOP : DEMO_TEXT_MALER;

  async function handleImageSelect(file: File) {
    try {
      const compressed = await compressForUpload(file);
      setImage(compressed);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(compressed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Datei zu groß");
    }
  }

  function removeImage() {
    setImage(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function handleAnalyse() {
    if (!text.trim() && !image) {
      toast.error("Bitte füge einen Text ein oder mache ein Foto");
      return;
    }

    // Image is already compressed in handleImageSelect

    setAnalysiert(false);
    setErgebnis(null);

    for (let i = 0; i < ANALYSE_SCHRITTE.length - 1; i++) {
      setAnalysierSchritt(i);
      await new Promise((r) => setTimeout(r, 600));
    }

    try {
      let res: Response;

      if (image) {
        const formData = new FormData();
        formData.append("image", image);
        if (text.trim()) formData.append("text", text);
        formData.append("branche", branche!);
        res = await fetch("/api/ai/parse", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/ai/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, branche }),
        });
      }

      if (!res.ok) {
        let errorMsg = "AI-Analyse fehlgeschlagen";
        try {
          const err = await res.json();
          errorMsg = err.error || errorMsg;
        } catch {
          if (res.status === 413) errorMsg = "Datei zu groß";
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();

      // Normalize confidence: OpenAI returns 0-1, display expects 0-100
      if (data.confidence) {
        const c = data.confidence;
        if (c.kunde <= 1 && c.raeume <= 1 && c.optionen <= 1) {
          c.kunde = Math.round(c.kunde * 100);
          c.raeume = Math.round(c.raeume * 100);
          c.optionen = Math.round(c.optionen * 100);
        }
      }

      if (isFewo) {
        // FEWO-Ergebnis: anreise/abreise/personen/hund/wuensche
        const normalized: ParsedResult = {
          kunde: data.kunde,
          anreise: data.anreise || "",
          abreise: data.abreise || "",
          personen: data.personen || 2,
          hund: data.hund || false,
          wuensche: data.wuensche || [],
          confidence: data.confidence,
        };
        setErgebnis(normalized);
      } else if (isShop) {
        // Shop-Ergebnis: produkte-Array
        const normalized: ParsedResult = {
          kunde: data.kunde,
          produkte: data.produkte || [],
          confidence: data.confidence,
        };
        setErgebnis(normalized);
      } else {
        // Maler-Ergebnis: arbeitsbereiche
        const normalized: ParsedResult = {
          kunde: data.kunde,
          arbeitsbereiche: data.arbeitsbereiche || [],
          qualitaet: data.qualitaet || data.optionen?.qualitaet || "standard",
          extras: data.extras || [],
          confidence: data.confidence,
        };

        // Convert old format if needed
        if ((!normalized.arbeitsbereiche || normalized.arbeitsbereiche.length === 0) && Array.isArray(data.raeume)) {
          const decke = data.optionen?.decke || false;
          const spachteln = data.optionen?.spachteln || false;
          normalized.arbeitsbereiche = data.raeume.map((r: { name: string; laenge: number; breite: number; hoehe: number; fenster: number; tueren: number }) => ({
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
          }));
        }

        setErgebnis(normalized);
      }

      setAnalysierSchritt(ANALYSE_SCHRITTE.length - 1);
      setAnalysiert(true);
    } catch (err) {
      toast.error("Analyse fehlgeschlagen", {
        description: err instanceof Error ? err.message : "Unbekannter Fehler",
      });
      setAnalysierSchritt(-1);
    }
  }

  function handleUebernehmen() {
    if (!ergebnis) return;
    sessionStorage.setItem("ai-ergebnis", JSON.stringify(ergebnis));
    sessionStorage.setItem("ai-originaltext", text);
    if (isFewo) {
      router.push("/app/fewo-formular");
    } else if (isShop) {
      router.push("/app/shop-formular");
    } else {
      router.push("/app/formular");
    }
  }

  async function handleSprache() {
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Mikrofon nicht verfügbar", {
        description: "Bitte erlaube den Mikrofon-Zugriff in den Browser-Einstellungen",
      });
      return;
    }

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm",
    });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      setTranscribing(true);

      try {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });

        const formData = new FormData();
        formData.append("audio", audioBlob, "aufnahme.webm");

        const res = await fetch("/api/ai/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Transkription fehlgeschlagen");

        const { text: transcript } = await res.json();
        setText((prev) => (prev ? prev + "\n" + transcript : transcript));
        toast.success("Sprache erkannt");
      } catch (err) {
        console.error("Transkription Fehler:", err);
        toast.error("Sprache konnte nicht erkannt werden");
      } finally {
        setTranscribing(false);
      }
    };

    mediaRecorder.start();
    setRecording(true);
    setModus("text");
  }

  // Warten bis Branche geladen ist
  if (brancheLoading) {
    return (
      <div className="px-5 pt-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  // --- SCHRITT: MODUS WÄHLEN ---
  if (modus === "wahl") {
    return (
      <div className="px-5 pt-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold">AI-Eingabe</h1>
          <p className="text-sm text-muted-foreground">
            {isFewo
              ? "Gästeanfrage eingeben — AI erkennt Reisedaten und Wünsche"
              : isShop
                ? "Produktanfrage eingeben — AI erkennt Produkte und Mengen"
                : "Wie möchtest du die Anfrage eingeben?"}
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setModus("text")}
            className="w-full rounded-2xl border-2 border-primary/20 p-5 text-left active:scale-[0.98] transition-transform hover:border-primary/40"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ClipboardPaste className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">Text einfügen</h2>
                <p className="text-sm text-muted-foreground">
                  {isShop
                    ? "Bestellung, Anfrage oder Produktliste reinpasten"
                    : "E-Mail, WhatsApp oder Notiz reinpasten"}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>

          <button
            onClick={() => {
              setModus("text");
              setTimeout(() => handleSprache(), 100);
            }}
            className="w-full rounded-2xl border-2 border-primary/20 p-5 text-left active:scale-[0.98] transition-transform hover:border-primary/40"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Mic className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">Sprachmemo</h2>
                <p className="text-sm text-muted-foreground">
                  Einfach reinreden — Whisper erkennt alles
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>

          <button
            onClick={() => {
              setModus("text");
              setTimeout(() => imageInputRef.current?.click(), 100);
            }}
            className="w-full rounded-2xl border-2 border-primary/20 p-5 text-left active:scale-[0.98] transition-transform hover:border-primary/40"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Camera className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">Foto / Screenshot</h2>
                <p className="text-sm text-muted-foreground">
                  {isShop
                    ? "Screenshot einer Bestellung oder Preisliste"
                    : "Handschriftliche Notiz, WhatsApp, E-Mail"}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>

          {/* Shop / FEWO: Manuell-Button */}
          {(isShop || isFewo) && (
            <button
              onClick={() => router.push(isFewo ? "/app/fewo-formular" : "/app/shop-formular")}
              className="w-full rounded-2xl border-2 border-primary/20 p-5 text-left active:scale-[0.98] transition-transform hover:border-primary/40"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {isFewo ? <Home className="h-6 w-6" /> : <Package className="h-6 w-6" />}
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold">Manuell erstellen</h2>
                  <p className="text-sm text-muted-foreground">
                    {isFewo ? "Unterkunft & Aufenthalt direkt eingeben" : "Produkte direkt aus dem Katalog wählen"}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- SCHRITT: TEXT EINGEBEN + ANALYSIEREN ---
  if (!analysiert) {
    return (
      <div className="px-5 pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">
              {recording
                ? "Aufnahme läuft..."
                : transcribing
                  ? "Wird erkannt..."
                  : "Text eingeben"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {transcribing
                ? "Whisper transkribiert deine Sprache"
                : isFewo
                  ? "Gästeanfrage einfügen oder diktieren"
                  : isShop
                    ? "Bestellung oder Produktanfrage einfügen"
                    : "Kundenanfrage einfügen oder diktieren"}
            </p>
          </div>
          <button
            onClick={handleSprache}
            disabled={transcribing}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
              recording
                ? "bg-red-500 text-white animate-pulse"
                : transcribing
                  ? "bg-muted text-muted-foreground opacity-50"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {transcribing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : recording ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Hidden file input for images */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageSelect(file);
          }}
        />

        {/* Image preview */}
        {imagePreview && (
          <div className="relative rounded-xl overflow-hidden border">
            <img src={imagePreview} alt="Foto" className="w-full max-h-48 object-cover" />
            <button
              onClick={removeImage}
              className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
              <p className="text-white text-xs">AI wird dieses Bild analysieren</p>
            </div>
          </div>
        )}

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            image
              ? "Optional: zusätzliche Infos zum Foto..."
              : isShop
                ? "Hier die Bestellung oder Produktanfrage einfügen..."
                : "Hier den Text der Kundenanfrage einfügen (E-Mail, WhatsApp, Notiz)..."
          }
          rows={image ? 4 : 10}
          className="text-base"
        />

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => imageInputRef.current?.click()}
          >
            <ImageIcon className="h-4 w-4 mr-1" />
            {image ? "Anderes Foto" : "Foto hinzufügen"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setText(DEMO_TEXT);
              toast.success("Demo-Text geladen");
            }}
          >
            Demo-Text
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setModus("wahl");
              setText("");
              removeImage();
              setAnalysierSchritt(-1);
            }}
          >
            Zurück
          </Button>
        </div>

        {/* Analyse Button / Fortschritt */}
        {analysierSchritt >= 0 ? (
          <Card>
            <CardContent className="pt-5 space-y-3">
              {ANALYSE_SCHRITTE.map((schritt, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 transition-opacity ${
                    i > analysierSchritt ? "opacity-30" : "opacity-100"
                  }`}
                >
                  {i < analysierSchritt ? (
                    <Check className="h-5 w-5 text-primary" />
                  ) : i === analysierSchritt ? (
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  ) : (
                    <span className="text-lg leading-none">{schritt.icon}</span>
                  )}
                  <span className="text-sm">{schritt.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Button
            onClick={handleAnalyse}
            className="w-full h-12 text-base"
            disabled={!text.trim() && !image}
          >
            <Brain className="h-5 w-5 mr-2" />
            {image ? "Foto + Text analysieren" : "AI analysieren"}
          </Button>
        )}
      </div>
    );
  }

  // --- SCHRITT: ERGEBNIS PRÜFEN ---
  if (!ergebnis) return null;

  return (
    <div className="px-5 pt-6 space-y-4 pb-4">
      <div>
        <h1 className="text-xl font-bold">Ergebnis prüfen</h1>
        <p className="text-sm text-muted-foreground">
          Von der AI erkannt — du kannst alles bearbeiten
        </p>
      </div>

      {/* Kundendaten */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Kundendaten</h3>
            <Badge variant="outline" className="ml-auto text-xs">
              {ergebnis.confidence.kunde}%
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input
                  value={ergebnis.kunde.name}
                  onChange={(e) =>
                    setErgebnis({
                      ...ergebnis,
                      kunde: { ...ergebnis.kunde, name: e.target.value },
                    })
                  }
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Telefon</Label>
                <Input
                  value={ergebnis.kunde.telefon}
                  onChange={(e) =>
                    setErgebnis({
                      ...ergebnis,
                      kunde: { ...ergebnis.kunde, telefon: e.target.value },
                    })
                  }
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">E-Mail</Label>
              <Input
                value={ergebnis.kunde.email}
                onChange={(e) =>
                  setErgebnis({
                    ...ergebnis,
                    kunde: { ...ergebnis.kunde, email: e.target.value },
                  })
                }
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Straße</Label>
              <Input
                value={ergebnis.kunde.strasse}
                onChange={(e) =>
                  setErgebnis({
                    ...ergebnis,
                    kunde: { ...ergebnis.kunde, strasse: e.target.value },
                  })
                }
                className="h-9 text-sm"
                placeholder="Musterstraße 12"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">PLZ</Label>
                <Input
                  value={ergebnis.kunde.plz}
                  onChange={(e) =>
                    setErgebnis({
                      ...ergebnis,
                      kunde: { ...ergebnis.kunde, plz: e.target.value },
                    })
                  }
                  className="h-9 text-sm"
                  placeholder="12345"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Ort</Label>
                <Input
                  value={ergebnis.kunde.ort}
                  onChange={(e) =>
                    setErgebnis({
                      ...ergebnis,
                      kunde: { ...ergebnis.kunde, ort: e.target.value },
                    })
                  }
                  className="h-9 text-sm"
                  placeholder="Berlin"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shop: Produkte */}
      {isShop && ergebnis.produkte && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Erkannte Produkte</h3>
              <Badge variant="outline" className="ml-auto text-xs">
                {ergebnis.confidence.raeume}%
              </Badge>
            </div>
            <div className="space-y-2">
              {ergebnis.produkte.map((produkt, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-muted/50 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{produkt.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">
                      {produkt.menge}x {produkt.einheit}
                    </p>
                  </div>
                  {produkt.preis != null && produkt.preis > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Preis: {produkt.preis.toFixed(2)} EUR
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* FEWO: Aufenthalt */}
      {isFewo && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Aufenthalt</h3>
              <Badge variant="outline" className="ml-auto text-xs">
                {ergebnis.confidence.raeume}%
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {ergebnis.anreise && (
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Anreise</p>
                  <p className="font-medium text-sm">
                    {new Date(ergebnis.anreise + "T00:00:00").toLocaleDateString("de-DE")}
                  </p>
                </div>
              )}
              {ergebnis.abreise && (
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Abreise</p>
                  <p className="font-medium text-sm">
                    {new Date(ergebnis.abreise + "T00:00:00").toLocaleDateString("de-DE")}
                  </p>
                </div>
              )}
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">Personen</p>
                <p className="font-medium text-sm">{ergebnis.personen}</p>
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">Hund</p>
                <p className="font-medium text-sm">{ergebnis.hund ? "Ja" : "Nein"}</p>
              </div>
            </div>
            {ergebnis.wuensche && ergebnis.wuensche.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">Wünsche:</p>
                <div className="flex flex-wrap gap-1">
                  {ergebnis.wuensche.map((w, i) => (
                    <Badge key={i} variant="outline">{w}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Maler: Arbeitsbereiche */}
      {!isShop && !isFewo && ergebnis.arbeitsbereiche && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <Ruler className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Arbeitsbereiche</h3>
              <Badge variant="outline" className="ml-auto text-xs">
                {ergebnis.confidence.raeume}%
              </Badge>
            </div>
            <div className="space-y-2">
              {ergebnis.arbeitsbereiche.map((bereich, i) => {
                const wandfl = berechneWandflaeche(bereich);
                return (
                  <div
                    key={i}
                    className="rounded-lg bg-muted/50 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{bereich.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">
                        ~{wandfl.toFixed(0)} m²
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {bereich.typ === "RAUM"
                        ? `${bereich.laenge} x ${bereich.breite} m, H ${bereich.hoehe} m | ${bereich.fenster}F, ${bereich.tueren}T`
                        : `${bereich.wandflaeche} m² Wand${bereich.deckenflaeche > 0 ? `, ${bereich.deckenflaeche} m² Decke` : ""}`
                      }
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(Object.keys(ARBEIT_LABELS) as (keyof ArbeitsbereichArbeiten)[]).map((key) =>
                        bereich.arbeiten[key] ? (
                          <span
                            key={key}
                            className="inline-block rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px]"
                          >
                            {ARBEIT_LABELS[key]}
                          </span>
                        ) : null
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Maler: Qualität + Extras */}
      {!isShop && !isFewo && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <Paintbrush className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Optionen</h3>
              <Badge variant="outline" className="ml-auto text-xs">
                {ergebnis.confidence.optionen}%
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={ergebnis.qualitaet === "premium" ? "default" : "secondary"}>
                {ergebnis.qualitaet === "premium" ? "Premium" : "Standard"}
              </Badge>
            </div>
            {ergebnis.extras && ergebnis.extras.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">Extras:</p>
                {ergebnis.extras.map((extra, i) => (
                  <Badge key={i} variant="outline" className="mr-1 mb-1">
                    {typeof extra === "string"
                      ? extra
                      : `${extra.bezeichnung} (${extra.schaetzMenge} ${extra.einheit})`}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aktionen */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => {
            setAnalysiert(false);
            setAnalysierSchritt(-1);
            setErgebnis(null);
          }}
        >
          Nochmal
        </Button>
        <Button className="flex-1 h-12 text-base" onClick={handleUebernehmen}>
          <Check className="h-5 w-5 mr-2" />
          Übernehmen
        </Button>
      </div>
    </div>
  );
}
