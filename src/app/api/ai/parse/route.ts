import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const maxDuration = 60;

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

### E-Mail-Footer / Signatur — SEHR WICHTIG
E-Mails haben oft am Ende eine Signatur/Footer mit Absender-Kontaktdaten. Durchsuche den GESAMTEN Text — insbesondere die letzten Zeilen — nach:
- Name (oft nach "Mit freundlichen Grüßen", "Viele Grüße", "LG", "MfG", "Beste Grüße" etc.)
- Adresse (Straße + Hausnummer, PLZ + Ort) — oft auf separaten Zeilen untereinander
- Telefonnummer, E-Mail-Adresse
- Wenn im Fließtext KEINE Kundendaten stehen, aber im Footer/Signatur-Block welche erkennbar sind, verwende DIESE

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
        erkannterText: { type: "string", description: "Wörtliche Transkription des Originaltextes aus dem Bild/der Nachricht. Bei Screenshots: den sichtbaren Text 1:1 abtippen. Bei reinem Text: den Originaltext zurückgeben." },
      required: ["kunde", "produkte", "confidence", "erkannterText"],
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
// FEWO SYSTEM PROMPT + RESPONSE FORMAT
// ═══════════════════════════════════════════

function getFewoSystemPrompt() {
  const currentYear = new Date().getFullYear();
  return `Du bist ein Assistent für einen deutschen Ferienwohnungs-/Unterkunftsvermieter. Du analysierst Gästeanfragen (E-Mails, WhatsApp, Formulare) und extrahierst strukturierte Daten für die Angebotserstellung.

Das aktuelle Jahr ist ${currentYear}.

## Deine Aufgabe

Extrahiere folgende Informationen:

### 1. Kunde (Gast)
- name: Vollständiger Name
- strasse: Straße + Hausnummer
- plz: 5-stellige Postleitzahl
- ort: Ortsname
- email: E-Mail-Adresse
- telefon: Telefonnummer

### 2. Aufenthalt
- anreise: Anreise-Datum im Format "YYYY-MM-DD"
- abreise: Abreise-Datum im Format "YYYY-MM-DD"
- personen: Anzahl Personen/Gäste (Standard: 2)
- hund: true wenn Hund/Haustier erwähnt wird
- wuensche: Array von Sonderwünschen als Strings (z.B. "Frühstück", "Parkplatz", "Babybett", "Endreinigung")

### 3. Confidence (0-100)
- kunde: Wie vollständig sind die Kundendaten?
- raeume: Wie genau sind die Aufenthaltsdaten? (verwende "raeume" als Feld)
- optionen: Wie klar sind die Wünsche insgesamt?

## Erkennungsregeln

**Datumsformate:**
- Wenn KEIN Jahr angegeben ist, IMMER ${currentYear} verwenden
- "15. Juli" oder "15.7." → ${currentYear}-07-15
- "15.-22. Juli" → anreise: ${currentYear}-07-15, abreise: ${currentYear}-07-22
- "vom 15. bis 22. Juli" → anreise/abreise mit Jahr ${currentYear}
- "eine Woche ab 15. Juli" → anreise: ${currentYear}-07-15, abreise: ${currentYear}-07-22
- "KW 28" → Montag bis Sonntag der Kalenderwoche im Jahr ${currentYear}

**Personenangaben:**
- "2 Erwachsene und 2 Kinder" → personen: 4
- "zu zweit" → personen: 2
- "Familie" ohne Zahl → personen: 4
- "alleine" → personen: 1

**Hund/Haustier:**
- "mit Hund", "Haustier", "Vierbeiner" → hund: true

**Wünsche:**
- "Frühstück", "Halbpension" → in wuensche
- "Brötchenservice" → in wuensche
- "Parkplatz", "Garage" → in wuensche
- "Babybett", "Kinderbett" → in wuensche
- "Endreinigung" → in wuensche
- "Bettwäsche", "Handtücher" → in wuensche

### E-Mail-Footer / Signatur — SEHR WICHTIG
E-Mails haben oft am Ende eine Signatur/Footer mit Absender-Kontaktdaten. Durchsuche den GESAMTEN Text — insbesondere die letzten Zeilen — nach:
- Name (oft nach "Mit freundlichen Grüßen", "Viele Grüße", "LG", "MfG", "Beste Grüße" etc.)
- Adresse (Straße + Hausnummer, PLZ + Ort) — oft auf separaten Zeilen untereinander
- Telefonnummer, E-Mail-Adresse
- Wenn im Fließtext KEINE Kundendaten stehen, aber im Footer/Signatur-Block welche erkennbar sind, verwende DIESE

WICHTIG:
- Dezimalpunkte verwenden
- Leere Strings "" für fehlende Felder, NICHT null
- Confidence IMMER als ganze Zahl 0-100 angeben
- Daten im Format YYYY-MM-DD (z.B. "${currentYear}-07-15")
- Wenn kein Jahr genannt wird, IMMER das aktuelle Jahr ${currentYear} nehmen`;
}

const FEWO_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "fewo_anfrage_parsing",
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
        anreise: { type: "string" },
        abreise: { type: "string" },
        personen: { type: "number" },
        hund: { type: "boolean" },
        wuensche: {
          type: "array",
          items: { type: "string" },
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
        erkannterText: { type: "string", description: "Wörtliche Transkription des Originaltextes aus dem Bild/der Nachricht. Bei Screenshots: den sichtbaren Text 1:1 abtippen. Bei reinem Text: den Originaltext zurückgeben." },
      required: ["kunde", "anreise", "abreise", "personen", "hund", "wuensche", "confidence", "erkannterText"],
      additionalProperties: false,
    },
  },
};

function buildFewoSystemPrompt(katalogKontext: string): string {
  return getFewoSystemPrompt() + (katalogKontext ? `\n\n${katalogKontext}` : "");
}

async function loadFewoKatalogKontext(firmaId: string): Promise<string> {
  const [unterkuenfte, extras] = await Promise.all([
    prisma.unterkunft.findMany({
      where: { firmaId, aktiv: true },
      select: { name: true, kapazitaet: true, preisProNacht: true },
    }),
    prisma.fewoExtra.findMany({
      where: { firmaId, aktiv: true },
      select: { name: true, preis: true, einheit: true },
    }),
  ]);

  if (unterkuenfte.length === 0 && extras.length === 0) return "";

  let kontext = "## Verfügbare Unterkünfte & Extras\n";
  if (unterkuenfte.length > 0) {
    kontext += "Unterkünfte: " + unterkuenfte.map((u) => `${u.name} (max. ${u.kapazitaet} Pers., ${u.preisProNacht}€/Nacht)`).join(", ") + "\n";
  }
  if (extras.length > 0) {
    kontext += "Extras: " + extras.map((e) => `${e.name} (${e.preis}€ ${e.einheit})`).join(", ") + "\n";
  }
  return kontext;
}

function parseFewoAnfrageRegex(rawText: string) {
  const text = rawText;
  const kunde = parseKunde(text);

  // Datum-Parsing
  let anreise = "";
  let abreise = "";
  const datumMatch = text.match(/(\d{1,2})\.?\s*[-–bis]+\s*(\d{1,2})\.?\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|[\d.]+)/i);
  if (datumMatch) {
    const monatMap: Record<string, string> = {
      januar: "01", februar: "02", "märz": "03", april: "04", mai: "05", juni: "06",
      juli: "07", august: "08", september: "09", oktober: "10", november: "11", dezember: "12",
    };
    const monat = monatMap[datumMatch[3].toLowerCase()] || datumMatch[3];
    const year = new Date().getFullYear();
    anreise = `${year}-${monat.padStart(2, "0")}-${datumMatch[1].padStart(2, "0")}`;
    abreise = `${year}-${monat.padStart(2, "0")}-${datumMatch[2].padStart(2, "0")}`;
  }

  // Personen
  let personen = 2;
  const persMatch = text.match(/(\d+)\s*(?:Person|Erwachsen|Gäst|Personen)/i);
  if (persMatch) personen = parseInt(persMatch[1]);

  // Hund
  const hund = /hund|haustier|vierbeiner/i.test(text);

  // Wünsche
  const wuensche: string[] = [];
  if (/frühstück|fruehstueck/i.test(text)) wuensche.push("Frühstück");
  if (/parkplatz|garage/i.test(text)) wuensche.push("Parkplatz");
  if (/babybett|kinderbett/i.test(text)) wuensche.push("Babybett");
  if (/endreinigung/i.test(text)) wuensche.push("Endreinigung");
  if (/brötchen|broetchen/i.test(text)) wuensche.push("Brötchenservice");
  if (/handtücher|handtuecher/i.test(text)) wuensche.push("Handtücher");
  if (/bettwäsche|bettwaesche/i.test(text)) wuensche.push("Bettwäsche");

  return {
    kunde,
    anreise,
    abreise,
    personen,
    hund,
    wuensche,
    confidence: {
      kunde: kunde.name ? 50 : 15,
      raeume: anreise ? 60 : 10,
      optionen: 40,
    },
  };
}

// ═══════════════════════════════════════════
// FAHRRAD SYSTEM PROMPT + RESPONSE FORMAT
// ═══════════════════════════════════════════

function getFahrradSystemPrompt() {
  const currentYear = new Date().getFullYear();
  return `Du bist ein erfahrener Assistent für einen deutschen Fahrradverleih auf einer Urlaubsinsel. Du analysierst Kundenanfragen (E-Mails, WhatsApp, Formulare, Sprachnotizen, Fotos) und extrahierst ALLE strukturierten Daten für die Angebotserstellung. Lies den Text SEHR GENAU und verpasse keine Details.

Das aktuelle Jahr ist ${currentYear}.

## Deine Aufgabe

Extrahiere ALLE folgenden Informationen aus dem Text:

### 1. Kunde
- name: Vollständiger Name (auch mehrere Personen: "Anja Pohl-Lange, Andreas Lange")
- strasse: Straße + Hausnummer (z.B. "Lippestr. 42", "Am Markt 5")
- plz: 5-stellige Postleitzahl
- ort: Ortsname
- email: E-Mail-Adresse
- telefon: Telefonnummer (auch mit Länderkennzahl)

### 2. Mietdaten
- mietbeginn: Startdatum im Format "YYYY-MM-DD"
- mietende: Enddatum im Format "YYYY-MM-DD"
- personen: Gesamtanzahl aller Personen inkl. Kinder (Standard: 2)

### 3. Fahrräder (Array)
Für JEDEN gewünschten Fahrradtyp:
- name: Fahrradbezeichnung — verwende bevorzugt exakte Namen aus dem Katalog (siehe unten)
- menge: Gewünschte Anzahl (Standard: 1)

### 4. Wünsche (Array von Strings)
Alles was nicht ein Fahrrad selbst ist: "Helm", "Kindersitz", "Fahrradkorb", "Schloss", "Anhänger", "GPS", "Gepäcktasche", etc.

### 5. Confidence (0-100)
- kunde: Wie vollständig sind die Kundendaten?
- raeume: Wie genau sind die Mietdaten und Fahrradwünsche? (verwende "raeume" als Feld)
- optionen: Wie klar sind die Wünsche insgesamt?

## Erkennungsregeln

### Datumsformate
- Wenn KEIN Jahr angegeben ist, IMMER ${currentYear} verwenden
- "15. Juli" oder "15.7." oder "15.07." → ${currentYear}-07-15
- "15.-22. Juli" oder "15. bis 22. Juli" → mietbeginn: ${currentYear}-07-15, mietende: ${currentYear}-07-22
- "vom 15. bis 22. Juli" → mietbeginn/mietende
- "eine Woche ab 15. Juli" → mietbeginn: ${currentYear}-07-15, mietende: ${currentYear}-07-22
- "5 Tage ab 15. Juli" → mietbeginn: ${currentYear}-07-15, mietende: ${currentYear}-07-20
- "für 3 Tage" → nur Tagesanzahl, Datum unbekannt → mietbeginn: "", mietende: ""
- "nächste Woche Montag bis Freitag" → berechne die konkreten Daten
- "Sommerferien", "Osterferien" → schätze realistische Daten
- "26.07.-02.08." → mietbeginn: ${currentYear}-07-26, mietende: ${currentYear}-08-02
- "26.7-2.8" → mietbeginn: ${currentYear}-07-26, mietende: ${currentYear}-08-02

### Fahrrad-Typen & Synonyme
WICHTIG: Wenn ein Fahrrad-Katalog bereitgestellt wird, verwende IMMER die exakten Katalognamen. Matche Synonyme auf den nächstpassenden Katalog-Eintrag.

Synonyme → Standardname (falls kein Katalog):
- "E-Bike", "Ebike", "E Bike", "eBike", "Elektrorad", "Elektrofahrrad", "Pedelec", "E-Rad", "elektrisches Rad" → "E-Bike"
- "E-Bike Damen", "Damen E-Bike", "Damen-Ebike" → "E-Bike Damen" (oder Katalog-Match)
- "E-Bike Herren", "Herren E-Bike", "Herren-Ebike" → "E-Bike Herren" (oder Katalog-Match)
- "Citybike", "City-Bike", "Stadtrad", "Stadtfahrrad", "Holland-Rad", "Hollandrad" → "Citybike"
- "Kinderrad", "Kinderfahrrad", "Kinder-Fahrrad", "Rad für Kind", "Fahrrad für Kinder", "kleines Rad" → "Kinderrad"
- "Jugendrad", "Jugendfahrrad", "Jugend-Fahrrad", "Teenagerrad" → "Jugendrad"
- "Mountainbike", "MTB", "Mountain-Bike", "Geländerad" → "Mountainbike"
- "Trekkingrad", "Trekkingbike", "Trekking-Rad", "Tourenrad" → "Trekkingrad"
- "Tandem", "Zweisitzer", "Doppelrad" → "Tandem"
- "Lastenrad", "Cargo-Bike", "Cargobike", "Transportrad", "Lastenfahrrad" → "Lastenrad"
- "Liegerad", "Liegefahrrad", "Recumbent" → "Liegerad"
- "Rennrad", "Racebike" → "Rennrad"
- "Klapprad", "Faltrad", "Klappfahrrad" → "Klapprad"
- "Fahrrad", "Rad", "Bike", "Räder", "Drahtesel" ohne Spezifizierung → "Fahrrad"
- "Damenrad", "Damenfahrrad", "Damen-Rad" → "Damenrad"
- "Herrenrad", "Herrenfahrrad", "Herren-Rad" → "Herrenrad"

### Implizite Fahrrad-Ableitung aus Personenbeschreibung
SEHR WICHTIG — Leite Fahrradtypen aus der Personenbeschreibung ab:
- "2 Erwachsene" → 2× Fahrrad (oder E-Bike, je nach Kontext)
- "2 Kinder (8 und 12 Jahre)" → 2× Kinderrad (oder 1× Kinderrad + 1× Jugendrad bei Kindern >10)
- "für die ganze Familie" → schätze basierend auf Personenanzahl
- "mein Mann und ich" → 2× Fahrrad/E-Bike
- "wir sind zu viert" → 4× Fahrrad (wenn keine genauere Angabe)
- "2 Erwachsene und 1 Kind" → 2× Fahrrad + 1× Kinderrad
- Wenn der Kunde "Fahrräder" im Plural sagt aber keine Menge nennt, leite die Menge aus der Personenanzahl ab

### Mengenangaben
- "2x E-Bikes" oder "2 E-Bikes" oder "zwei E-Bikes" → menge: 2
- "ein E-Bike" → menge: 1
- "E-Bikes" (Plural ohne Zahl) → leite aus Personenkontext ab, Minimum 2
- "2 E-Bikes + 1 Kinderrad" → [{name: "E-Bike", menge: 2}, {name: "Kinderrad", menge: 1}]
- "Fahrräder für 4 Personen" → 4× Fahrrad
- "je ein Rad" bei 2 Personen → 2× Fahrrad
- Auflistungen mit Spiegelstrichen (- oder •) beachten
- "2× E-Bike\n1× Kinderrad\n1× Jugendrad" → drei separate Einträge

### Extras/Wünsche
SEHR WICHTIG: Wenn der Kunde Extras, Zubehör oder Zusatzleistungen erwähnt, erfasse diese IMMER in "wuensche". Verwende bevorzugt die exakten Namen aus dem Extras-Katalog (siehe unten).
- "Helm", "Helme", "mit Helm", "Fahrradhelm" → "Helm"
- "Schloss", "Schlösser", "Fahrradschloss", "Zahlenschloss" → "Schloss"
- "Korb", "Fahrradkorb", "Körbe", "Lenkerkorb" → "Fahrradkorb"
- "Kindersitz", "Fahrradsitz für Kind" → "Kindersitz"
- "Anhänger", "Fahrradanhänger", "Kinderanhänger" → "Anhänger"
- "GPS", "Navigation", "Navi" → "GPS"
- "Gepäcktasche", "Satteltasche", "Packtasche" → "Gepäcktasche"
- "Regencape", "Regenponcho", "Regenschutz" → "Regenschutz"
- "Luftpumpe", "Pumpe" → "Luftpumpe"
- "Flickzeug", "Reparaturset" → "Flickzeug"
- "Klingel" → "Klingel"
- "Licht", "Beleuchtung", "Lampe" → "Licht"
- "Koffertransport", "Koffer", "Gepäcktransfer", "Gepäcktransport", "Koffer bringen", "Koffer holen", "Koffertransfer" → "Koffertransport"
- "Versicherung", "Diebstahlschutz", "Vollkasko" → "Versicherung"
- "Lieferung", "Zustellung", "bringen", "liefern" → "Lieferung"
- Alles was nach Zubehör, Zusatzleistung oder Service klingt → in wuensche
- Wenn der Extras-Katalog bereitgestellt wird, matche Kundenwünsche auf die exakten Katalog-Namen

### Kundenname-Erkennung
- "Familie Müller" → "Familie Müller"
- "Anja Pohl-Lange, Andreas Lange" → "Anja Pohl-Lange, Andreas Lange"
- "MfG Herr Schmidt" → "Herr Schmidt"
- Auch am Ende des Textes nach Grußformel suchen
- Doppelnamen mit Bindestrich beachten

### Telefonnummer-Erkennung
- "+49 151 41438558" → "+49 151 41438558"
- "0151 41438558" → "0151 41438558"
- "Tel.: 04932/12345" → "04932/12345"
- Alle gängigen deutschen Formate erkennen

### E-Mail-Footer / Signatur — HÖCHSTE PRIORITÄT FÜR KUNDENDATEN
Kundenanfragen kommen fast immer per E-Mail. Die Absenderinformationen (Name, Adresse, Telefon, E-Mail) stehen MEISTENS am ENDE des Textes in der E-Mail-Signatur/Footer. Du MUSST den gesamten Text bis zum letzten Zeichen lesen!

**Wo Kundendaten typischerweise stehen:**
1. Nach einer Grußformel: "Mit freundlichen Grüßen", "Viele Grüße", "LG", "MfG", "Beste Grüße", "Herzliche Grüße", "Gruß", "VG"
2. Am Ende des Textes als mehrzeiliger Block
3. Manchmal durch Leerzeilen, "---", oder "__" vom Haupttext getrennt

**Typische Footer-Formate die du ERKENNEN MUSST:**
Format A (klassisch):
  Mit freundlichen Grüßen
  Max Mustermann
  Musterstraße 12
  12345 Musterstadt
  Tel.: 0123/456789
  max@example.de

Format B (kompakt):
  Viele Grüße, Max Mustermann | Musterstr. 12, 12345 Musterstadt

Format C (mit Firma):
  Firma GmbH
  Max Mustermann
  Hauptstr. 5
  26548 Norderney

Format D (gesendet von):
  Gesendet von meinem iPhone
  Max Mustermann
  max@example.de

**REGELN:**
- Wenn im Fließtext (oben) KEINE Kundendaten stehen, aber im Footer welche erkennbar sind → verwende die Footer-Daten
- Wenn im Fließtext UND im Footer Daten stehen → bevorzuge Footer-Daten für Adresse/Telefon/E-Mail (diese sind normalerweise vollständiger und aktueller)
- Extrahiere den VOLLSTÄNDIGEN Namen (inkl. Doppelnamen mit Bindestrich, Vor- UND Nachname)
- Straße IMMER mit Hausnummer erfassen

WICHTIG:
- Dezimalpunkte verwenden (3.5 nicht 3,5)
- Leere Strings "" für fehlende Felder, NICHT null
- Confidence IMMER als ganze Zahl 0-100 angeben
- Daten im Format YYYY-MM-DD (z.B. "${currentYear}-07-15")
- Wenn kein Jahr genannt wird, IMMER das aktuelle Jahr ${currentYear} nehmen
- LIES DEN TEXT KOMPLETT BIS ZUM LETZTEN ZEICHEN — übersehe keine Fahrräder, keine Daten, keine Kundendaten, keine Extras
- Wenn ein Katalog bereitgestellt wird, matche Synonyme auf exakte Katalognamen`;
}

const FAHRRAD_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "fahrrad_anfrage_parsing",
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
        mietbeginn: { type: "string" },
        mietende: { type: "string" },
        personen: { type: "number" },
        fahrraeder: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              menge: { type: "number" },
            },
            required: ["name", "menge"],
            additionalProperties: false,
          },
        },
        wuensche: {
          type: "array",
          items: { type: "string" },
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
        erkannterText: { type: "string", description: "Wörtliche Transkription des Originaltextes aus dem Bild/der Nachricht. Bei Screenshots: den sichtbaren Text 1:1 abtippen. Bei reinem Text: den Originaltext zurückgeben." },
      required: ["kunde", "mietbeginn", "mietende", "personen", "fahrraeder", "wuensche", "confidence", "erkannterText"],
      additionalProperties: false,
    },
  },
};

function buildFahrradSystemPrompt(katalogKontext: string): string {
  return getFahrradSystemPrompt() + (katalogKontext ? `\n\n${katalogKontext}` : "");
}

// Synonym-Mapping für Katalog-Matching
const FAHRRAD_SYNONYME: Record<string, string[]> = {
  "e-bike": ["ebike", "e bike", "elektrorad", "elektrofahrrad", "pedelec", "e-rad", "elektrisches rad"],
  "citybike": ["city-bike", "stadtrad", "stadtfahrrad", "hollandrad", "holland-rad"],
  "kinderrad": ["kinderfahrrad", "kinder-fahrrad", "rad für kind", "fahrrad für kinder", "kleines rad"],
  "jugendrad": ["jugendfahrrad", "jugend-fahrrad", "teenagerrad"],
  "mountainbike": ["mtb", "mountain-bike", "geländerad"],
  "trekkingrad": ["trekkingbike", "trekking-rad", "tourenrad"],
  "tandem": ["zweisitzer", "doppelrad"],
  "lastenrad": ["cargo-bike", "cargobike", "transportrad", "lastenfahrrad"],
  "rennrad": ["racebike", "race-bike"],
  "klapprad": ["faltrad", "klappfahrrad"],
  "damenrad": ["damenfahrrad", "damen-rad", "damen fahrrad"],
  "herrenrad": ["herrenfahrrad", "herren-rad", "herren fahrrad"],
  "liegerad": ["liegefahrrad", "recumbent"],
};

function getSynonymeForBike(bikeName: string): string[] {
  const lower = bikeName.toLowerCase();
  const synonyme: string[] = [];
  for (const [key, values] of Object.entries(FAHRRAD_SYNONYME)) {
    if (lower.includes(key) || values.some((v) => lower.includes(v))) {
      synonyme.push(...values.filter((v) => !lower.includes(v)));
    }
  }
  // Damen/Herren-Varianten
  if (lower.includes("damen") && lower.includes("e-bike")) {
    synonyme.push("damen e-bike", "damen-ebike", "damen ebike", "e-bike für frauen");
  }
  if (lower.includes("herren") && lower.includes("e-bike")) {
    synonyme.push("herren e-bike", "herren-ebike", "herren ebike", "e-bike für männer");
  }
  return [...new Set(synonyme)];
}

async function loadFahrradKatalogKontext(firmaId: string): Promise<string> {
  const [fahrraeder, extras] = await Promise.all([
    prisma.fahrrad.findMany({
      where: { firmaId, aktiv: true },
      select: { name: true, kategorie: true },
    }),
    prisma.fahrradExtra.findMany({
      where: { firmaId, aktiv: true },
      select: { name: true, preis: true, einheit: true },
    }),
  ]);

  if (fahrraeder.length === 0 && extras.length === 0) return "";

  let kontext = "## Verfügbare Fahrräder & Extras\nVerwende IMMER die exakten Namen aus diesem Katalog. Matche auch Synonyme, Tippfehler und umgangssprachliche Bezeichnungen auf den passenden Katalog-Eintrag.\n\n";
  if (fahrraeder.length > 0) {
    kontext += "### Fahrräder im Katalog:\n";
    for (const f of fahrraeder) {
      const synonyme = getSynonymeForBike(f.name);
      kontext += `- **${f.name}** (Kategorie: ${f.kategorie})`;
      if (synonyme.length > 0) {
        kontext += ` — Synonyme/Varianten: ${synonyme.join(", ")}`;
      }
      kontext += "\n";
    }
    kontext += "\n";
  }
  if (extras.length > 0) {
    kontext += "### Extras:\n";
    kontext += extras.map((e) => `- ${e.name} (${e.preis}€ ${e.einheit})`).join("\n") + "\n";
  }
  return kontext;
}

function parseFahrradAnfrageRegex(rawText: string) {
  const text = rawText;
  const kunde = parseKunde(text);
  const year = new Date().getFullYear();

  const monatMap: Record<string, string> = {
    januar: "01", februar: "02", "märz": "03", april: "04", mai: "05", juni: "06",
    juli: "07", august: "08", september: "09", oktober: "10", november: "11", dezember: "12",
    jan: "01", feb: "02", mär: "03", mar: "03", apr: "04", jun: "06",
    jul: "07", aug: "08", sep: "09", okt: "10", nov: "11", dez: "12",
  };

  // Datum-Parsing — viele Formate
  let mietbeginn = "";
  let mietende = "";

  // Format: "26.07.-02.08." oder "26.07. - 02.08." oder "26.7-2.8" oder "26.7.-2.8."
  const ddmmMatch = text.match(/(\d{1,2})\.(\d{1,2})\.?\s*[-–bis]+\s*(\d{1,2})\.(\d{1,2})\.?/);
  if (ddmmMatch) {
    mietbeginn = `${year}-${ddmmMatch[2].padStart(2, "0")}-${ddmmMatch[1].padStart(2, "0")}`;
    mietende = `${year}-${ddmmMatch[4].padStart(2, "0")}-${ddmmMatch[3].padStart(2, "0")}`;
  }

  // Format: "15.-22. Juli" oder "15. bis 22. Juli" oder "15-22 Juli"
  if (!mietbeginn) {
    const monatNameMatch = text.match(/(\d{1,2})\.?\s*[-–]?\s*(?:bis\s+)?(\d{1,2})\.?\s+(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Jan|Feb|Mär|Mar|Apr|Jun|Jul|Aug|Sep|Okt|Nov|Dez)/i);
    if (monatNameMatch) {
      const monat = monatMap[monatNameMatch[3].toLowerCase()] || "01";
      mietbeginn = `${year}-${monat}-${monatNameMatch[1].padStart(2, "0")}`;
      mietende = `${year}-${monat}-${monatNameMatch[2].padStart(2, "0")}`;
    }
  }

  // Format: "vom 15. Juli bis 22. Juli" oder "15. Juli bis 22. August"
  if (!mietbeginn) {
    const vonBisMatch = text.match(/(\d{1,2})\.?\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s*(?:bis|[-–])\s*(\d{1,2})\.?\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)/i);
    if (vonBisMatch) {
      const m1 = monatMap[vonBisMatch[2].toLowerCase()] || "01";
      const m2 = monatMap[vonBisMatch[4].toLowerCase()] || "01";
      mietbeginn = `${year}-${m1}-${vonBisMatch[1].padStart(2, "0")}`;
      mietende = `${year}-${m2}-${vonBisMatch[3].padStart(2, "0")}`;
    }
  }

  // Format: "15. Juli" (einzelnes Datum, kein Ende)
  if (!mietbeginn) {
    const einzelMatch = text.match(/(\d{1,2})\.?\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)/i);
    if (einzelMatch) {
      const monat = monatMap[einzelMatch[2].toLowerCase()] || "01";
      mietbeginn = `${year}-${monat}-${einzelMatch[1].padStart(2, "0")}`;
    }
  }

  // Format: "eine Woche ab ..." oder "5 Tage ab ..."
  if (mietbeginn && !mietende) {
    const wocheMatch = text.match(/(?:eine?\s+)?woche/i);
    const tageMatch = text.match(/(\d+)\s*tage/i);
    if (wocheMatch) {
      const d = new Date(mietbeginn);
      d.setDate(d.getDate() + 7);
      mietende = d.toISOString().split("T")[0];
    } else if (tageMatch) {
      const d = new Date(mietbeginn);
      d.setDate(d.getDate() + parseInt(tageMatch[1]));
      mietende = d.toISOString().split("T")[0];
    }
  }

  // Personen — erweiterte Erkennung
  let personen = 0;
  const persPatterns = [
    /(\d+)\s*(?:Person|Personen|Erwachsene?|Gäste?|Leute)/i,
    /zu\s+(?:zweit|dritt|viert|fünft|sechst)/i,
    /(?:wir\s+sind\s+)?(\d+)\s+(?:erwachsene?|personen)/i,
  ];
  for (const pp of persPatterns) {
    const m = text.match(pp);
    if (m) {
      if (m[1]) {
        personen += parseInt(m[1]);
      } else if (/zweit/i.test(m[0])) personen = 2;
      else if (/dritt/i.test(m[0])) personen = 3;
      else if (/viert/i.test(m[0])) personen = 4;
      else if (/fünft/i.test(m[0])) personen = 5;
      else if (/sechst/i.test(m[0])) personen = 6;
      break;
    }
  }
  // Kinder zählen
  const kinderMatch = text.match(/(\d+)\s*(?:Kinder?|Kids)/i);
  if (kinderMatch) personen += parseInt(kinderMatch[1]);
  if (personen === 0) personen = 2; // Default

  // Fahrräder — erweiterte Erkennung mit Synonymen
  const fahrraeder: Array<{ name: string; menge: number }> = [];
  const bikePatterns: Array<{ pattern: RegExp; name: string }> = [
    // E-Bike Varianten (Damen/Herren zuerst, damit sie nicht als generisches E-Bike gematcht werden)
    { pattern: /(\d+)\s*[x×]?\s*(?:damen[- ]?e[- ]?bikes?|e[- ]?bikes?\s+(?:für\s+)?damen)/gi, name: "E-Bike Damen" },
    { pattern: /(\d+)\s*[x×]?\s*(?:herren[- ]?e[- ]?bikes?|e[- ]?bikes?\s+(?:für\s+)?herren)/gi, name: "E-Bike Herren" },
    { pattern: /(\d+)\s*[x×]?\s*(?:E-Bikes?|Ebikes?|E Bikes?|Elektroräder?|Elektrofahrräder?|Pedelecs?)/gi, name: "E-Bike" },
    { pattern: /(\d+)\s*[x×]?\s*(?:Kinderräder?|Kinderfahrräder?|Kinder-Fahrräder?)/gi, name: "Kinderrad" },
    { pattern: /(\d+)\s*[x×]?\s*(?:Jugendräder?|Jugendfahrräder?|Teenager-?Räder?)/gi, name: "Jugendrad" },
    { pattern: /(\d+)\s*[x×]?\s*(?:Citybikes?|City-Bikes?|Stadträder?|Hollandräder?)/gi, name: "Citybike" },
    { pattern: /(\d+)\s*[x×]?\s*(?:Mountainbikes?|MTBs?|Mountain-Bikes?)/gi, name: "Mountainbike" },
    { pattern: /(\d+)\s*[x×]?\s*(?:Trekkingräder?|Trekkingbikes?|Tourenräder?)/gi, name: "Trekkingrad" },
    { pattern: /(\d+)\s*[x×]?\s*(?:Tandems?)/gi, name: "Tandem" },
    { pattern: /(\d+)\s*[x×]?\s*(?:Lastenräder?|Cargo-?Bikes?|Transporträder?)/gi, name: "Lastenrad" },
    { pattern: /(\d+)\s*[x×]?\s*(?:Rennräder?|Racebikes?)/gi, name: "Rennrad" },
    { pattern: /(\d+)\s*[x×]?\s*(?:Klappräder?|Falträder?)/gi, name: "Klapprad" },
    { pattern: /(\d+)\s*[x×]?\s*(?:Damenräder?|Damenfahrräder?)/gi, name: "Damenrad" },
    { pattern: /(\d+)\s*[x×]?\s*(?:Herrenräder?|Herrenfahrräder?)/gi, name: "Herrenrad" },
    // Generisch — zuletzt
    { pattern: /(\d+)\s*[x×]?\s*(?:Fahrräder?|Räder?|Bikes?)/gi, name: "Fahrrad" },
  ];

  // Auch ohne Zahl davor: "E-Bike", "ein Kinderrad" etc.
  const bikePatternsSingle: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /(?:ein(?:en?|em)?\s+)?(?:damen[- ]?e[- ]?bike|e[- ]?bike\s+(?:für\s+)?damen)/gi, name: "E-Bike Damen" },
    { pattern: /(?:ein(?:en?|em)?\s+)?(?:herren[- ]?e[- ]?bike|e[- ]?bike\s+(?:für\s+)?herren)/gi, name: "E-Bike Herren" },
    { pattern: /(?:ein(?:en?|em)?\s+)?(?:E-Bike|Ebike|Pedelec|Elektrorad)\b/gi, name: "E-Bike" },
    { pattern: /(?:ein(?:en?|em)?\s+)?(?:Kinderrad|Kinderfahrrad)\b/gi, name: "Kinderrad" },
    { pattern: /(?:ein(?:en?|em)?\s+)?(?:Jugendrad|Jugendfahrrad)\b/gi, name: "Jugendrad" },
    { pattern: /(?:ein(?:en?|em)?\s+)?(?:Citybike|Stadtrad|Hollandrad)\b/gi, name: "Citybike" },
    { pattern: /(?:ein(?:en?|em)?\s+)?(?:Mountainbike|MTB)\b/gi, name: "Mountainbike" },
    { pattern: /(?:ein(?:en?|em)?\s+)?(?:Trekkingrad|Tourenrad)\b/gi, name: "Trekkingrad" },
    { pattern: /(?:ein(?:en?|em)?\s+)?(?:Tandem)\b/gi, name: "Tandem" },
  ];

  const matchedRanges: Array<[number, number]> = [];

  // Erst Patterns mit Zahl davor
  for (const { pattern, name } of bikePatterns) {
    const matches = text.matchAll(pattern);
    for (const m of matches) {
      const menge = parseInt(m[1]) || 1;
      const start = m.index || 0;
      const end = start + m[0].length;
      // Nicht doppelt matchen
      if (!matchedRanges.some(([s, e]) => start >= s && start < e)) {
        const existing = fahrraeder.find((f) => f.name === name);
        if (existing) {
          existing.menge += menge;
        } else {
          fahrraeder.push({ name, menge });
        }
        matchedRanges.push([start, end]);
      }
    }
  }

  // Dann Einzelmuster (ohne Zahl) nur wenn kein Zahl-Match an der Stelle war
  for (const { pattern, name } of bikePatternsSingle) {
    const matches = text.matchAll(pattern);
    for (const m of matches) {
      const start = m.index || 0;
      const end = start + m[0].length;
      if (!matchedRanges.some(([s, e]) => start >= s && start < e)) {
        const existing = fahrraeder.find((f) => f.name === name);
        if (existing) {
          existing.menge += 1;
        } else {
          fahrraeder.push({ name, menge: 1 });
        }
        matchedRanges.push([start, end]);
      }
    }
  }

  // Wünsche — erweitert
  const wuensche: string[] = [];
  if (/helme?(?:\b|$)/i.test(text)) wuensche.push("Helm");
  if (/(?:schloss|schlösser|fahrradschloss|zahlenschloss)/i.test(text)) wuensche.push("Schloss");
  if (/(?:korb|körbe|fahrradkorb|lenkerkorb)/i.test(text)) wuensche.push("Fahrradkorb");
  if (/kindersitz/i.test(text)) wuensche.push("Kindersitz");
  if (/(?:anhänger|fahrradanhänger|kinderanhänger)/i.test(text)) wuensche.push("Anhänger");
  if (/(?:gps|navi(?:gation)?)/i.test(text)) wuensche.push("GPS");
  if (/(?:gepäcktasche|satteltasche|packtasche)/i.test(text)) wuensche.push("Gepäcktasche");
  if (/(?:regencape|regenponcho|regenschutz)/i.test(text)) wuensche.push("Regenschutz");
  if (/(?:luftpumpe|pumpe)/i.test(text)) wuensche.push("Luftpumpe");
  if (/(?:flickzeug|reparaturset)/i.test(text)) wuensche.push("Flickzeug");
  if (/(?:klingel)/i.test(text)) wuensche.push("Klingel");
  if (/(?:licht|beleuchtung|lampe)/i.test(text)) wuensche.push("Licht");
  if (/(?:koffertransport|koffer|gepäcktransport|gepäcktransfer|koffertransfer)/i.test(text)) wuensche.push("Koffertransport");
  if (/(?:versicherung|diebstahlschutz|vollkasko)/i.test(text)) wuensche.push("Versicherung");
  if (/(?:lieferung|zustellung|bringen.*(?:rad|bike|fahrrad)|liefern)/i.test(text)) wuensche.push("Lieferung");

  return {
    kunde,
    mietbeginn,
    mietende,
    personen,
    fahrraeder,
    wuensche,
    confidence: {
      kunde: kunde.name ? 50 : 15,
      raeume: mietbeginn && mietende ? 60 : mietbeginn ? 40 : (fahrraeder.length > 0 ? 40 : 10),
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

### E-Mail-Footer / Signatur — SEHR WICHTIG
E-Mails haben oft am Ende eine Signatur/Footer mit Absender-Kontaktdaten. Durchsuche den GESAMTEN Text — insbesondere die letzten Zeilen — nach:
- Name (oft nach "Mit freundlichen Grüßen", "Viele Grüße", "LG", "MfG", "Beste Grüße" etc.)
- Adresse (Straße + Hausnummer, PLZ + Ort) — oft auf separaten Zeilen untereinander
- Telefonnummer, E-Mail-Adresse
- Wenn im Fließtext KEINE Kundendaten stehen, aber im Footer/Signatur-Block welche erkennbar sind, verwende DIESE

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
        erkannterText: { type: "string", description: "Wörtliche Transkription des Originaltextes aus dem Bild/der Nachricht. Bei Screenshots: den sichtbaren Text 1:1 abtippen. Bei reinem Text: den Originaltext zurückgeben." },
      required: ["kunde", "arbeitsbereiche", "qualitaet", "extras", "confidence", "erkannterText"],
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
        select: { branche: true, wissenstext: true },
      });
      if (firma?.branche) branche = firma.branche;

      if (branche === "FEWO") {
        katalogKontext = await loadFewoKatalogKontext(user.firmaId);
      } else if (branche === "SHOP") {
        katalogKontext = await loadShopKatalogKontext(user.firmaId);
      } else if (branche === "FAHRRAD") {
        katalogKontext = await loadFahrradKatalogKontext(user.firmaId);
      } else {
        katalogKontext = await loadKatalogKontext(user.firmaId);
      }

      // Firmenwissen an Katalogkontext anhängen
      if (firma?.wissenstext) {
        katalogKontext += `\n\n## Firmenwissen\nDas folgende Firmenwissen hilft dir, Anfragen besser zu verstehen und einzuordnen. Nutze es um Begriffe, Ortsangaben, Spezialitäten des Betriebs und sonstige Kontextinformationen zu berücksichtigen:\n\n${firma.wissenstext}\n`;
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
      const isFewo = branche === "FEWO";
      const isFahrrad = branche === "FAHRRAD";

      if (!process.env.OPENAI_API_KEY) {
        if (textPart) {
          return NextResponse.json(
            isFahrrad ? parseFahrradAnfrageRegex(textPart) : isFewo ? parseFewoAnfrageRegex(textPart) : isShop ? parseShopAnfrageRegex(textPart) : parseAnfrageRegex(textPart)
          );
        }
        return NextResponse.json({ error: "Kein API Key für Bilderkennung" }, { status: 500 });
      }

      const systemPrompt = isFahrrad
        ? buildFahrradSystemPrompt(katalogKontext)
        : isFewo
          ? buildFewoSystemPrompt(katalogKontext)
          : isShop
            ? buildShopSystemPrompt(katalogKontext)
            : buildSystemPrompt(katalogKontext);
      const responseFormat = isFahrrad ? FAHRRAD_RESPONSE_FORMAT : isFewo ? FEWO_RESPONSE_FORMAT : isShop ? SHOP_RESPONSE_FORMAT : RESPONSE_FORMAT;

      const userContent: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "high" } }> = [];

      if (textPart) {
        userContent.push({
          type: "text",
          text: isFahrrad
            ? `Der Kunde hat folgende Anfrage geschrieben:\n\n${textPart}\n\nAnalysiere den Text und das Bild zusammen. Extrahiere Mietdaten, gewünschte Fahrräder und Extras.`
            : isFewo
              ? `Der Gast hat folgende Anfrage geschrieben:\n\n${textPart}\n\nAnalysiere den Text und das Bild zusammen. Extrahiere Reisedaten, Personen und Wünsche.`
              : isShop
                ? `Der Kunde hat zusätzlich diesen Text geschrieben:\n\n${textPart}\n\nAnalysiere den Text und das Bild zusammen. Extrahiere alle Produkte mit Mengen und Preisen.`
                : `Der Kunde hat zusätzlich diesen Text geschrieben:\n\n${textPart}\n\nAnalysiere den Text und das Bild zusammen.`,
        });
      } else {
        userContent.push({
          type: "text",
          text: isFahrrad
            ? "Analysiere diese Kundenanfrage für einen Fahrradverleih. Extrahiere Mietdaten, gewünschte Fahrräder und Extras:"
            : isFewo
              ? "Analysiere diese Gästeanfrage. Extrahiere Reisedaten, Personenanzahl und Sonderwünsche:"
              : isShop
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
      return NextResponse.json((isShop || isFewo || isFahrrad) ? parsed : validateParsedResult(parsed));
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
    const isFewo = branche === "FEWO";
    const isFahrrad = branche === "FAHRRAD";

    // Fallback auf Regex wenn kein API Key
    if (!process.env.OPENAI_API_KEY) {
      console.log("AI Parse: Kein API Key, nutze Regex-Fallback");
      return NextResponse.json(
        isFahrrad ? parseFahrradAnfrageRegex(inputText) : isFewo ? parseFewoAnfrageRegex(inputText) : isShop ? parseShopAnfrageRegex(inputText) : parseAnfrageRegex(inputText)
      );
    }

    const systemPrompt = isFahrrad
      ? buildFahrradSystemPrompt(katalogKontext)
      : isFewo
        ? buildFewoSystemPrompt(katalogKontext)
        : isShop
          ? buildShopSystemPrompt(katalogKontext)
          : buildSystemPrompt(katalogKontext);
    const responseFormat = isFahrrad ? FAHRRAD_RESPONSE_FORMAT : isFewo ? FEWO_RESPONSE_FORMAT : isShop ? SHOP_RESPONSE_FORMAT : RESPONSE_FORMAT;

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
        isFahrrad ? parseFahrradAnfrageRegex(inputText) : isFewo ? parseFewoAnfrageRegex(inputText) : isShop ? parseShopAnfrageRegex(inputText) : parseAnfrageRegex(inputText)
      );
    }

    const parsed = JSON.parse(content);
    return NextResponse.json((isShop || isFewo || isFahrrad) ? parsed : validateParsedResult(parsed));
  } catch (error) {
    console.error("AI Parse Fehler:", error);

    if (inputText) {
      console.log("OpenAI fehlgeschlagen, nutze Regex-Fallback");
      const isShop = branche === "SHOP";
      const isFewo = branche === "FEWO";
      const isFahrrad = branche === "FAHRRAD";
      return NextResponse.json(
        isFahrrad ? parseFahrradAnfrageRegex(inputText) : isFewo ? parseFewoAnfrageRegex(inputText) : isShop ? parseShopAnfrageRegex(inputText) : parseAnfrageRegex(inputText)
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

  // Footer/Signatur-Block extrahieren (alles nach der letzten Grußformel)
  const footerMatch = text.match(
    /(?:mit\s+freundlichen\s+gr[uü][sß]en|viele\s+gr[uü][sß]e|liebe\s+gr[uü][sß]e|beste\s+gr[uü][sß]e|herzliche\s+gr[uü][sß]e|freundliche\s+gr[uü][sß]e|mfg|lg|vg)\s*[,.]?\s*\n([\s\S]+)$/im
  );
  const footerText = footerMatch ? footerMatch[1].trim() : "";

  const grussMatch = text.match(
    /(?:gr[uü][sß]e?|mfg|freundlichen\s+gr[uü][sß]en|liebe\s+gr[uü][sß]e)\s*[,]?\s*\n\s*((?:familie\s+)?[a-zäöüßA-ZÄÖÜ]+(?:[-][a-zäöüßA-ZÄÖÜ]+)?(?:\s+[a-zäöüßA-ZÄÖÜ]+(?:[-][a-zäöüßA-ZÄÖÜ]+)?)?)/i
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
    "gesendet", "von", "betreff", "datum", "an",
  ]);

  if (!kunde.name) {
    const nameMatch = text.match(
      /(?:herr|frau|hr\.|fr\.)\s+([a-zäöüßA-ZÄÖÜ]{2,}(?:[-][a-zäöüßA-ZÄÖÜ]+)?)/i
    );
    if (nameMatch && !stoppwoerter.has(nameMatch[1].toLowerCase())) {
      const anrede = text.match(/herr/i) ? "Herr" : "Frau";
      kunde.name = anrede + " " + capitalize(nameMatch[1]);
    }
  }

  if (!kunde.name) {
    const ichBinMatch = text.match(
      /(?:mein name ist|ich bin|ich hei[sß]e)\s+(?:der\s+|die\s+)?([a-zäöüßA-ZÄÖÜ]{2,}(?:[-][a-zäöüßA-ZÄÖÜ]+)?(?:\s+[a-zäöüßA-ZÄÖÜ]{2,}(?:[-][a-zäöüßA-ZÄÖÜ]+)?)?)/i
    );
    if (ichBinMatch && !stoppwoerter.has(ichBinMatch[1].split(/\s/)[0].toLowerCase())) {
      kunde.name = capitalize(ichBinMatch[1]);
    }
  }

  // Footer-Name: Erste nicht-leere Zeile nach Grußformel (oft der Name)
  if (!kunde.name && footerText) {
    const footerLines = footerText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (footerLines.length > 0) {
      const firstLine = footerLines[0];
      // Prüfen ob es ein Name ist (2+ Buchstaben, kein Stoppwort, keine E-Mail/URL/Telefon)
      if (
        /^[A-ZÄÖÜa-zäöüß]/.test(firstLine) &&
        !/@/.test(firstLine) &&
        !/^(?:Tel|Fax|Mobil|http|www\.)/i.test(firstLine) &&
        !/^\d{5}/.test(firstLine) &&
        !stoppwoerter.has(firstLine.toLowerCase().split(/\s/)[0]) &&
        firstLine.length >= 3 &&
        firstLine.length <= 60
      ) {
        kunde.name = capitalize(firstLine);
      }
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

  // Adressen aus dem gesamten Text suchen (inkl. Footer)
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

  // Wenn im Haupttext keine Straße gefunden, explizit im Footer suchen
  if (!kunde.strasse && footerText) {
    for (const pattern of strassePatterns) {
      const match = footerText.match(pattern);
      if (match) {
        kunde.strasse = match[1].trim();
        break;
      }
    }
    // Footer-spezifisch: Zeile die wie eine Adresse aussieht (Wort + Zahl)
    if (!kunde.strasse) {
      const footerLines = footerText.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of footerLines) {
        const addrMatch = line.match(/^([A-ZÄÖÜa-zäöüß][a-zäöüß.-]+(?:straße|strasse|str\.?|weg|gasse|platz|allee|ring|damm|steig|pfad|ufer|graben|berg|hof|stieg)?\s+\d+\s*[a-zA-Z]?)$/i);
        if (addrMatch) {
          kunde.strasse = addrMatch[1].trim();
          break;
        }
      }
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

  // Wenn PLZ/Ort im Haupttext nicht gefunden, explizit im Footer suchen
  if (!kunde.plz && footerText) {
    for (const pattern of plzOrtPatterns) {
      const match = footerText.match(pattern);
      if (match) {
        kunde.plz = match[1];
        kunde.ort = match[2];
        break;
      }
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
