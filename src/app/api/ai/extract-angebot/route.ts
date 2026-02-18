import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Du bist ein Experte für die Analyse von Angeboten und Rechnungen aus dem Malerhandwerk. Du erhältst ein hochgeladenes Dokument (PDF oder Foto) eines alten Angebots oder einer Rechnung und extrahierst ALLE relevanten Daten.

## Extrahiere:

### 1. Kundendaten
- name: Name des Kunden/Empfängers
- strasse: Straße + Hausnummer
- plz: PLZ
- ort: Ort
- email: E-Mail (falls vorhanden)
- telefon: Telefon (falls vorhanden)

### 2. Angebots-Metadaten
- nummer: Angebots-/Rechnungsnummer (z.B. "ANG-001", "RE-2024-042")
- datum: Datum als ISO-String (YYYY-MM-DD)
- typ: "ANGEBOT" oder "RECHNUNG"

### 3. Positionen (Array)
Für JEDE einzelne Position im Dokument:
- posNr: Positionsnummer (1, 2, 3...)
- typ: "LEISTUNG", "MATERIAL", "ZUSCHLAG", "RABATT" oder "ANFAHRT"
- bezeichnung: Vollständige Positionsbezeichnung
- menge: Menge als Zahl
- einheit: Einheit (m², lfm, Stück, pauschal, Liter, kg, Rolle...)
- einzelpreis: Einzelpreis als Dezimalzahl
- gesamtpreis: Gesamtpreis als Dezimalzahl
- raumName: Raumname wenn erkennbar (z.B. "Wohnzimmer", "Flur"), sonst null

### 4. Erkannte Materialien (Array)
Materialien die im Katalog angelegt werden sollten:
- name: Materialname (z.B. "Caparol CapaDur Weiß")
- kategorie: WANDFARBE, GRUNDIERUNG, SPACHTEL, LACK, VERBRAUCH, TAPETE oder SONSTIGES
- vkPreis: VK-Preis aus dem Dokument
- einheit: Liter, kg, Stück, Rolle etc.
- ergiebigkeit: m² pro Einheit (null wenn unbekannt)
- lieferant: Hersteller (null wenn unbekannt)

### 5. Erkannte Leistungen (Array)
Leistungen die im Katalog angelegt werden sollten:
- name: Leistungsbezeichnung (z.B. "Wände streichen")
- kategorie: STREICHEN, VORBEREITUNG, LACKIEREN, FASSADE, BODEN, TAPEZIEREN, TROCKENBAU oder SONSTIGES
- preisProEinheit: Preis pro Einheit
- einheit: m², lfm, Stück, pauschal

### 6. Summen
- materialNetto: Summe aller Material-Positionen
- arbeitsNetto: Summe aller Leistungs-Positionen
- anfahrt: Anfahrtspauschale (0 wenn nicht vorhanden)
- zuschlagNetto: Summe Zuschläge (0 wenn keine)
- rabattNetto: Summe Rabatte als positiver Wert (0 wenn keine)
- netto: Nettobetrag
- mwstSatz: MwSt-Satz (19 wenn nicht erkennbar)
- mwstBetrag: MwSt-Betrag
- brutto: Bruttobetrag

## Regeln:
- Preise als Dezimalzahlen mit Punkt (12.50 nicht "12,50 €")
- Deutsche Preisformate korrekt parsen: "1.250,00" = 1250.00
- Leere Strings "" für fehlende Textfelder, null für fehlende Zahlen
- Bei schlecht lesbaren Dokumenten: bestmöglich interpretieren
- Wenn Positionen nicht klar LEISTUNG oder MATERIAL sind: LEISTUNG als Default
- Erkenne auch Pauschal-Positionen und Zuschläge/Rabatte
- zusammenfassung: 1-2 Sätze was das Dokument enthält`;

const RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "angebot_extraction",
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
        meta: {
          type: "object",
          properties: {
            nummer: { type: "string" },
            datum: { type: "string" },
            typ: { type: "string", enum: ["ANGEBOT", "RECHNUNG"] },
          },
          required: ["nummer", "datum", "typ"],
          additionalProperties: false,
        },
        positionen: {
          type: "array",
          items: {
            type: "object",
            properties: {
              posNr: { type: "number" },
              typ: { type: "string", enum: ["LEISTUNG", "MATERIAL", "ZUSCHLAG", "RABATT", "ANFAHRT"] },
              bezeichnung: { type: "string" },
              menge: { type: "number" },
              einheit: { type: "string" },
              einzelpreis: { type: "number" },
              gesamtpreis: { type: "number" },
              raumName: { type: ["string", "null"] },
            },
            required: ["posNr", "typ", "bezeichnung", "menge", "einheit", "einzelpreis", "gesamtpreis", "raumName"],
            additionalProperties: false,
          },
        },
        materialien: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              kategorie: { type: "string", enum: ["WANDFARBE", "GRUNDIERUNG", "SPACHTEL", "LACK", "VERBRAUCH", "TAPETE", "SONSTIGES"] },
              vkPreis: { type: "number" },
              einheit: { type: "string" },
              ergiebigkeit: { type: ["number", "null"] },
              lieferant: { type: ["string", "null"] },
            },
            required: ["name", "kategorie", "vkPreis", "einheit", "ergiebigkeit", "lieferant"],
            additionalProperties: false,
          },
        },
        leistungen: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              kategorie: { type: "string", enum: ["STREICHEN", "VORBEREITUNG", "LACKIEREN", "FASSADE", "BODEN", "TAPEZIEREN", "TROCKENBAU", "SONSTIGES"] },
              preisProEinheit: { type: "number" },
              einheit: { type: "string" },
            },
            required: ["name", "kategorie", "preisProEinheit", "einheit"],
            additionalProperties: false,
          },
        },
        summen: {
          type: "object",
          properties: {
            materialNetto: { type: "number" },
            arbeitsNetto: { type: "number" },
            anfahrt: { type: "number" },
            zuschlagNetto: { type: "number" },
            rabattNetto: { type: "number" },
            netto: { type: "number" },
            mwstSatz: { type: "number" },
            mwstBetrag: { type: "number" },
            brutto: { type: "number" },
          },
          required: ["materialNetto", "arbeitsNetto", "anfahrt", "zuschlagNetto", "rabattNetto", "netto", "mwstSatz", "mwstBetrag", "brutto"],
          additionalProperties: false,
        },
        zusammenfassung: { type: "string" },
      },
      required: ["kunde", "meta", "positionen", "materialien", "leistungen", "summen", "zusammenfassung"],
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });
    }

    // Build messages based on file type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userContent: any[] = [
      {
        type: "text",
        text: "Analysiere dieses alte Angebot / diese Rechnung und extrahiere alle Daten. Erfasse JEDE Position, jeden Preis, alle Kundendaten.",
      },
    ];

    if (file.type === "application/pdf") {
      // Send PDF directly to GPT-4o (no pdf-parse needed)
      const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      userContent.push({
        type: "file",
        file: {
          filename: file.name,
          file_data: `data:application/pdf;base64,${base64}`,
        },
      });
    } else if (file.type.startsWith("image/")) {
      const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      userContent.push({
        type: "image_url",
        image_url: {
          url: `data:${file.type};base64,${base64}`,
          detail: "high",
        },
      });
    } else {
      // Text file
      const text = await file.text();
      userContent.push({
        type: "text",
        text: `\n\nInhalt des Dokuments:\n\n${text.substring(0, 15000)}`,
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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

    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    console.error("Angebot-Extraktion Fehler:", error);
    return NextResponse.json(
      { error: `Fehler bei der Analyse: ${error instanceof Error ? error.message : "Unbekannt"}` },
      { status: 500 }
    );
  }
}
