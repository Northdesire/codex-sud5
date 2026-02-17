// ═══════════════════════════════════════════
// AIngebot — Kalkulations-Engine
// Berechnet Flächen, Materialmengen und Preise
// ═══════════════════════════════════════════

// --- TYPEN ---

export interface Raum {
  name: string;
  laenge: number;
  breite: number;
  hoehe: number;
  fenster: number;
  tueren: number;
  decke: boolean;
}

export interface KalkOptionen {
  qualitaet: "standard" | "premium";
  spachteln: boolean;
  tapeteEntfernen: boolean;
  grundierung: boolean;
}

export interface KalkRegeln {
  verschnittFaktor: number;    // % (z.B. 10)
  standardAnstriche: number;   // z.B. 2
  grundierungImmer: boolean;
  abklebebandProRaum: number;
  abdeckfolieProRaum: number;
  acrylProRaum: number;
  anfahrtKlein: number;
  anfahrtGross: number;
  anfahrtSchwelle: number;
  fensterAbzug: number;        // m² pro Fenster
  tuerAbzug: number;           // m² pro Tür
}

export interface MaterialInfo {
  id: string;
  name: string;
  kategorie: string;
  vkPreis: number;
  einheit: string;
  ergiebigkeit: number | null;
  anstriche: number | null;
}

export interface LeistungInfo {
  id: string;
  name: string;
  kategorie: string;
  einheit: string;
  preisProEinheit: number;
  materialKat: string | null;
}

// --- ERGEBNIS-TYPEN ---

export interface RaumBerechnung {
  name: string;
  laenge: number;
  breite: number;
  hoehe: number;
  fenster: number;
  tueren: number;
  wandflaeche: number;
  deckenflaeche: number;
  gesamtflaeche: number;
}

export interface Position {
  posNr: number;
  typ: "LEISTUNG" | "MATERIAL" | "ZUSCHLAG" | "RABATT" | "ANFAHRT";
  raumName?: string;
  bezeichnung: string;
  menge: number;
  einheit: string;
  einzelpreis: number;
  gesamtpreis: number;
  leistungId?: string;
  materialId?: string;
}

export interface KalkErgebnis {
  raeume: RaumBerechnung[];
  positionen: Position[];
  materialNetto: number;
  arbeitsNetto: number;
  anfahrt: number;
  zuschlagNetto: number;
  rabattNetto: number;
  netto: number;
  mwstSatz: number;
  mwstBetrag: number;
  brutto: number;
}

// --- DEFAULT REGELN ---

export const DEFAULT_REGELN: KalkRegeln = {
  verschnittFaktor: 10,
  standardAnstriche: 2,
  grundierungImmer: true,
  abklebebandProRaum: 2,
  abdeckfolieProRaum: 1,
  acrylProRaum: 0,
  anfahrtKlein: 35,
  anfahrtGross: 55,
  anfahrtSchwelle: 3,
  fensterAbzug: 1.5,
  tuerAbzug: 2.0,
};

// --- BERECHNUNGEN ---

/**
 * Berechnet Wand- und Deckenfläche eines Raums
 */
export function berechneRaumFlaeche(
  raum: Raum,
  regeln: KalkRegeln
): RaumBerechnung {
  const wandflaeche = Math.max(
    0,
    2 * (raum.laenge + raum.breite) * raum.hoehe -
      raum.fenster * regeln.fensterAbzug -
      raum.tueren * regeln.tuerAbzug
  );

  const deckenflaeche = raum.decke ? raum.laenge * raum.breite : 0;

  return {
    name: raum.name,
    laenge: raum.laenge,
    breite: raum.breite,
    hoehe: raum.hoehe,
    fenster: raum.fenster,
    tueren: raum.tueren,
    wandflaeche: runde2(wandflaeche),
    deckenflaeche: runde2(deckenflaeche),
    gesamtflaeche: runde2(wandflaeche + deckenflaeche),
  };
}

/**
 * Berechnet den Materialbedarf (z.B. Liter Farbe)
 */
export function berechneMaterialBedarf(
  flaeche: number,
  material: MaterialInfo,
  regeln: KalkRegeln
): number {
  if (!material.ergiebigkeit || material.ergiebigkeit <= 0) return 0;

  const anstriche = material.anstriche ?? regeln.standardAnstriche;
  const verschnitt = 1 + regeln.verschnittFaktor / 100;
  const bedarf = (flaeche * anstriche) / material.ergiebigkeit * verschnitt;

  return Math.ceil(bedarf); // Aufrunden auf ganze Einheiten
}

export interface ZuschlagInfo {
  name: string;
  typ: "PROZENT" | "PAUSCHAL";
  wert: number;
}

export interface RabattInfo {
  name: string;
  typ: "PROZENT" | "PAUSCHAL";
  wert: number;
}

/**
 * Hauptfunktion: Komplette Angebots-Kalkulation
 */
export function kalkuliere(
  raeume: Raum[],
  optionen: KalkOptionen,
  regeln: KalkRegeln,
  materialien: MaterialInfo[],
  leistungen: LeistungInfo[],
  mwstSatz: number,
  zuschlagInfos: ZuschlagInfo[] = [],
  rabattInfos: RabattInfo[] = []
): KalkErgebnis {
  const berechneteRaeume = raeume.map((r) => berechneRaumFlaeche(r, regeln));
  const positionen: Position[] = [];
  let posNr = 1;
  let materialNetto = 0;
  let arbeitsNetto = 0;

  // Gesamtfläche über alle Räume
  const gesamtWandflaeche = berechneteRaeume.reduce(
    (sum, r) => sum + r.wandflaeche, 0
  );
  const gesamtDeckenflaeche = berechneteRaeume.reduce(
    (sum, r) => sum + r.deckenflaeche, 0
  );
  const gesamtflaeche = gesamtWandflaeche + gesamtDeckenflaeche;

  // --- ARBEITSLEISTUNGEN pro Raum ---
  const streichLeistung = leistungen.find(
    (l) => l.kategorie === "STREICHEN" && l.materialKat === "WANDFARBE"
  ) ?? leistungen.find((l) => l.kategorie === "STREICHEN");

  for (const raum of berechneteRaeume) {
    if (streichLeistung && raum.gesamtflaeche > 0) {
      const gp = runde2(raum.gesamtflaeche * streichLeistung.preisProEinheit);
      positionen.push({
        posNr: posNr++,
        typ: "LEISTUNG",
        raumName: raum.name,
        bezeichnung: `${streichLeistung.name} — ${raum.name}`,
        menge: raum.gesamtflaeche,
        einheit: streichLeistung.einheit,
        einzelpreis: streichLeistung.preisProEinheit,
        gesamtpreis: gp,
        leistungId: streichLeistung.id,
      });
      arbeitsNetto += gp;
    }
  }

  // Spachteln
  if (optionen.spachteln) {
    const spachtelLeistung = leistungen.find(
      (l) => l.kategorie === "VORBEREITUNG" && l.materialKat === "SPACHTEL"
    ) ?? leistungen.find((l) => l.kategorie === "VORBEREITUNG");

    if (spachtelLeistung) {
      const gp = runde2(gesamtflaeche * spachtelLeistung.preisProEinheit);
      positionen.push({
        posNr: posNr++,
        typ: "LEISTUNG",
        bezeichnung: spachtelLeistung.name,
        menge: gesamtflaeche,
        einheit: spachtelLeistung.einheit,
        einzelpreis: spachtelLeistung.preisProEinheit,
        gesamtpreis: gp,
        leistungId: spachtelLeistung.id,
      });
      arbeitsNetto += gp;
    }
  }

  // --- MATERIALIEN ---

  // Wandfarbe
  const wandfarbe = materialien.find((m) =>
    m.kategorie === "WANDFARBE" &&
    (optionen.qualitaet === "premium"
      ? m.name.toLowerCase().includes("premium") ||
        m.name.toLowerCase().includes("caparol")
      : true)
  ) ?? materialien.find((m) => m.kategorie === "WANDFARBE");

  if (wandfarbe && gesamtflaeche > 0) {
    const menge = berechneMaterialBedarf(gesamtflaeche, wandfarbe, regeln);
    if (menge > 0) {
      const gp = runde2(menge * wandfarbe.vkPreis);
      positionen.push({
        posNr: posNr++,
        typ: "MATERIAL",
        bezeichnung: wandfarbe.name,
        menge,
        einheit: wandfarbe.einheit,
        einzelpreis: wandfarbe.vkPreis,
        gesamtpreis: gp,
        materialId: wandfarbe.id,
      });
      materialNetto += gp;
    }
  }

  // Grundierung
  if (optionen.grundierung || regeln.grundierungImmer) {
    const grundierung = materialien.find(
      (m) => m.kategorie === "GRUNDIERUNG"
    );
    if (grundierung && gesamtflaeche > 0) {
      const menge = berechneMaterialBedarf(
        gesamtflaeche,
        { ...grundierung, anstriche: 1 },
        regeln
      );
      if (menge > 0) {
        const gp = runde2(menge * grundierung.vkPreis);
        positionen.push({
          posNr: posNr++,
          typ: "MATERIAL",
          bezeichnung: grundierung.name,
          menge,
          einheit: grundierung.einheit,
          einzelpreis: grundierung.vkPreis,
          gesamtpreis: gp,
          materialId: grundierung.id,
        });
        materialNetto += gp;
      }
    }
  }

  // Spachtelmasse
  if (optionen.spachteln) {
    const spachtel = materialien.find((m) => m.kategorie === "SPACHTEL");
    if (spachtel) {
      const verschnitt = 1 + regeln.verschnittFaktor / 100;
      const menge = Math.ceil(gesamtflaeche * 0.3 * verschnitt); // 0.3 kg/m²
      const gp = runde2(menge * spachtel.vkPreis);
      positionen.push({
        posNr: posNr++,
        typ: "MATERIAL",
        bezeichnung: spachtel.name,
        menge,
        einheit: spachtel.einheit,
        einzelpreis: spachtel.vkPreis,
        gesamtpreis: gp,
        materialId: spachtel.id,
      });
      materialNetto += gp;
    }
  }

  // Verbrauchsmaterial (Abdeckfolie, Klebeband, Acryl)
  const verbrauchsmaterialien = materialien.filter(
    (m) => m.kategorie === "VERBRAUCH"
  );
  for (const vm of verbrauchsmaterialien) {
    let menge = 0;
    const nameLower = vm.name.toLowerCase();
    if (nameLower.includes("folie") || nameLower.includes("abdeck")) {
      menge = raeume.length * regeln.abdeckfolieProRaum;
    } else if (nameLower.includes("klebe") || nameLower.includes("band")) {
      menge = raeume.length * regeln.abklebebandProRaum;
    } else if (nameLower.includes("acryl") && regeln.acrylProRaum > 0) {
      menge = raeume.length * regeln.acrylProRaum;
    }
    if (menge > 0) {
      const gp = runde2(menge * vm.vkPreis);
      positionen.push({
        posNr: posNr++,
        typ: "MATERIAL",
        bezeichnung: vm.name,
        menge,
        einheit: vm.einheit,
        einzelpreis: vm.vkPreis,
        gesamtpreis: gp,
        materialId: vm.id,
      });
      materialNetto += gp;
    }
  }

  // --- ANFAHRT ---
  const anfahrt =
    raeume.length <= regeln.anfahrtSchwelle
      ? regeln.anfahrtKlein
      : regeln.anfahrtGross;

  positionen.push({
    posNr: posNr++,
    typ: "ANFAHRT",
    bezeichnung: "Anfahrtspauschale",
    menge: 1,
    einheit: "pauschal",
    einzelpreis: anfahrt,
    gesamtpreis: anfahrt,
  });

  // --- ZUSCHLÄGE ---
  let zuschlagNetto = 0;
  const zwischenNetto = materialNetto + arbeitsNetto + anfahrt;

  for (const z of zuschlagInfos) {
    const betrag = z.typ === "PROZENT"
      ? runde2(zwischenNetto * (z.wert / 100))
      : z.wert;
    positionen.push({
      posNr: posNr++,
      typ: "ZUSCHLAG",
      bezeichnung: `${z.name}${z.typ === "PROZENT" ? ` (${z.wert}%)` : ""}`,
      menge: 1,
      einheit: z.typ === "PROZENT" ? "%" : "pauschal",
      einzelpreis: betrag,
      gesamtpreis: betrag,
    });
    zuschlagNetto += betrag;
  }

  // --- RABATTE ---
  let rabattNetto = 0;
  const vorRabattNetto = zwischenNetto + zuschlagNetto;

  for (const r of rabattInfos) {
    const betrag = r.typ === "PROZENT"
      ? runde2(vorRabattNetto * (r.wert / 100))
      : r.wert;
    positionen.push({
      posNr: posNr++,
      typ: "RABATT",
      bezeichnung: `${r.name}${r.typ === "PROZENT" ? ` (${r.wert}%)` : ""}`,
      menge: 1,
      einheit: r.typ === "PROZENT" ? "%" : "pauschal",
      einzelpreis: -betrag,
      gesamtpreis: -betrag,
    });
    rabattNetto += betrag;
  }

  const netto = runde2(
    materialNetto + arbeitsNetto + anfahrt + zuschlagNetto - rabattNetto
  );
  const mwstBetrag = runde2(netto * (mwstSatz / 100));
  const brutto = runde2(netto + mwstBetrag);

  return {
    raeume: berechneteRaeume,
    positionen,
    materialNetto: runde2(materialNetto),
    arbeitsNetto: runde2(arbeitsNetto),
    anfahrt,
    zuschlagNetto,
    rabattNetto,
    netto,
    mwstSatz,
    mwstBetrag,
    brutto,
  };
}

// --- HELFER ---

function runde2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Formatiert eine Zahl als deutschen Euro-Betrag
 */
export function formatEuro(n: number): string {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}
