import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Du bist ein erfahrener Kalkulator in einem deutschen Malerbetrieb. Du analysierst Kundenanfragen (E-Mails, WhatsApp-Nachrichten, Sprachnotizen, handgeschriebene Notizen, Fotos) und extrahierst strukturierte Daten für die Angebotserstellung.

## Deine Aufgabe

Extrahiere folgende Informationen:

### 1. Kunde
- name: Vollständiger Name (z.B. "Familie Müller", "Herr Schmidt", "Schmidt GmbH")
- strasse: Straße + Hausnummer
- plz: 5-stellige Postleitzahl
- ort: Ortsname
- email: E-Mail-Adresse
- telefon: Telefonnummer (formatiert)

### 2. Räume (Array)
Für jeden genannten Raum:
- name: Raumbezeichnung (z.B. "Wohnzimmer", "Schlafzimmer 1")
- laenge: Länge in Metern (Dezimalzahl mit Punkt)
- breite: Breite in Metern
- hoehe: Deckenhöhe (Standard: 2.55)
- fenster: Anzahl Fenster (Standard: 1)
- tueren: Anzahl Türen (Standard: 1)

**Raum-Schätzregeln** wenn keine Maße angegeben:
- "3-Zimmer-Wohnung" → Wohnzimmer 5.0x4.0, Schlafzimmer 4.0x3.5, Kinderzimmer/Arbeitszimmer 3.5x3.0 + Küche 3.5x2.8 + Bad 2.5x2.0 + Flur 5.0x1.5
- "4-Zimmer-Wohnung" → wie oben + zusätzliches Zimmer 3.5x3.0
- "Einfamilienhaus" → ca. 6-8 Räume, etwas größer
- "nur Wohnzimmer" → einzelner Raum mit realistischen Maßen
- Altbau: Deckenhöhe 3.0-3.20m
- Neubau: Deckenhöhe 2.50-2.55m
- Dachgeschoss: Deckenhöhe 2.20-2.40m
- Keller: Deckenhöhe 2.20-2.30m

### 3. Optionen
- qualitaet: "standard" oder "premium"
  → premium bei: Caparol, Brillux, "beste Qualität", "hochwertig", "Latex", "Silikat"
  → standard bei: "günstig", "einfach", "normal", keine besondere Erwähnung
- decke: true wenn Decken gestrichen werden sollen
- spachteln: true wenn gespachtelt, Risse ausgebessert, oder "alles glatt" erwähnt
- tapeteEntfernen: true wenn Tapete/Rauhfaser entfernt werden soll

### 4. Extras (Array von Objekten)
Erfasse Sonderwünsche als strukturierte Objekte:
Für jeden Extra:
- bezeichnung: Beschreibung der Arbeit (z.B. "Sockelleisten streichen")
- kategorie: STREICHEN, VORBEREITUNG, LACKIEREN, TAPEZIEREN oder SONSTIGES
- schaetzMenge: Geschätzte Menge (z.B. 12 lfm Sockelleisten, 2 Stück Türzargen)
- einheit: "lfm", "m²", "Stück" oder "pauschal"

Typische Extras:
- "Sockelleisten/Fußleisten streichen" → kategorie: LACKIEREN, einheit: lfm
- "Türrahmen/Türzargen lackieren" → kategorie: LACKIEREN, einheit: Stück
- "Heizkörper streichen" → kategorie: LACKIEREN, einheit: Stück
- "Möbel rücken/verrücken" → kategorie: SONSTIGES, einheit: pauschal
- "Risse ausbessern" → kategorie: VORBEREITUNG, einheit: pauschal
- "Schimmel behandeln" → kategorie: VORBEREITUNG, einheit: m²
- "Fassade streichen" (Außenbereich!) → kategorie: STREICHEN, einheit: m²
- "Balkon streichen" → kategorie: STREICHEN, einheit: m²

### 5. Confidence (0-100)
- kunde: Wie vollständig sind die Kundendaten? (Name+Adresse+Kontakt = 90+, nur Name = 40, nichts = 10)
- raeume: Wie genau sind die Raumdaten? (echte Maße = 85+, geschätzt = 30-50, vage = 15)
- optionen: Wie klar sind die gewünschten Arbeiten? (detailliert = 80+, nur "streichen" = 50, unklar = 20)

## Erkennungsregeln

**Abkürzungen (besonders Spracheingabe):**
- Wozi/WZ = Wohnzimmer, SZ = Schlafzimmer, KiZi = Kinderzimmer
- WC/Gäste-WC = Gäste-Toilette, HWR = Hauswirtschaftsraum
- EG = Erdgeschoss, OG = Obergeschoss, DG = Dachgeschoss, KG = Keller
- qm/m² = Quadratmeter, lfm/lm = Laufmeter

**Zahlen aus Sprache:**
- "fünf mal vier" = 5.0 x 4.0, "dreieinhalb" = 3.5
- "ca. 20 Quadratmeter" → berechne Maße rückwärts: ~5.0 x 4.0
- "ungefähr 4 auf 3" = 4.0 x 3.0

**Typische Kundenformulierungen:**
- "komplett machen" / "alles neu" = streichen + Decke + ggf. spachteln
- "nur Wände" = keine Decke
- "Renovierung" / "renovieren" = Standard-Streicharbeit
- "Sanierung" = eventuell spachteln + Tapete entfernen
- "weiß streichen" / "alles weiß" = Standard-Wandfarbe
- "farbig" / "Akzent" / "Farbton" = Premium (Tönfarbe nötig)

WICHTIG:
- Dezimalpunkte verwenden (3.5 nicht 3,5)
- Leere Strings "" für fehlende Felder, NICHT null
- Confidence IMMER als ganze Zahl 0-100 angeben
- Bei Spracheingaben großzügig interpretieren (Tippfehler, Versprecher)
- Wenn m² angegeben statt Maße: rückwärts rechnen auf plausible L x B`;

const RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "anfrage_parsing",
    strict: true,
    schema: {
      type: "object",
      properties: {
        kunde: {
          type: "object",
          properties: {
            name: { type: "string" },
            strasse: { type: "string" },
            plz: { type: "string" },
            ort: { type: "string" },
            email: { type: "string" },
            telefon: { type: "string" },
          },
          required: ["name", "strasse", "plz", "ort", "email", "telefon"],
          additionalProperties: false,
        },
        raeume: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              laenge: { type: "number" },
              breite: { type: "number" },
              hoehe: { type: "number" },
              fenster: { type: "number" },
              tueren: { type: "number" },
            },
            required: ["name", "laenge", "breite", "hoehe", "fenster", "tueren"],
            additionalProperties: false,
          },
        },
        optionen: {
          type: "object",
          properties: {
            qualitaet: { type: "string", enum: ["standard", "premium"] },
            decke: { type: "boolean" },
            spachteln: { type: "boolean" },
            tapeteEntfernen: { type: "boolean" },
          },
          required: ["qualitaet", "decke", "spachteln", "tapeteEntfernen"],
          additionalProperties: false,
        },
        extras: {
          type: "array",
          items: {
            type: "object",
            properties: {
              bezeichnung: { type: "string" },
              kategorie: { type: "string", enum: ["STREICHEN", "VORBEREITUNG", "LACKIEREN", "TAPEZIEREN", "SONSTIGES"] },
              schaetzMenge: { type: "number" },
              einheit: { type: "string" },
            },
            required: ["bezeichnung", "kategorie", "schaetzMenge", "einheit"],
            additionalProperties: false,
          },
        },
        confidence: {
          type: "object",
          properties: {
            kunde: { type: "number" },
            raeume: { type: "number" },
            optionen: { type: "number" },
          },
          required: ["kunde", "raeume", "optionen"],
          additionalProperties: false,
        },
      },
      required: ["kunde", "raeume", "optionen", "extras", "confidence"],
      additionalProperties: false,
    },
  },
};

// Build system prompt with user's catalog context
function buildSystemPrompt(katalogKontext: string): string {
  return SYSTEM_PROMPT + (katalogKontext ? `\n\n${katalogKontext}` : "");
}

// Load user's catalog and build context string
async function loadKatalogKontext(firmaId: string): Promise<string> {
  const [materialien, leistungen] = await Promise.all([
    prisma.material.findMany({
      where: { firmaId, aktiv: true },
      select: { name: true, kategorie: true },
    }),
    prisma.leistung.findMany({
      where: { firmaId, aktiv: true },
      select: { name: true, kategorie: true },
    }),
  ]);

  if (materialien.length === 0 && leistungen.length === 0) return "";

  let kontext = "## Verfügbarer Katalog des Betriebs\nWenn der Kunde Materialien oder Arbeiten erwähnt, versuche die passenden Einträge aus diesem Katalog zu referenzieren.\n";
  if (materialien.length > 0) {
    kontext += "Materialien: " + materialien.map((m) => `${m.name} (${m.kategorie})`).join(", ") + "\n";
  }
  if (leistungen.length > 0) {
    kontext += "Leistungen: " + leistungen.map((l) => `${l.name} (${l.kategorie})`).join(", ") + "\n";
  }
  return kontext;
}

// Post-validation: clamp room dimensions, validate PLZ
function validateParsedResult(data: Record<string, unknown>): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raeume = data.raeume as any[];
  if (Array.isArray(raeume)) {
    for (const raum of raeume) {
      if (typeof raum.laenge === "number") raum.laenge = Math.max(1.0, Math.min(15.0, raum.laenge));
      if (typeof raum.breite === "number") raum.breite = Math.max(1.0, Math.min(15.0, raum.breite));
      if (typeof raum.hoehe === "number") raum.hoehe = Math.max(2.0, Math.min(5.0, raum.hoehe));
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kunde = data.kunde as any;
  if (kunde && typeof kunde.plz === "string" && kunde.plz && !/^\d{5}$/.test(kunde.plz)) {
    // Try to extract 5 digits
    const match = kunde.plz.match(/\d{5}/);
    kunde.plz = match ? match[0] : "";
  }

  // Validate extras
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extras = data.extras as any[];
  if (Array.isArray(extras)) {
    for (const extra of extras) {
      if (typeof extra.schaetzMenge === "number") {
        // Clamp: max 500 for m²/lfm, max 50 for Stück, default 1 for pauschal
        if (extra.einheit === "pauschal") {
          extra.schaetzMenge = Math.max(1, Math.min(10, extra.schaetzMenge));
        } else if (extra.einheit === "Stück") {
          extra.schaetzMenge = Math.max(0, Math.min(50, extra.schaetzMenge));
        } else {
          extra.schaetzMenge = Math.max(0, Math.min(500, extra.schaetzMenge));
        }
      }
    }
  }

  return data;
}

export async function POST(request: Request) {
  let inputText = "";

  try {
    // Auth + catalog context (best-effort, don't fail if not logged in)
    let katalogKontext = "";
    try {
      const user = await requireUser();
      katalogKontext = await loadKatalogKontext(user.firmaId);
    } catch {
      // Not logged in or DB error — proceed without catalog
    }

    const systemPrompt = buildSystemPrompt(katalogKontext);
    const contentType = request.headers.get("content-type") || "";

    // Handle multipart/form-data (image + optional text)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const image = formData.get("image") as File | null;
      const textPart = formData.get("text") as string | null;

      if (!image && !textPart) {
        return NextResponse.json(
          { error: "Kein Bild oder Text angegeben" },
          { status: 400 }
        );
      }

      if (!process.env.OPENAI_API_KEY) {
        if (textPart) return NextResponse.json(parseAnfrageRegex(textPart));
        return NextResponse.json({ error: "Kein API Key für Bilderkennung" }, { status: 500 });
      }

      // Build message with image and/or text
      const userContent: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "high" } }> = [];

      if (textPart) {
        userContent.push({
          type: "text",
          text: `Der Kunde hat zusätzlich diesen Text geschrieben:\n\n${textPart}\n\nAnalysiere den Text und das Bild zusammen.`,
        });
      } else {
        userContent.push({
          type: "text",
          text: "Analysiere diese Kundenanfrage. Das Bild zeigt eine handschriftliche Notiz, einen Screenshot (WhatsApp/E-Mail), oder ein Foto mit Auftrags-Informationen. Extrahiere alle erkennbaren Daten:",
        });
      }

      if (image) {
        const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
        userContent.push({
          type: "image_url",
          image_url: { url: `data:${image.type};base64,${base64}`, detail: "high" },
        });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: RESPONSE_FORMAT,
        temperature: 0.1,
        max_tokens: 4000,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return NextResponse.json({ error: "Keine Antwort vom AI" }, { status: 500 });
      }

      return NextResponse.json(validateParsedResult(JSON.parse(content)));
    }

    // Handle JSON body (text only)
    const body = await request.json();
    inputText = body.text;

    if (!inputText || typeof inputText !== "string") {
      return NextResponse.json(
        { error: "Kein Text angegeben" },
        { status: 400 }
      );
    }

    // Fallback auf Regex wenn kein API Key
    if (!process.env.OPENAI_API_KEY) {
      console.log("AI Parse: Kein API Key, nutze Regex-Fallback");
      return NextResponse.json(parseAnfrageRegex(inputText));
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: inputText },
      ],
      response_format: RESPONSE_FORMAT,
      temperature: 0.1,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.error("OpenAI: Leere Antwort, nutze Regex-Fallback");
      return NextResponse.json(parseAnfrageRegex(inputText));
    }

    const parsed = validateParsedResult(JSON.parse(content));
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("AI Parse Fehler:", error);

    // Bei OpenAI-Fehlern: Fallback auf Regex
    if (inputText) {
      console.log("OpenAI fehlgeschlagen, nutze Regex-Fallback");
      return NextResponse.json(parseAnfrageRegex(inputText));
    }

    return NextResponse.json(
      { error: "Fehler bei der Analyse" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════
// Regelbasiertes Parsing (Fallback ohne AI)
// ═══════════════════════════════════════════

// Deutsche Zahlwörter → Ziffern
const ZAHLWOERTER: Record<string, number> = {
  null: 0, eins: 1, ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4,
  fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10,
  elf: 11, zwölf: 12, zwoelf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15,
  zwanzig: 20, dreißig: 30, vierzig: 40, fünfzig: 50,
};

// "fünf" → 5, "5,2" → 5.2, "fünf komma zwei" → 5.2, "zweieinhalb" → 2.5
function parseZahl(s: string): number | null {
  if (!s) return null;
  s = s.trim().toLowerCase();

  // Reine Zahl: "5", "5.2", "5,2"
  const num = parseFloat(s.replace(",", "."));
  if (!isNaN(num)) return num;

  // "zweieinhalb", "dreieinhalb"
  if (s.includes("einhalb")) {
    const prefix = s.replace("einhalb", "");
    const base = ZAHLWOERTER[prefix];
    if (base !== undefined) return base + 0.5;
  }

  // "fünf komma zwei", "drei komma fünf"
  const kommaMatch = s.match(/^(\w+)\s*komma\s*(\w+)$/);
  if (kommaMatch) {
    const ganzzahl = ZAHLWOERTER[kommaMatch[1]];
    const dezimal = ZAHLWOERTER[kommaMatch[2]];
    if (ganzzahl !== undefined && dezimal !== undefined) {
      return ganzzahl + dezimal / 10;
    }
  }

  // Einfaches Zahlwort
  return ZAHLWOERTER[s] ?? null;
}

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Text vorverarbeiten: Zahlwörter durch Ziffern ersetzen
// Hinweis: \w matcht keine Umlaute in JS, darum \S+ (non-whitespace) verwenden
function normalizeText(text: string): string {
  let result = text;

  // "zweieinhalb meter" → "2.5 meter"
  result = result.replace(
    /(?:^|\s)(zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun)einhalb(?:\s|$)/gi,
    (match, prefix) => {
      const base = ZAHLWOERTER[prefix.toLowerCase()];
      return base !== undefined ? match.replace(prefix + "einhalb", String(base + 0.5)) : match;
    }
  );

  // "fünf komma zwei" → "5,2"
  result = result.replace(
    /(\S+)\s+komma\s+(\S+)/gi,
    (match, a, b) => {
      const av = ZAHLWOERTER[a.toLowerCase()];
      const bv = ZAHLWOERTER[b.toLowerCase()];
      return av !== undefined && bv !== undefined ? `${av},${bv}` : match;
    }
  );

  // "fünf mal vier" → "5 x 4"
  result = result.replace(
    /(\S+)\s+mal\s+(\S+)/gi,
    (match, a, b) => {
      const av = parseZahl(a);
      const bv = parseZahl(b);
      return av !== null && bv !== null ? `${av} x ${bv}` : match;
    }
  );

  // Einzelne Zahlwörter ersetzen (nur Wörter ≥4 Buchstaben um false positives zu vermeiden)
  for (const [wort, zahl] of Object.entries(ZAHLWOERTER)) {
    if (wort.length < 4) continue;
    // Lookbehind/lookahead für Wortgrenzen die auch mit Umlauten funktionieren
    const re = new RegExp(`(?<=^|\\s)${wort}(?=\\s|$|[.,;:!?])`, "gi");
    result = result.replace(re, String(zahl));
  }

  return result;
}

function parseAnfrageRegex(rawText: string) {
  // Text normalisieren: Zahlwörter → Ziffern
  const text = normalizeText(rawText);

  const kunde = parseKunde(text);
  const raeume = parseRaeume(text);
  const optionen = parseOptionen(text);
  const extras = parseExtras(text);

  const hasNumbers = /\d/.test(rawText);
  const isVoice = !hasNumbers && rawText.length > 30;

  return {
    kunde,
    raeume,
    optionen,
    extras,
    confidence: {
      kunde: kunde.name ? (isVoice ? 40 : 60) : 15,
      raeume: raeume.length > 0 ? (isVoice ? 35 : 55) : 10,
      optionen: isVoice ? 30 : 45,
    },
  };
}

function parseKunde(text: string) {
  const kunde = {
    name: "",
    strasse: "",
    plz: "",
    ort: "",
    email: "",
    telefon: "",
  };

  // Name-Erkennung: max 1-3 Wörter, case-insensitive für Spracheingabe
  // 1. Grußformel: "Mit freundlichen Grüßen\nFamilie Müller"
  const grussMatch = text.match(
    /(?:gr[uü][sß]e?|mfg|freundlichen\s+gr[uü][sß]en|liebe\s+gr[uü][sß]e)\s*[,]?\s*\n\s*((?:familie\s+)?[a-zäöüßA-ZÄÖÜ]+(?:\s+[a-zäöüßA-ZÄÖÜ]+)?)/i
  );
  if (grussMatch) kunde.name = capitalize(grussMatch[1]);

  // 2. "Familie X" (fast immer der Absender)
  if (!kunde.name) {
    const familieMatch = text.match(
      /familie\s+([a-zäöüßA-ZÄÖÜ]+(?:[-\s]+[a-zäöüßA-ZÄÖÜ]+)?)/i
    );
    if (familieMatch) kunde.name = "Familie " + capitalize(familieMatch[1]);
  }

  // Stoppwörter die kein Name sind
  const stoppwoerter = new Set([
    "und", "ich", "wir", "sie", "das", "die", "der", "den", "dem",
    "ist", "hat", "war", "bin", "sind", "hier", "dort", "also",
    "aber", "oder", "für", "von", "mit", "bei", "nach", "aus",
    "ein", "eine", "mein", "meine", "unser", "unsere", "bitte",
    "mal", "noch", "schon", "sehr", "ganz", "gerne", "dann",
    "würde", "möchte", "brauche", "hätte", "kann", "soll",
  ]);

  // 3. "Herr/Frau X" — genau 1 Nachname (kein Stoppwort)
  if (!kunde.name) {
    const nameMatch = text.match(
      /(?:herr|frau|hr\.|fr\.)\s+([a-zäöüßA-ZÄÖÜ]{2,})/i
    );
    if (nameMatch && !stoppwoerter.has(nameMatch[1].toLowerCase())) {
      const anrede = text.match(/herr/i) ? "Herr" : "Frau";
      kunde.name = anrede + " " + capitalize(nameMatch[1]);
    }
  }

  // 4. "Mein Name ist X" / "Ich bin X / heiße X"
  if (!kunde.name) {
    const ichBinMatch = text.match(
      /(?:mein name ist|ich bin|ich hei[sß]e)\s+(?:der\s+|die\s+)?([a-zäöüßA-ZÄÖÜ]{2,}(?:\s+[a-zäöüßA-ZÄÖÜ]{2,})?)/i
    );
    if (ichBinMatch && !stoppwoerter.has(ichBinMatch[1].split(/\s/)[0].toLowerCase())) {
      kunde.name = capitalize(ichBinMatch[1]);
    }
  }

  // E-Mail
  const emailMatch = text.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  );
  if (emailMatch) kunde.email = emailMatch[0];

  // Telefon — verschiedene Formate
  const telMatch = text.match(
    /(?:Tel\.?|Telefon|Mobil|Handy|Ruf|Nummer)?[:\s]*((?:\+49|0)[\s]?\d[\d\s/.()\-]{6,})/i
  );
  if (telMatch) kunde.telefon = telMatch[1].replace(/[\s()]/g, "").trim();

  // Straße — erweiterte Erkennung
  // Pattern 1: "Gartenstraße 8", "Hauptstr. 12a", "Am Markt 3"
  const strassePatterns = [
    // Klassisch: Xyzstraße/str./weg/etc. + Hausnummer
    /([A-ZÄÖÜ][a-zäöüß]+(?:straße|strasse|str\.?|weg|gasse|platz|allee|ring|damm|steig|pfad|ufer|graben|berg|hof|stieg)\s*\d+\s*[a-zA-Z]?)/i,
    // Zusammengesetzt: "Am/An/In der/Zur X 12"
    /((?:Am|An\s+der|In\s+der|Zum|Zur|Auf\s+dem|Im)\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[a-zäöüß]+)?\s*\d+\s*[a-zA-Z]?)/i,
    // Einfach: "Xyzweg 12", "Abc 5" nach PLZ-Zeile
    /(?:in\s+der|wohnen?\s+in|adresse:?)\s*([A-ZÄÖÜ][a-zäöüß]+\s*\d+\s*[a-zA-Z]?)/i,
  ];

  for (const pattern of strassePatterns) {
    const match = text.match(pattern);
    if (match) {
      kunde.strasse = match[1].trim();
      break;
    }
  }

  // PLZ + Ort — flexibler (Ort = 1 Wort + optional Bindestrich-Teil + optional "am/an Main")
  const plzOrtPatterns = [
    // "26721 Emden", "60311 Frankfurt am Main", "40233 Düsseldorf-Gerresheim"
    /(\d{5})\s+([A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?(?:\s+(?:am|an|ob|bei|im|in)(?:\s+der)?\s+[A-ZÄÖÜ][a-zäöüß]+)?)/,
  ];

  for (const pattern of plzOrtPatterns) {
    const match = text.match(pattern);
    if (match) {
      kunde.plz = match[1];
      kunde.ort = match[2];
      break;
    }
  }

  return kunde;
}

function parseRaeume(text: string) {
  const raeume: Array<{
    name: string;
    laenge: number;
    breite: number;
    hoehe: number;
    fenster: number;
    tueren: number;
  }> = [];

  // Raumnamen mit Varianten (auch Sprache: "wozi", "sz", "kizi")
  const raumVarianten: Array<{ display: string; patterns: string[] }> = [
    { display: "Wohnzimmer", patterns: ["wohnzimmer", "wozi", "wohnraum"] },
    { display: "Schlafzimmer", patterns: ["schlafzimmer", "sz", "schlafraum"] },
    { display: "Kinderzimmer", patterns: ["kinderzimmer", "kizi", "kinder zimmer"] },
    { display: "Küche", patterns: ["k[uü]che"] },
    { display: "Bad", patterns: ["bad", "badezimmer", "g[äa]ste.?wc", "toilette"] },
    { display: "Flur", patterns: ["flur", "diele", "gang", "korridor", "eingang"] },
    { display: "Büro", patterns: ["b[uü]ro", "arbeitszimmer", "homeoffice", "home.?office"] },
    { display: "Keller", patterns: ["keller", "kellerraum"] },
    { display: "Treppenhaus", patterns: ["treppenhaus", "treppe"] },
    { display: "Esszimmer", patterns: ["esszimmer", "essbereich"] },
    { display: "Gästezimmer", patterns: ["g[äa]ste.?zimmer"] },
  ];

  // Deckenhöhe suchen (auch Sprache: "deckenhöhe ist 2.5 meter")
  let defaultHoehe = 2.55;
  const hoehePatterns = [
    /(?:deckenh[oö]he|raumh[oö]he)(?:\s+ist|\s+von|[:\s])\s*(?:ca\.?\s*|ungef[äa]hr\s+)?(\d+[.,]\d+)\s*m/i,
    /(?:deckenh[oö]he|raumh[oö]he)(?:\s+ist|\s+von|[:\s])\s*(?:ca\.?\s*)?(\d+[.,]\d+)/i,
    /(\d+[.,]\d+)\s*(?:m(?:eter)?\s+)?(?:hoch|deckenh[oö]he)/i,
    /(?:h[oö]he)(?:\s+ist|\s+von|[:\s])\s*(?:ca\.?\s*)?(\d+[.,]\d+)\s*m/i,
  ];
  for (const hp of hoehePatterns) {
    const hm = text.match(hp);
    if (hm) {
      defaultHoehe = parseFloat(hm[1].replace(",", "."));
      break;
    }
  }

  // Für jeden bekannten Raum nach Maßen suchen
  for (const rv of raumVarianten) {
    for (const pattern of rv.patterns) {
      // Pattern: "wohnzimmer 5,2 x 4,1" oder "wohnzimmer ist so 5 x 4" oder "das wohnzimmer hat ca 5 mal 4"
      const regex = new RegExp(
        `${pattern}[,:\\s]+(?:das\\s+)?(?:ist\\s+(?:so\\s+)?|hat\\s+|mit\\s+|ca\\.?\\s*|ungef[äa]hr\\s+|circa\\s+|etwa\\s+)*(\\d+[.,]?\\d*)\\s*(?:m(?:eter)?\\s*)?[xX×]\\s*(\\d+[.,]?\\d*)`,
        "i"
      );
      const match = text.match(regex);
      if (match) {
        const laenge = parseFloat(match[1].replace(",", "."));
        const breite = parseFloat(match[2].replace(",", "."));

        if (laenge > 0 && laenge < 30 && breite > 0 && breite < 30) {
          // Fenster/Türen in der Umgebung suchen
          const ctx = text.substring(
            Math.max(0, (match.index || 0) - 10),
            (match.index || 0) + match[0].length + 80
          );
          const fensterMatch = ctx.match(/(\d+)\s*(?:fenster)/i);
          const tuerenMatch = ctx.match(/(\d+)\s*(?:t[uü]r|t[uü]ren)/i);

          // Nicht doppelt hinzufügen
          if (!raeume.find((r) => r.name === rv.display)) {
            raeume.push({
              name: rv.display,
              laenge,
              breite,
              hoehe: defaultHoehe,
              fenster: fensterMatch ? parseInt(fensterMatch[1]) : 1,
              tueren: tuerenMatch ? parseInt(tuerenMatch[1]) : 1,
            });
          }
        }
        break;
      }
    }
  }

  // Wenn keine Maße gefunden: Raumname allein erwähnt → Default-Maße
  if (raeume.length === 0) {
    const defaultMasse: Record<string, [number, number]> = {
      Wohnzimmer: [5.0, 4.0],
      Schlafzimmer: [4.0, 3.5],
      Kinderzimmer: [3.5, 3.0],
      Küche: [3.5, 2.8],
      Bad: [2.5, 2.0],
      Flur: [5.0, 1.5],
      Büro: [3.5, 3.0],
      Esszimmer: [4.0, 3.5],
      Gästezimmer: [3.5, 3.0],
      Keller: [4.0, 3.0],
      Treppenhaus: [3.0, 2.5],
    };

    for (const rv of raumVarianten) {
      for (const pattern of rv.patterns) {
        const found = new RegExp(`\\b${pattern}\\b`, "i").test(text);
        if (found && !raeume.find((r) => r.name === rv.display)) {
          const masse = defaultMasse[rv.display] || [4.0, 3.5];
          raeume.push({
            name: rv.display,
            laenge: masse[0],
            breite: masse[1],
            hoehe: defaultHoehe,
            fenster: 1,
            tueren: 1,
          });
        }
      }
    }
  }

  // Fallback: "3 Zimmer Wohnung" / "3 Räume"
  if (raeume.length === 0) {
    const anzahlMatch = text.match(
      /(\d+)[\s-]*(?:r[äa]ume|zimmer(?:\s*wohnung)?)/i
    );
    const anzahl = anzahlMatch ? parseInt(anzahlMatch[1]) : 0;

    if (anzahl > 0) {
      const defaultNamen = ["Wohnzimmer", "Schlafzimmer", "Kinderzimmer", "Büro", "Gästezimmer"];
      const defaultMasse = [[5.0, 4.0], [4.0, 3.5], [3.5, 3.0], [3.5, 3.0], [3.5, 3.0]];
      for (let i = 0; i < Math.min(anzahl, 5); i++) {
        raeume.push({
          name: defaultNamen[i] || `Raum ${i + 1}`,
          laenge: defaultMasse[i]?.[0] || 4.0,
          breite: defaultMasse[i]?.[1] || 3.5,
          hoehe: defaultHoehe,
          fenster: 1,
          tueren: 1,
        });
      }
    }
  }

  return raeume;
}

function parseOptionen(text: string) {
  const lower = text.toLowerCase();

  const isPremium =
    lower.includes("hochwertig") ||
    lower.includes("premium") ||
    lower.includes("caparol") ||
    lower.includes("beste") ||
    lower.includes("qualität");

  const decke = lower.includes("decke") || lower.includes("decken");

  const spachteln =
    lower.includes("spachtel") ||
    lower.includes("risse") ||
    lower.includes("ausbessern") ||
    lower.includes("glätten");

  const tapeteEntfernen =
    lower.includes("tapete") ||
    lower.includes("ablösen") ||
    lower.includes("abkratzen");

  return {
    qualitaet: isPremium ? ("premium" as const) : ("standard" as const),
    decke,
    spachteln,
    tapeteEntfernen,
  };
}

function parseExtras(text: string) {
  const extras: Array<{ bezeichnung: string; kategorie: string; schaetzMenge: number; einheit: string }> = [];
  const lower = text.toLowerCase();

  if (lower.includes("riss") || lower.includes("ausbessern")) {
    extras.push({ bezeichnung: "Risse ausbessern", kategorie: "VORBEREITUNG", schaetzMenge: 1, einheit: "pauschal" });
  }
  if (lower.includes("tapete entfern") || lower.includes("tapete ablös")) {
    extras.push({ bezeichnung: "Tapete entfernen", kategorie: "VORBEREITUNG", schaetzMenge: 1, einheit: "pauschal" });
  }
  if (lower.includes("möbel") && lower.includes("rück")) {
    extras.push({ bezeichnung: "Möbel rücken", kategorie: "SONSTIGES", schaetzMenge: 1, einheit: "pauschal" });
  }
  if (lower.includes("sockelleist")) {
    extras.push({ bezeichnung: "Sockelleisten streichen", kategorie: "LACKIEREN", schaetzMenge: 12, einheit: "lfm" });
  }
  if (lower.includes("türrahmen") || lower.includes("türzargen") || lower.includes("tuerzargen")) {
    extras.push({ bezeichnung: "Türzargen lackieren", kategorie: "LACKIEREN", schaetzMenge: 2, einheit: "Stück" });
  }
  if (lower.includes("heizkörper") || lower.includes("heizkoerper")) {
    extras.push({ bezeichnung: "Heizkörper streichen", kategorie: "LACKIEREN", schaetzMenge: 2, einheit: "Stück" });
  }
  if (lower.includes("schimmel")) {
    extras.push({ bezeichnung: "Schimmel behandeln", kategorie: "VORBEREITUNG", schaetzMenge: 5, einheit: "m²" });
  }

  return extras;
}
