import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ═══════════════════════════════════════════
// SHOP SYSTEM PROMPT + RESPONSE FORMAT
// ═══════════════════════════════════════════

const SHOP_SYSTEM_PROMPT = `Du bist ein Assistent für ein deutsches Shop/E-Commerce-Unternehmen. Du analysierst Kundenanfragen, Bestellungen, Rechnungen, Produktlisten und Fotos davon und extrahierst strukturierte Daten für die Angebotserstellung.

## Deine Aufgabe

Extrahiere folgende Informationen:

### 1. Kunde
- name: Vollständiger Name oder Firmenname
- strasse: Straße + Hausnummer
- plz: 5-stellige Postleitzahl
- ort: Ortsname
- email: E-Mail-Adresse
- telefon: Telefonnummer

### 2. Produkte (Array)
Für jedes genannte Produkt:
- name: Produktbezeichnung (so genau wie möglich)
- menge: Gewünschte Anzahl (Standard: 1)
- einheit: "Stk.", "kg", "m", "Paar", "Set", "Rolle", "Karton" etc.
- preis: Falls ein Preis genannt wird, sonst 0

### 3. Confidence (0-100)
- kunde: Wie vollständig sind die Kundendaten?
- raeume: Wie genau sind die Produktdaten? (verwende "raeume" als Feld)
- optionen: Wie klar ist die Anfrage insgesamt?

## Erkennungsregeln

**Mengenangaben:**
- "5x Laptop" = menge: 5
- "Laptop Dell" ohne Mengenangabe = menge: 1
- "ein Paar Schuhe" = menge: 1, einheit: "Paar"
- "3 Karton Druckerpapier" = menge: 3, einheit: "Karton"

**Preise:**
- Wenn Preise genannt werden (z.B. "à 199€"), diese erfassen
- Bei "VK", "Stückpreis", "pro Stück" den Einzelpreis verwenden
- Falls kein Preis: preis = 0

**Produktnamen:**
- Möglichst vollständig erfassen (Marke + Modell + Variante)
- "Dell XPS 15 16GB" → name: "Laptop Dell XPS 15 16GB"
- Abkürzungen auflösen wo sinnvoll

WICHTIG:
- Dezimalpunkte verwenden (3.5 nicht 3,5)
- Leere Strings "" für fehlende Felder, NICHT null
- Confidence IMMER als ganze Zahl 0-100 angeben`;

const SHOP_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "shop_anfrage_parsing",
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
        produkte: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              menge: { type: "number" },
              einheit: { type: "string" },
              preis: { type: "number" },
            },
            required: ["name", "menge", "einheit", "preis"],
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
      required: ["kunde", "produkte", "confidence"],
      additionalProperties: false,
    },
  },
};

function buildShopSystemPrompt(katalogKontext: string): string {
  return SHOP_SYSTEM_PROMPT + (katalogKontext ? `\n\n${katalogKontext}` : "");
}

async function loadShopKatalogKontext(firmaId: string): Promise<string> {
  const produkte = await prisma.produkt.findMany({
    where: { firmaId, aktiv: true },
    select: { name: true, kategorie: true, vkPreis: true, einheit: true },
  });

  if (produkte.length === 0) return "";

  let kontext = "## Verfügbarer Produktkatalog\nWenn der Kunde Produkte erwähnt, versuche die passenden Einträge aus diesem Katalog zu referenzieren und verwende deren Preise.\n";
  kontext += "Produkte: " + produkte.map((p) => `${p.name} (${p.kategorie}, ${p.vkPreis}€/${p.einheit})`).join(", ") + "\n";
  return kontext;
}

function parseShopAnfrageRegex(rawText: string) {
  const text = rawText;
  const kunde = parseKunde(text);

  // Einfaches Regex-Parsing für Produkte
  const produkte: Array<{ name: string; menge: number; einheit: string; preis: number }> = [];
  const lines = text.split("\n");
  for (const line of lines) {
    // Patterns: "5x Laptop Dell", "- 3 Stk. Monitor", "10x USB-Kabel à 12,90€"
    const match = line.match(/[-•*]?\s*(\d+)\s*[xX×]?\s+(.+?)(?:\s+[àa@]\s*([\d.,]+)\s*(?:€|EUR|eur))?$/);
    if (match) {
      const menge = parseInt(match[1]) || 1;
      const name = match[2].replace(/\s+$/, "").replace(/^[,\s]+/, "");
      const preis = match[3] ? parseFloat(match[3].replace(",", ".")) : 0;
      if (name.length > 1) {
        produkte.push({ name, menge, einheit: "Stk.", preis });
      }
    }
  }

  return {
    kunde,
    produkte,
    confidence: {
      kunde: kunde.name ? 50 : 15,
      raeume: produkte.length > 0 ? 50 : 10,
      optionen: 40,
    },
  };
}

// ═══════════════════════════════════════════
// MALER SYSTEM PROMPT (original)
// ═══════════════════════════════════════════

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

### 2. Arbeitsbereiche (Array)
Für jeden genannten Raum oder Bereich:
- name: Bezeichnung (z.B. "Wohnzimmer", "Schlafzimmer 1", "Fassade Süd")
- typ: "RAUM" wenn Maße (Länge x Breite x Höhe) bekannt/schätzbar, "FLAECHE" wenn nur m² genannt (z.B. Fassade, Treppenhaus)
- laenge: Länge in Metern (nur bei typ RAUM, sonst 0)
- breite: Breite in Metern (nur bei typ RAUM, sonst 0)
- hoehe: Deckenhöhe (nur bei typ RAUM, Standard: 2.55, sonst 0)
- fenster: Anzahl Fenster (nur bei typ RAUM, Standard: 1, sonst 0)
- tueren: Anzahl Türen (nur bei typ RAUM, Standard: 1, sonst 0)
- wandflaeche: Direkte Wandfläche in m² (nur bei typ FLAECHE, sonst 0)
- deckenflaeche: Direkte Deckenfläche in m² (nur bei typ FLAECHE, sonst 0)
- arbeiten: Welche Arbeiten in diesem Bereich durchgeführt werden sollen:
  - waendeStreichen: IMMER true wenn nichts anderes gesagt wird (Standardarbeit)
  - deckeStreichen: true wenn Kunde "Decke" erwähnt, "komplett" sagt, oder "alles" meint
  - grundierung: true standardmäßig (Grundierung gehört zur Standardvorbereitung)
  - spachteln: true wenn Risse, Unebenheiten, Q3-Qualität, "alles glatt", "glätten" erwähnt
  - tapeteEntfernen: true wenn "alte Tapete ab", "Tapete entfernen", "Tapete ablösen"
  - tapezieren: true wenn "neue Tapete", "Raufaser", "tapezieren"

**Raum-Schätzregeln** wenn keine Maße angegeben:
- "3-Zimmer-Wohnung" → Wohnzimmer 5.0x4.0, Schlafzimmer 4.0x3.5, Kinderzimmer/Arbeitszimmer 3.5x3.0 + Küche 3.5x2.8 + Bad 2.5x2.0 + Flur 5.0x1.5
- "4-Zimmer-Wohnung" → wie oben + zusätzliches Zimmer 3.5x3.0
- "Einfamilienhaus" → ca. 6-8 Räume, etwas größer
- "nur Wohnzimmer" → einzelner Raum mit realistischen Maßen
- Altbau: Deckenhöhe 3.0-3.20m
- Neubau: Deckenhöhe 2.50-2.55m
- "Fassade 80m²" → typ: "FLAECHE", wandflaeche: 80
- "Treppenhaus 45m²" → typ: "FLAECHE", wandflaeche: 45

### 3. Qualität
- qualitaet: "standard" oder "premium"
  → premium bei: Caparol, Brillux, "beste Qualität", "hochwertig", "Latex", "Silikat"
  → standard bei: "günstig", "einfach", "normal", keine besondere Erwähnung

### 4. Extras (Array von Objekten)
Erfasse Sonderwünsche die NICHT durch die Arbeiten pro Bereich abgedeckt sind:
- bezeichnung: Beschreibung der Arbeit (z.B. "Sockelleisten streichen")
- kategorie: STREICHEN, VORBEREITUNG, LACKIEREN, TAPEZIEREN oder SONSTIGES
- schaetzMenge: Geschätzte Menge
- einheit: "lfm", "m²", "Stück" oder "pauschal"

Typische Extras:
- "Sockelleisten/Fußleisten streichen" → kategorie: LACKIEREN, einheit: lfm
- "Türrahmen/Türzargen lackieren" → kategorie: LACKIEREN, einheit: Stück
- "Heizkörper streichen" → kategorie: LACKIEREN, einheit: Stück
- "Möbel rücken/verrücken" → kategorie: SONSTIGES, einheit: pauschal

### 5. Confidence (0-100)
- kunde: Wie vollständig sind die Kundendaten?
- raeume: Wie genau sind die Raumdaten?
- optionen: Wie klar sind die gewünschten Arbeiten?

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
- "komplett machen" / "alles neu" = waendeStreichen + deckeStreichen + grundierung
- "nur Wände" = waendeStreichen true, deckeStreichen false
- "Renovierung" / "renovieren" = waendeStreichen + grundierung
- "Sanierung" = eventuell spachteln + tapeteEntfernen
- "weiß streichen" / "alles weiß" = Standard-Wandfarbe
- "farbig" / "Akzent" / "Farbton" = Premium

WICHTIG:
- Dezimalpunkte verwenden (3.5 nicht 3,5)
- Leere Strings "" für fehlende Felder, NICHT null
- Confidence IMMER als ganze Zahl 0-100 angeben
- Bei Spracheingaben großzügig interpretieren
- Wenn m² angegeben statt Maße: typ = "FLAECHE" verwenden`;

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
        arbeitsbereiche: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              typ: { type: "string", enum: ["RAUM", "FLAECHE"] },
              laenge: { type: "number" },
              breite: { type: "number" },
              hoehe: { type: "number" },
              fenster: { type: "number" },
              tueren: { type: "number" },
              wandflaeche: { type: "number" },
              deckenflaeche: { type: "number" },
              arbeiten: {
                type: "object",
                properties: {
                  waendeStreichen: { type: "boolean" },
                  deckeStreichen: { type: "boolean" },
                  grundierung: { type: "boolean" },
                  spachteln: { type: "boolean" },
                  tapeteEntfernen: { type: "boolean" },
                  tapezieren: { type: "boolean" },
                },
                required: ["waendeStreichen", "deckeStreichen", "grundierung", "spachteln", "tapeteEntfernen", "tapezieren"],
                additionalProperties: false,
              },
            },
            required: ["name", "typ", "laenge", "breite", "hoehe", "fenster", "tueren", "wandflaeche", "deckenflaeche", "arbeiten"],
            additionalProperties: false,
          },
        },
        qualitaet: { type: "string", enum: ["standard", "premium"] },
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
      required: ["kunde", "arbeitsbereiche", "qualitaet", "extras", "confidence"],
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

// Post-validation: clamp dimensions, validate PLZ
function validateParsedResult(data: Record<string, unknown>): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bereiche = data.arbeitsbereiche as any[];
  if (Array.isArray(bereiche)) {
    for (const b of bereiche) {
      if (b.typ === "RAUM") {
        if (typeof b.laenge === "number") b.laenge = Math.max(1.0, Math.min(15.0, b.laenge));
        if (typeof b.breite === "number") b.breite = Math.max(1.0, Math.min(15.0, b.breite));
        if (typeof b.hoehe === "number") b.hoehe = Math.max(2.0, Math.min(5.0, b.hoehe));
      } else if (b.typ === "FLAECHE") {
        if (typeof b.wandflaeche === "number") b.wandflaeche = Math.max(0, Math.min(500, b.wandflaeche));
        if (typeof b.deckenflaeche === "number") b.deckenflaeche = Math.max(0, Math.min(500, b.deckenflaeche));
      }
      // Mindestens eine Arbeit muss aktiv sein
      if (b.arbeiten) {
        const a = b.arbeiten;
        const hasAny = a.waendeStreichen || a.deckeStreichen || a.grundierung ||
          a.spachteln || a.tapeteEntfernen || a.tapezieren;
        if (!hasAny) {
          a.waendeStreichen = true;
          a.grundierung = true;
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kunde = data.kunde as any;
  if (kunde && typeof kunde.plz === "string" && kunde.plz && !/^\d{5}$/.test(kunde.plz)) {
    const match = kunde.plz.match(/\d{5}/);
    kunde.plz = match ? match[0] : "";
  }

  // Validate extras
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extras = data.extras as any[];
  if (Array.isArray(extras)) {
    for (const extra of extras) {
      if (typeof extra.schaetzMenge === "number") {
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
  let branche = "MALER";

  try {
    // Auth + catalog context (best-effort, don't fail if not logged in)
    let katalogKontext = "";
    try {
      const user = await requireUser();
      // Detect branche from firma
      const firma = await prisma.firma.findUnique({
        where: { id: user.firmaId },
        select: { branche: true },
      });
      if (firma?.branche) branche = firma.branche;

      if (branche === "SHOP") {
        katalogKontext = await loadShopKatalogKontext(user.firmaId);
      } else {
        katalogKontext = await loadKatalogKontext(user.firmaId);
      }
    } catch {
      // Not logged in or DB error — proceed without catalog
    }

    const contentType = request.headers.get("content-type") || "";

    // Handle multipart/form-data (image + optional text)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const image = formData.get("image") as File | null;
      const textPart = formData.get("text") as string | null;
      const branchePart = formData.get("branche") as string | null;
      if (branchePart) branche = branchePart;

      if (!image && !textPart) {
        return NextResponse.json(
          { error: "Kein Bild oder Text angegeben" },
          { status: 400 }
        );
      }

      const isShop = branche === "SHOP";

      if (!process.env.OPENAI_API_KEY) {
        if (textPart) {
          return NextResponse.json(
            isShop ? parseShopAnfrageRegex(textPart) : parseAnfrageRegex(textPart)
          );
        }
        return NextResponse.json({ error: "Kein API Key für Bilderkennung" }, { status: 500 });
      }

      const systemPrompt = isShop
        ? buildShopSystemPrompt(katalogKontext)
        : buildSystemPrompt(katalogKontext);
      const responseFormat = isShop ? SHOP_RESPONSE_FORMAT : RESPONSE_FORMAT;

      const userContent: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "high" } }> = [];

      if (textPart) {
        userContent.push({
          type: "text",
          text: isShop
            ? `Der Kunde hat zusätzlich diesen Text geschrieben:\n\n${textPart}\n\nAnalysiere den Text und das Bild zusammen. Extrahiere alle Produkte mit Mengen und Preisen.`
            : `Der Kunde hat zusätzlich diesen Text geschrieben:\n\n${textPart}\n\nAnalysiere den Text und das Bild zusammen.`,
        });
      } else {
        userContent.push({
          type: "text",
          text: isShop
            ? "Analysiere dieses Bild. Es zeigt eine Rechnung, Bestellung, Preisliste oder Produktliste. Extrahiere alle Produkte mit Namen, Mengen, Einheiten und Preisen:"
            : "Analysiere diese Kundenanfrage. Das Bild zeigt eine handschriftliche Notiz, einen Screenshot (WhatsApp/E-Mail), oder ein Foto mit Auftrags-Informationen. Extrahiere alle erkennbaren Daten:",
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
        response_format: responseFormat,
        temperature: 0.1,
        max_tokens: 4000,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return NextResponse.json({ error: "Keine Antwort vom AI" }, { status: 500 });
      }

      const parsed = JSON.parse(content);
      return NextResponse.json(isShop ? parsed : validateParsedResult(parsed));
    }

    // Handle JSON body (text only)
    const body = await request.json();
    inputText = body.text;
    if (body.branche) branche = body.branche;

    if (!inputText || typeof inputText !== "string") {
      return NextResponse.json(
        { error: "Kein Text angegeben" },
        { status: 400 }
      );
    }

    const isShop = branche === "SHOP";

    // Fallback auf Regex wenn kein API Key
    if (!process.env.OPENAI_API_KEY) {
      console.log("AI Parse: Kein API Key, nutze Regex-Fallback");
      return NextResponse.json(
        isShop ? parseShopAnfrageRegex(inputText) : parseAnfrageRegex(inputText)
      );
    }

    const systemPrompt = isShop
      ? buildShopSystemPrompt(katalogKontext)
      : buildSystemPrompt(katalogKontext);
    const responseFormat = isShop ? SHOP_RESPONSE_FORMAT : RESPONSE_FORMAT;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: inputText },
      ],
      response_format: responseFormat,
      temperature: 0.1,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.error("OpenAI: Leere Antwort, nutze Regex-Fallback");
      return NextResponse.json(
        isShop ? parseShopAnfrageRegex(inputText) : parseAnfrageRegex(inputText)
      );
    }

    const parsed = JSON.parse(content);
    return NextResponse.json(isShop ? parsed : validateParsedResult(parsed));
  } catch (error) {
    console.error("AI Parse Fehler:", error);

    if (inputText) {
      console.log("OpenAI fehlgeschlagen, nutze Regex-Fallback");
      const isShop = branche === "SHOP";
      return NextResponse.json(
        isShop ? parseShopAnfrageRegex(inputText) : parseAnfrageRegex(inputText)
      );
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

const DEFAULT_ARBEITEN = {
  waendeStreichen: true,
  deckeStreichen: false,
  grundierung: true,
  spachteln: false,
  tapeteEntfernen: false,
  tapezieren: false,
};

// Deutsche Zahlwörter → Ziffern
const ZAHLWOERTER: Record<string, number> = {
  null: 0, eins: 1, ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4,
  fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10,
  elf: 11, zwölf: 12, zwoelf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15,
  zwanzig: 20, dreißig: 30, vierzig: 40, fünfzig: 50,
};

function parseZahl(s: string): number | null {
  if (!s) return null;
  s = s.trim().toLowerCase();

  const num = parseFloat(s.replace(",", "."));
  if (!isNaN(num)) return num;

  if (s.includes("einhalb")) {
    const prefix = s.replace("einhalb", "");
    const base = ZAHLWOERTER[prefix];
    if (base !== undefined) return base + 0.5;
  }

  const kommaMatch = s.match(/^(\w+)\s*komma\s*(\w+)$/);
  if (kommaMatch) {
    const ganzzahl = ZAHLWOERTER[kommaMatch[1]];
    const dezimal = ZAHLWOERTER[kommaMatch[2]];
    if (ganzzahl !== undefined && dezimal !== undefined) {
      return ganzzahl + dezimal / 10;
    }
  }

  return ZAHLWOERTER[s] ?? null;
}

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeText(text: string): string {
  let result = text;

  result = result.replace(
    /(?:^|\s)(zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun)einhalb(?:\s|$)/gi,
    (match, prefix) => {
      const base = ZAHLWOERTER[prefix.toLowerCase()];
      return base !== undefined ? match.replace(prefix + "einhalb", String(base + 0.5)) : match;
    }
  );

  result = result.replace(
    /(\S+)\s+komma\s+(\S+)/gi,
    (match, a, b) => {
      const av = ZAHLWOERTER[a.toLowerCase()];
      const bv = ZAHLWOERTER[b.toLowerCase()];
      return av !== undefined && bv !== undefined ? `${av},${bv}` : match;
    }
  );

  result = result.replace(
    /(\S+)\s+mal\s+(\S+)/gi,
    (match, a, b) => {
      const av = parseZahl(a);
      const bv = parseZahl(b);
      return av !== null && bv !== null ? `${av} x ${bv}` : match;
    }
  );

  for (const [wort, zahl] of Object.entries(ZAHLWOERTER)) {
    if (wort.length < 4) continue;
    const re = new RegExp(`(?<=^|\\s)${wort}(?=\\s|$|[.,;:!?])`, "gi");
    result = result.replace(re, String(zahl));
  }

  return result;
}

function parseAnfrageRegex(rawText: string) {
  const text = normalizeText(rawText);

  const kunde = parseKunde(text);
  const arbeitsbereiche = parseArbeitsbereiche(text);
  const { qualitaet, arbeiten: globalArbeiten } = parseQualitaetUndArbeiten(text);
  const extras = parseExtras(text);

  // Globale Arbeiten auf alle Bereiche anwenden
  for (const b of arbeitsbereiche) {
    b.arbeiten = { ...DEFAULT_ARBEITEN, ...globalArbeiten };
  }

  const hasNumbers = /\d/.test(rawText);
  const isVoice = !hasNumbers && rawText.length > 30;

  return {
    kunde,
    arbeitsbereiche,
    qualitaet,
    extras,
    confidence: {
      kunde: kunde.name ? (isVoice ? 40 : 60) : 15,
      raeume: arbeitsbereiche.length > 0 ? (isVoice ? 35 : 55) : 10,
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

  const grussMatch = text.match(
    /(?:gr[uü][sß]e?|mfg|freundlichen\s+gr[uü][sß]en|liebe\s+gr[uü][sß]e)\s*[,]?\s*\n\s*((?:familie\s+)?[a-zäöüßA-ZÄÖÜ]+(?:\s+[a-zäöüßA-ZÄÖÜ]+)?)/i
  );
  if (grussMatch) kunde.name = capitalize(grussMatch[1]);

  if (!kunde.name) {
    const familieMatch = text.match(
      /familie\s+([a-zäöüßA-ZÄÖÜ]+(?:[-\s]+[a-zäöüßA-ZÄÖÜ]+)?)/i
    );
    if (familieMatch) kunde.name = "Familie " + capitalize(familieMatch[1]);
  }

  const stoppwoerter = new Set([
    "und", "ich", "wir", "sie", "das", "die", "der", "den", "dem",
    "ist", "hat", "war", "bin", "sind", "hier", "dort", "also",
    "aber", "oder", "für", "von", "mit", "bei", "nach", "aus",
    "ein", "eine", "mein", "meine", "unser", "unsere", "bitte",
    "mal", "noch", "schon", "sehr", "ganz", "gerne", "dann",
    "würde", "möchte", "brauche", "hätte", "kann", "soll",
  ]);

  if (!kunde.name) {
    const nameMatch = text.match(
      /(?:herr|frau|hr\.|fr\.)\s+([a-zäöüßA-ZÄÖÜ]{2,})/i
    );
    if (nameMatch && !stoppwoerter.has(nameMatch[1].toLowerCase())) {
      const anrede = text.match(/herr/i) ? "Herr" : "Frau";
      kunde.name = anrede + " " + capitalize(nameMatch[1]);
    }
  }

  if (!kunde.name) {
    const ichBinMatch = text.match(
      /(?:mein name ist|ich bin|ich hei[sß]e)\s+(?:der\s+|die\s+)?([a-zäöüßA-ZÄÖÜ]{2,}(?:\s+[a-zäöüßA-ZÄÖÜ]{2,})?)/i
    );
    if (ichBinMatch && !stoppwoerter.has(ichBinMatch[1].split(/\s/)[0].toLowerCase())) {
      kunde.name = capitalize(ichBinMatch[1]);
    }
  }

  const emailMatch = text.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  );
  if (emailMatch) kunde.email = emailMatch[0];

  const telMatch = text.match(
    /(?:Tel\.?|Telefon|Mobil|Handy|Ruf|Nummer)?[:\s]*((?:\+49|0)[\s]?\d[\d\s/.()\-]{6,})/i
  );
  if (telMatch) kunde.telefon = telMatch[1].replace(/[\s()]/g, "").trim();

  const strassePatterns = [
    /([A-ZÄÖÜ][a-zäöüß]+(?:straße|strasse|str\.?|weg|gasse|platz|allee|ring|damm|steig|pfad|ufer|graben|berg|hof|stieg)\s*\d+\s*[a-zA-Z]?)/i,
    /((?:Am|An\s+der|In\s+der|Zum|Zur|Auf\s+dem|Im)\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[a-zäöüß]+)?\s*\d+\s*[a-zA-Z]?)/i,
    /(?:in\s+der|wohnen?\s+in|adresse:?)\s*([A-ZÄÖÜ][a-zäöüß]+\s*\d+\s*[a-zA-Z]?)/i,
  ];

  for (const pattern of strassePatterns) {
    const match = text.match(pattern);
    if (match) {
      kunde.strasse = match[1].trim();
      break;
    }
  }

  const plzOrtPatterns = [
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

interface ArbeitsbereichRegex {
  name: string;
  typ: "RAUM" | "FLAECHE";
  laenge: number;
  breite: number;
  hoehe: number;
  fenster: number;
  tueren: number;
  wandflaeche: number;
  deckenflaeche: number;
  arbeiten: typeof DEFAULT_ARBEITEN;
}

function parseArbeitsbereiche(text: string): ArbeitsbereichRegex[] {
  const bereiche: ArbeitsbereichRegex[] = [];

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

  for (const rv of raumVarianten) {
    for (const pattern of rv.patterns) {
      const regex = new RegExp(
        `${pattern}[,:\\s]+(?:das\\s+)?(?:ist\\s+(?:so\\s+)?|hat\\s+|mit\\s+|ca\\.?\\s*|ungef[äa]hr\\s+|circa\\s+|etwa\\s+)*(\\d+[.,]?\\d*)\\s*(?:m(?:eter)?\\s*)?[xX×]\\s*(\\d+[.,]?\\d*)`,
        "i"
      );
      const match = text.match(regex);
      if (match) {
        const laenge = parseFloat(match[1].replace(",", "."));
        const breite = parseFloat(match[2].replace(",", "."));

        if (laenge > 0 && laenge < 30 && breite > 0 && breite < 30) {
          const ctx = text.substring(
            Math.max(0, (match.index || 0) - 10),
            (match.index || 0) + match[0].length + 80
          );
          const fensterMatch = ctx.match(/(\d+)\s*(?:fenster)/i);
          const tuerenMatch = ctx.match(/(\d+)\s*(?:t[uü]r|t[uü]ren)/i);

          if (!bereiche.find((r) => r.name === rv.display)) {
            bereiche.push({
              name: rv.display,
              typ: "RAUM",
              laenge,
              breite,
              hoehe: defaultHoehe,
              fenster: fensterMatch ? parseInt(fensterMatch[1]) : 1,
              tueren: tuerenMatch ? parseInt(tuerenMatch[1]) : 1,
              wandflaeche: 0,
              deckenflaeche: 0,
              arbeiten: { ...DEFAULT_ARBEITEN },
            });
          }
        }
        break;
      }
    }
  }

  // Wenn keine Maße gefunden: Raumname allein erwähnt → Default-Maße
  if (bereiche.length === 0) {
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
        if (found && !bereiche.find((r) => r.name === rv.display)) {
          const masse = defaultMasse[rv.display] || [4.0, 3.5];
          bereiche.push({
            name: rv.display,
            typ: "RAUM",
            laenge: masse[0],
            breite: masse[1],
            hoehe: defaultHoehe,
            fenster: 1,
            tueren: 1,
            wandflaeche: 0,
            deckenflaeche: 0,
            arbeiten: { ...DEFAULT_ARBEITEN },
          });
        }
      }
    }
  }

  // Fallback: "3 Zimmer Wohnung" / "3 Räume"
  if (bereiche.length === 0) {
    const anzahlMatch = text.match(
      /(\d+)[\s-]*(?:r[äa]ume|zimmer(?:\s*wohnung)?)/i
    );
    const anzahl = anzahlMatch ? parseInt(anzahlMatch[1]) : 0;

    if (anzahl > 0) {
      const defaultNamen = ["Wohnzimmer", "Schlafzimmer", "Kinderzimmer", "Büro", "Gästezimmer"];
      const defaultMasse = [[5.0, 4.0], [4.0, 3.5], [3.5, 3.0], [3.5, 3.0], [3.5, 3.0]];
      for (let i = 0; i < Math.min(anzahl, 5); i++) {
        bereiche.push({
          name: defaultNamen[i] || `Raum ${i + 1}`,
          typ: "RAUM",
          laenge: defaultMasse[i]?.[0] || 4.0,
          breite: defaultMasse[i]?.[1] || 3.5,
          hoehe: defaultHoehe,
          fenster: 1,
          tueren: 1,
          wandflaeche: 0,
          deckenflaeche: 0,
          arbeiten: { ...DEFAULT_ARBEITEN },
        });
      }
    }
  }

  return bereiche;
}

function parseQualitaetUndArbeiten(text: string) {
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
    lower.includes("tapete") && (lower.includes("entfern") || lower.includes("ablös") || lower.includes("abkratz"));
  const tapezieren =
    lower.includes("tapezier") || lower.includes("raufaser");

  return {
    qualitaet: isPremium ? "premium" as const : "standard" as const,
    arbeiten: {
      waendeStreichen: true,
      deckeStreichen: decke,
      grundierung: true,
      spachteln,
      tapeteEntfernen,
      tapezieren,
    },
  };
}

function parseExtras(text: string) {
  const extras: Array<{ bezeichnung: string; kategorie: string; schaetzMenge: number; einheit: string }> = [];
  const lower = text.toLowerCase();

  if (lower.includes("riss") || lower.includes("ausbessern")) {
    extras.push({ bezeichnung: "Risse ausbessern", kategorie: "VORBEREITUNG", schaetzMenge: 1, einheit: "pauschal" });
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
