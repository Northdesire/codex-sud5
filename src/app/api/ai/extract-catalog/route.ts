import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const maxDuration = 60;

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// ═══════════════════════════════════════════
// SHOP CATALOG EXTRACTION
// ═══════════════════════════════════════════

const SHOP_CATALOG_PROMPT = `Du bist ein Assistent für ein deutsches Shop/E-Commerce-Unternehmen. Du analysierst Preislisten, Kataloge, Rechnungen, Bestellungen und Fotos davon und extrahierst strukturierte Produktdaten.

## Für jedes Produkt extrahieren:

1. **name**: Vollständiger Produktname (Marke + Modell + Variante)
2. **kategorie**: Frei wählbare Kategorie (z.B. "Computer", "Zubehör", "Bürobedarf", "Elektronik", "Software", etc.)
3. **ekPreis**: Einkaufspreis netto. Bei Staffelpreisen den günstigsten. 0 wenn unbekannt
4. **vkPreis**: Verkaufspreis. Wenn nur EK: EK × 1.3 (30% Aufschlag). Wenn nur ein Preis: diesen nehmen
5. **einheit**: "Stk.", "kg", "m", "Paar", "Set", "Rolle", "Karton", etc.
6. **artikelNr**: Artikelnummer/Bestellnummer falls vorhanden
7. **beschreibung**: Kurze Beschreibung falls erkennbar

## Regeln:
- Extrahiere ALLE erkennbaren Produkte — lieber zu viele als zu wenige
- Preise als Dezimalzahlen mit Punkt: 12.50 (nicht "12,50 €")
- Deutsche Preisformate erkennen: "12,50" → 12.50, "1.250,00" → 1250.00
- Bei Fotos/Scans: auch unscharfe oder teilweise lesbare Texte bestmöglich interpretieren
- Gruppiere ähnliche Produkte in sinnvolle Kategorien
- zusammenfassung: Kurze Zusammenfassung was das Dokument enthält (1-2 Sätze)`;

const SHOP_CATALOG_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "shop_catalog_extraction",
    strict: true,
    schema: {
      type: "object",
      properties: {
        produkte: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              kategorie: { type: "string" },
              ekPreis: { type: "number" },
              vkPreis: { type: "number" },
              einheit: { type: "string" },
              artikelNr: { type: ["string", "null"] },
              beschreibung: { type: ["string", "null"] },
            },
            required: ["name", "kategorie", "ekPreis", "vkPreis", "einheit", "artikelNr", "beschreibung"],
            additionalProperties: false,
          },
        },
        zusammenfassung: { type: "string" },
      },
      required: ["produkte", "zusammenfassung"],
      additionalProperties: false,
    },
  },
};

// ═══════════════════════════════════════════
// FEWO CATALOG EXTRACTION
// ═══════════════════════════════════════════

const FEWO_CATALOG_PROMPT = `Du bist ein Assistent für einen deutschen Ferienwohnungs-/Unterkunftsvermieter. Du analysierst Preislisten, Kataloge und Dokumente und extrahierst Unterkünfte und Extras.

## Für jedes Produkt (Unterkunft oder Extra) extrahieren:

### Unterkünfte (typ="UNTERKUNFT"):
1. **name**: Name der Unterkunft (z.B. "Ferienwohnung Seeblick", "Doppelzimmer Bergpanorama")
2. **kategorie**: "UNTERKUNFT"
3. **ekPreis**: 0
4. **vkPreis**: Preis pro Nacht
5. **einheit**: "Nacht"
6. **artikelNr**: null
7. **beschreibung**: Kapazität und Beschreibung (z.B. "Max. 4 Personen, 65m², Balkon")

### Extras (typ="EXTRA"):
1. **name**: Name des Extras (z.B. "Endreinigung", "Frühstück", "Hund")
2. **kategorie**: "EXTRA"
3. **ekPreis**: 0
4. **vkPreis**: Preis
5. **einheit**: "pauschal", "pro Nacht", "pro Person" oder "pro Nacht/Person"
6. **artikelNr**: null
7. **beschreibung**: Kurze Beschreibung

## Regeln:
- Extrahiere ALLE erkennbaren Unterkünfte und Extras
- Preise als Dezimalzahlen mit Punkt: 12.50
- zusammenfassung: Kurze Zusammenfassung (1-2 Sätze)`;

const FEWO_CATALOG_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "fewo_catalog_extraction",
    strict: true,
    schema: {
      type: "object",
      properties: {
        produkte: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              kategorie: { type: "string" },
              ekPreis: { type: "number" },
              vkPreis: { type: "number" },
              einheit: { type: "string" },
              artikelNr: { type: ["string", "null"] },
              beschreibung: { type: ["string", "null"] },
            },
            required: ["name", "kategorie", "ekPreis", "vkPreis", "einheit", "artikelNr", "beschreibung"],
            additionalProperties: false,
          },
        },
        zusammenfassung: { type: "string" },
      },
      required: ["produkte", "zusammenfassung"],
      additionalProperties: false,
    },
  },
};

// ═══════════════════════════════════════════
// MALER CATALOG EXTRACTION (original)
// ═══════════════════════════════════════════

const SYSTEM_PROMPT = `Du bist ein erfahrener Einkäufer in einem deutschen Malerbetrieb. Du kennst alle gängigen Hersteller (Caparol, Brillux, Sto, Knauf, Sikkens, Dulux, Alpina, Schöner Wohnen, Baufan, Pufas, Metylan) und ihre Produktlinien.

Du analysierst Preislisten, Kataloge, Lieferantenübersichten, Rechnungen und Fotos und extrahierst strukturierte Produktdaten.

## Für jedes Produkt extrahieren:

1. **name**: Vollständiger Produktname MIT Hersteller (z.B. "Caparol CapaGrund LF", "Knauf Uniflott")
2. **kategorie**:
   - WANDFARBE: Dispersionsfarbe, Innenfarbe, Latexfarbe, Silikatfarbe
   - GRUNDIERUNG: Tiefgrund, Aufbrennsperre, Haftgrund
   - SPACHTEL: Spachtelmasse, Gips, Füller, Glättspachtel
   - LACK: Acryllack, Kunstharzlack, Holzlasur, Buntlack
   - VERBRAUCH: Klebeband, Abdeckfolie, Acryl-Dichtstoff, Schleifpapier, Pinsel, Rollen
   - TAPETE: Raufaser, Vliestapete, Glasgewebe, Tapetenkleister
   - SONSTIGES: Alles andere
3. **typ**: "MATERIAL" (physisches Produkt) oder "LEISTUNG" (Arbeitsleistung pro m²/lfm/Stück)
4. **ekPreis**: Einkaufspreis netto. Bei Staffelpreisen den günstigsten. 0 wenn unbekannt
5. **vkPreis**: Verkaufspreis. Wenn nur EK: EK × 1.3 (30% Aufschlag). Wenn nur ein Preis: diesen nehmen
6. **einheit**: "Liter", "kg", "Stück", "Rolle", "m²", "lfm", "Eimer"
   - Gebindegrößen beachten! "12,5l Eimer" → einheit "Stück", Name enthält Gebinde
   - Oder: pro Liter rechnen wenn sinnvoll
7. **ergiebigkeit**: m² pro Einheit (z.B. 6.5 bei "6,5 m²/l"). null wenn unbekannt
   - Typische Werte: Wandfarbe 6-8 m²/l, Grundierung 8-10 m²/l, Lack 10-12 m²/l
8. **anstriche**: 1 oder 2 (Grundierung=1, Wandfarbe=2, Lack=2). null wenn unbekannt
9. **lieferant**: Herstellername (Caparol, Brillux, Knauf, Sto, etc.)
10. **artikelNr**: Artikelnummer/Bestellnummer falls vorhanden

Für LEISTUNGEN (typ="LEISTUNG"):
11. **leistungsKat**: STREICHEN, VORBEREITUNG, LACKIEREN, FASSADE, BODEN, TAPEZIEREN, TROCKENBAU, SONSTIGES
12. **preisProEinheit**: €/m², €/lfm etc.

## Regeln:
- Extrahiere ALLE erkennbaren Produkte — lieber zu viele als zu wenige
- Preise als Dezimalzahlen mit Punkt: 12.50 (nicht "12,50 €")
- Deutsche Preisformate erkennen: "12,50" → 12.50, "1.250,00" → 1250.00
- Gebindegrößen erkennen: "10l" = 10 Liter, "15kg" = 15 kg, "25m" = 25 lfm
- Bei Fotos/Scans: auch unscharfe oder teilweise lesbare Texte bestmöglich interpretieren
- zusammenfassung: Kurze Zusammenfassung was das Dokument enthält (1-2 Sätze)`;

const RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "catalog_extraction",
    strict: true,
    schema: {
      type: "object",
      properties: {
        produkte: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              typ: { type: "string", enum: ["MATERIAL", "LEISTUNG"] },
              kategorie: {
                type: "string",
                enum: [
                  "WANDFARBE",
                  "GRUNDIERUNG",
                  "SPACHTEL",
                  "LACK",
                  "VERBRAUCH",
                  "TAPETE",
                  "SONSTIGES",
                ],
              },
              leistungsKat: {
                type: ["string", "null"],
                enum: [
                  "STREICHEN",
                  "VORBEREITUNG",
                  "LACKIEREN",
                  "FASSADE",
                  "BODEN",
                  "TAPEZIEREN",
                  "TROCKENBAU",
                  "SONSTIGES",
                  null,
                ],
              },
              ekPreis: { type: "number" },
              vkPreis: { type: "number" },
              preisProEinheit: { type: ["number", "null"] },
              einheit: { type: "string" },
              ergiebigkeit: { type: ["number", "null"] },
              anstriche: { type: ["number", "null"] },
              lieferant: { type: ["string", "null"] },
              artikelNr: { type: ["string", "null"] },
            },
            required: [
              "name",
              "typ",
              "kategorie",
              "leistungsKat",
              "ekPreis",
              "vkPreis",
              "preisProEinheit",
              "einheit",
              "ergiebigkeit",
              "anstriche",
              "lieferant",
              "artikelNr",
            ],
            additionalProperties: false,
          },
        },
        zusammenfassung: { type: "string" },
      },
      required: ["produkte", "zusammenfassung"],
      additionalProperties: false,
    },
  },
};

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Kein OpenAI API Key konfiguriert" },
        { status: 500 }
      );
    }
    const openai = getOpenAI();

    // Detect branche from user's firma
    let branche = "MALER";
    try {
      const user = await requireUser();
      const firma = await prisma.firma.findUnique({
        where: { id: user.firmaId },
        select: { branche: true },
      });
      branche = firma?.branche ?? "MALER";
    } catch {
      // Fallback to MALER if auth fails
    }

    const isShop = branche === "SHOP";
    const isFewo = branche === "FEWO";
    const systemPrompt = isFewo ? FEWO_CATALOG_PROMPT : isShop ? SHOP_CATALOG_PROMPT : SYSTEM_PROMPT;
    const responseFormat = isFewo ? FEWO_CATALOG_RESPONSE_FORMAT : isShop ? SHOP_CATALOG_RESPONSE_FORMAT : RESPONSE_FORMAT;
    const userPromptPrefix = isFewo
      ? "Extrahiere alle Unterkünfte und Extras aus diesem Dokument"
      : isShop
        ? "Extrahiere alle Produkte aus diesem Dokument"
        : "Extrahiere alle Produkte und Leistungen aus diesem Dokument";

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const textInput = formData.get("text") as string | null;

    let extractedText = textInput || "";

    // File → send to GPT-4o for extraction
    if (file) {
      if (file.type === "application/pdf") {
        // PDF: extract text server-side, then send to AI
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const pdfParse = require("pdf-parse/lib/pdf-parse.js");
          const buffer = Buffer.from(await file.arrayBuffer());
          const pdfData = await pdfParse(buffer);
          extractedText = pdfData.text || "";
        } catch (e) {
          console.error("pdf-parse failed:", e);
          extractedText = "";
        }

        if (!extractedText.trim()) {
          return NextResponse.json(
            { error: "Diese PDF scheint eingescannt zu sein und enthält keinen maschinenlesbaren Text. Bitte laden Sie das Dokument als Foto/Screenshot hoch — die AI kann Bilder direkt analysieren." },
            { status: 400 }
          );
        }
      } else if (file.type.startsWith("image/")) {
        // Images: send to GPT-4o Vision
        const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
        const dataUrl = `data:${file.type};base64,${base64}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: `${userPromptPrefix}/Bild:` },
                { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
              ],
            },
          ],
          response_format: responseFormat,
          temperature: 0.1,
          max_tokens: 8000,
        });

        const content = completion.choices[0]?.message?.content;
        if (!content)
          return NextResponse.json({ error: "Keine Antwort vom AI" }, { status: 500 });
        return NextResponse.json(JSON.parse(content));
      } else {
        // Textdatei
        extractedText = await file.text();
      }
    }

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: "Kein Text zum Analysieren" },
        { status: 400 }
      );
    }

    // Chunking for long texts (>10000 chars)
    if (extractedText.length > 10000) {
      const chunks = splitIntoChunks(extractedText, 8000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allProdukte: any[] = [];
      let zusammenfassung = "";

      for (const chunk of chunks) {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `${userPromptPrefix}abschnitt:\n\n${chunk}`,
            },
          ],
          response_format: responseFormat,
          temperature: 0.1,
          max_tokens: 8000,
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.produkte)) {
            allProdukte.push(...parsed.produkte);
          }
          if (parsed.zusammenfassung && !zusammenfassung) {
            zusammenfassung = parsed.zusammenfassung;
          }
        }
      }

      // Deduplicate by name
      const seen = new Set<string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uniqueProdukte = allProdukte.filter((p: any) => {
        const key = p.name?.toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return NextResponse.json({
        produkte: uniqueProdukte,
        zusammenfassung: zusammenfassung || `${uniqueProdukte.length} Produkte aus ${chunks.length} Textabschnitten extrahiert.`,
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${userPromptPrefix}:\n\n${extractedText}`,
        },
      ],
      response_format: responseFormat,
      temperature: 0.1,
      max_tokens: 8000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "Keine Antwort vom AI" },
        { status: 500 }
      );
    }

    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    console.error("Katalog-Extraktion Fehler:", error);
    const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json(
      { error: `Fehler bei der Analyse: ${msg}` },
      { status: 500 }
    );
  }
}

// Split text into chunks at line breaks, each ~maxChars
function splitIntoChunks(text: string, maxChars: number): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    if (current.length + line.length + 1 > maxChars && current.length > 0) {
      chunks.push(current);
      current = line;
    } else {
      current += (current ? "\n" : "") + line;
    }
  }
  if (current.trim()) chunks.push(current);

  return chunks;
}
