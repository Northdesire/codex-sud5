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

export interface ExtraInfo {
  bezeichnung: string;
  kategorie: string;
  schaetzMenge: number;
  einheit: string;
  einzelpreis?: number;
}

// --- ERGEBNIS-TYPEN ---

export interface RaumBerechnung {
  name: string;
  typ?: "RAUM" | "FLAECHE";
  laenge: number;
  breite: number;
  hoehe: number;
  fenster: number;
  tueren: number;
  wandflaeche: number;
  deckenflaeche: number;
  gesamtflaeche: number;
  arbeiten?: ArbeitsbereichArbeiten;
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
  materialKategorie?: string;
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
  materialAlternativen: Record<string, MaterialInfo[]>;
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
// Standard-Ergiebigkeiten wenn nicht hinterlegt (m² pro Einheit)
const DEFAULT_ERGIEBIGKEIT: Record<string, number> = {
  WANDFARBE: 7,
  GRUNDIERUNG: 9,
  LACK: 10,
  SPACHTEL: 3,
};

export function berechneMaterialBedarf(
  flaeche: number,
  material: MaterialInfo,
  regeln: KalkRegeln
): number {
  const ergiebigkeit = material.ergiebigkeit && material.ergiebigkeit > 0
    ? material.ergiebigkeit
    : DEFAULT_ERGIEBIGKEIT[material.kategorie] ?? 0;

  if (ergiebigkeit <= 0) return 1; // Mindestens 1 Einheit

  const anstriche = material.anstriche ?? regeln.standardAnstriche;
  const verschnitt = 1 + regeln.verschnittFaktor / 100;
  const bedarf = (flaeche * anstriche) / ergiebigkeit * verschnitt;

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
  rabattInfos: RabattInfo[] = [],
  selectedMaterials?: Record<string, string>,
  extras?: ExtraInfo[]
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

  // Hilfsfunktion: Material per Kategorie finden (selected oder auto)
  function findMaterial(kategorie: string, autoFilter?: (m: MaterialInfo) => boolean): MaterialInfo | undefined {
    if (selectedMaterials?.[kategorie]) {
      return materialien.find((m) => m.id === selectedMaterials[kategorie]);
    }
    if (autoFilter) {
      return materialien.find((m) => m.kategorie === kategorie && autoFilter(m))
        ?? materialien.find((m) => m.kategorie === kategorie);
    }
    return materialien.find((m) => m.kategorie === kategorie);
  }

  // Wandfarbe
  const wandfarbe = findMaterial("WANDFARBE", (m) =>
    optionen.qualitaet === "premium"
      ? m.name.toLowerCase().includes("premium") || m.name.toLowerCase().includes("caparol")
      : true
  );

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
        materialKategorie: "WANDFARBE",
      });
      materialNetto += gp;
    }
  }

  // Grundierung
  if (optionen.grundierung || regeln.grundierungImmer) {
    const grundierung = findMaterial("GRUNDIERUNG");
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
          materialKategorie: "GRUNDIERUNG",
        });
        materialNetto += gp;
      }
    }
  }

  // Spachtelmasse
  if (optionen.spachteln) {
    const spachtel = findMaterial("SPACHTEL");
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
        materialKategorie: "SPACHTEL",
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
        materialKategorie: "VERBRAUCH",
      });
      materialNetto += gp;
    }
  }

  // Zusätzliche Materialien (SONSTIGES, LACK, TAPETE etc.) — vom User manuell gewählt
  if (selectedMaterials) {
    for (const [key, matId] of Object.entries(selectedMaterials)) {
      if (key.startsWith("ZUSATZ_")) {
        const mat = materialien.find((m) => m.id === matId);
        if (mat) {
          // Menge aus selectedMaterials: ZUSATZ_MENGE_{matId}
          const mengeKey = `ZUSATZ_MENGE_${matId}`;
          const menge = selectedMaterials[mengeKey] ? parseFloat(selectedMaterials[mengeKey]) : 1;
          const gp = runde2(menge * mat.vkPreis);
          positionen.push({
            posNr: posNr++,
            typ: "MATERIAL",
            bezeichnung: mat.name,
            menge,
            einheit: mat.einheit,
            einzelpreis: mat.vkPreis,
            gesamtpreis: gp,
            materialId: mat.id,
            materialKategorie: mat.kategorie,
          });
          materialNetto += gp;
        }
      }
    }
  }

  // --- EXTRAS (Zusatzarbeiten aus AI-Erkennung) ---
  if (extras && extras.length > 0) {
    for (const extra of extras) {
      // Default to 1 for pauschal items with 0 quantity
      const menge = extra.schaetzMenge > 0
        ? extra.schaetzMenge
        : extra.einheit === "pauschal" ? 1 : 0;
      if (menge <= 0) continue;

      // Try name-based matching first (more specific), then fall back to category
      const bezLower = extra.bezeichnung.toLowerCase();
      const matchedLeistung =
        leistungen.find((l) => bezLower.includes(l.name.toLowerCase()) || l.name.toLowerCase().includes(bezLower)) ??
        leistungen.find((l) => l.kategorie === extra.kategorie && l.einheit === extra.einheit) ??
        leistungen.find((l) => l.kategorie === extra.kategorie);

      const preis = extra.einzelpreis != null && extra.einzelpreis > 0
        ? extra.einzelpreis
        : (matchedLeistung ? matchedLeistung.preisProEinheit : 0);
      const gp = runde2(menge * preis);

      positionen.push({
        posNr: posNr++,
        typ: "LEISTUNG",
        bezeichnung: extra.bezeichnung,
        menge,
        einheit: extra.einheit,
        einzelpreis: preis,
        gesamtpreis: gp,
        leistungId: matchedLeistung?.id,
      });
      arbeitsNetto += gp;
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

  // Material-Alternativen pro Kategorie sammeln
  const kategorien = ["WANDFARBE", "GRUNDIERUNG", "SPACHTEL", "LACK", "VERBRAUCH", "TAPETE", "SONSTIGES"];
  const materialAlternativen: Record<string, MaterialInfo[]> = {};
  for (const kat of kategorien) {
    const items = materialien.filter((m) => m.kategorie === kat);
    if (items.length > 0) {
      materialAlternativen[kat] = items;
    }
  }

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
    materialAlternativen,
  };
}

// --- V2: Per-Bereich Arbeiten ---

export interface ArbeitsbereichArbeiten {
  waendeStreichen: boolean;
  deckeStreichen: boolean;
  grundierung: boolean;
  spachteln: boolean;
  tapeteEntfernen: boolean;
  tapezieren: boolean;
}

export interface Arbeitsbereich {
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

interface BereichBerechnung {
  name: string;
  typ: "RAUM" | "FLAECHE";
  wandflaeche: number;
  deckenflaeche: number;
}

function findLeistungByNameMatch(leistungen: LeistungInfo[], kategorie: string, namePattern: string): LeistungInfo | undefined {
  const lower = namePattern.toLowerCase();
  return leistungen.find(
    (l) => l.kategorie === kategorie && l.name.toLowerCase().includes(lower)
  );
}

/**
 * V2 Kalkulation: Per-Bereich Arbeiten statt globale Optionen
 */
export function kalkuliereV2(
  arbeitsbereiche: Arbeitsbereich[],
  qualitaet: "standard" | "premium",
  regeln: KalkRegeln,
  materialien: MaterialInfo[],
  leistungen: LeistungInfo[],
  mwstSatz: number,
  zuschlagInfos: ZuschlagInfo[] = [],
  rabattInfos: RabattInfo[] = [],
  selectedMaterials?: Record<string, string>,
  extras?: ExtraInfo[],
  customAnfahrt?: number,
): KalkErgebnis {
  const positionen: Position[] = [];
  let posNr = 1;
  let materialNetto = 0;
  let arbeitsNetto = 0;

  // Bereiche berechnen
  const berechnungen: BereichBerechnung[] = arbeitsbereiche.map((b) => {
    if (b.typ === "FLAECHE") {
      return {
        name: b.name,
        typ: b.typ,
        wandflaeche: runde2(b.wandflaeche || 0),
        deckenflaeche: runde2(b.deckenflaeche || 0),
      };
    }
    // RAUM: aus Maßen berechnen
    const wand = Math.max(
      0,
      2 * (b.laenge + b.breite) * b.hoehe -
        b.fenster * regeln.fensterAbzug -
        b.tueren * regeln.tuerAbzug
    );
    return {
      name: b.name,
      typ: b.typ,
      wandflaeche: runde2(wand),
      deckenflaeche: runde2(b.laenge * b.breite),
    };
  });

  // Leistungen finden
  const wandLeistung =
    findLeistungByNameMatch(leistungen, "STREICHEN", "wand") ??
    findLeistungByNameMatch(leistungen, "STREICHEN", "wänd") ??
    leistungen.find((l) => l.kategorie === "STREICHEN" && l.materialKat === "WANDFARBE") ??
    leistungen.find((l) => l.kategorie === "STREICHEN");

  const deckenLeistung =
    findLeistungByNameMatch(leistungen, "STREICHEN", "decke") ??
    wandLeistung; // Fallback auf Wandleistung

  const grundierungLeistung =
    findLeistungByNameMatch(leistungen, "VORBEREITUNG", "grundier") ??
    leistungen.find((l) => l.kategorie === "VORBEREITUNG");

  const spachtelLeistung =
    findLeistungByNameMatch(leistungen, "VORBEREITUNG", "spachtel") ??
    leistungen.find((l) => l.kategorie === "VORBEREITUNG" && l.materialKat === "SPACHTEL");

  const tapeteEntfernenLeistung =
    findLeistungByNameMatch(leistungen, "TAPEZIEREN", "tapete entfern") ??
    findLeistungByNameMatch(leistungen, "VORBEREITUNG", "tapete entfern") ??
    findLeistungByNameMatch(leistungen, "TAPEZIEREN", "entfern");

  const tapezierenLeistung =
    findLeistungByNameMatch(leistungen, "TAPEZIEREN", "tapezier");

  // Gesamtflächen für Material-Berechnung
  let gesamtStreichWand = 0;
  let gesamtStreichDecke = 0;
  let gesamtGrundierung = 0;
  let gesamtSpachtel = 0;

  // --- ARBEITSLEISTUNGEN pro Bereich ---
  for (let i = 0; i < arbeitsbereiche.length; i++) {
    const bereich = arbeitsbereiche[i];
    const ber = berechnungen[i];
    const a = bereich.arbeiten;

    // Wände streichen
    if (a.waendeStreichen && wandLeistung && ber.wandflaeche > 0) {
      const gp = runde2(ber.wandflaeche * wandLeistung.preisProEinheit);
      positionen.push({
        posNr: posNr++,
        typ: "LEISTUNG",
        raumName: ber.name,
        bezeichnung: `${wandLeistung.name} — ${ber.name}`,
        menge: ber.wandflaeche,
        einheit: wandLeistung.einheit,
        einzelpreis: wandLeistung.preisProEinheit,
        gesamtpreis: gp,
        leistungId: wandLeistung.id,
      });
      arbeitsNetto += gp;
      gesamtStreichWand += ber.wandflaeche;
    }

    // Decke streichen
    if (a.deckeStreichen && deckenLeistung && ber.deckenflaeche > 0) {
      const gp = runde2(ber.deckenflaeche * deckenLeistung.preisProEinheit);
      positionen.push({
        posNr: posNr++,
        typ: "LEISTUNG",
        raumName: ber.name,
        bezeichnung: `${deckenLeistung.name} — ${ber.name}`,
        menge: ber.deckenflaeche,
        einheit: deckenLeistung.einheit,
        einzelpreis: deckenLeistung.preisProEinheit,
        gesamtpreis: gp,
        leistungId: deckenLeistung.id,
      });
      arbeitsNetto += gp;
      gesamtStreichDecke += ber.deckenflaeche;
    }

    // Grundierung
    if (a.grundierung && grundierungLeistung) {
      const flaeche =
        (a.waendeStreichen ? ber.wandflaeche : 0) +
        (a.deckeStreichen ? ber.deckenflaeche : 0);
      if (flaeche > 0) {
        const gp = runde2(flaeche * grundierungLeistung.preisProEinheit);
        positionen.push({
          posNr: posNr++,
          typ: "LEISTUNG",
          raumName: ber.name,
          bezeichnung: `${grundierungLeistung.name} — ${ber.name}`,
          menge: flaeche,
          einheit: grundierungLeistung.einheit,
          einzelpreis: grundierungLeistung.preisProEinheit,
          gesamtpreis: gp,
          leistungId: grundierungLeistung.id,
        });
        arbeitsNetto += gp;
        gesamtGrundierung += flaeche;
      }
    }

    // Spachteln
    if (a.spachteln && spachtelLeistung) {
      const flaeche = ber.wandflaeche + ber.deckenflaeche;
      if (flaeche > 0) {
        const gp = runde2(flaeche * spachtelLeistung.preisProEinheit);
        positionen.push({
          posNr: posNr++,
          typ: "LEISTUNG",
          raumName: ber.name,
          bezeichnung: `${spachtelLeistung.name} — ${ber.name}`,
          menge: flaeche,
          einheit: spachtelLeistung.einheit,
          einzelpreis: spachtelLeistung.preisProEinheit,
          gesamtpreis: gp,
          leistungId: spachtelLeistung.id,
        });
        arbeitsNetto += gp;
        gesamtSpachtel += flaeche;
      }
    }

    // Tapete entfernen
    if (a.tapeteEntfernen && tapeteEntfernenLeistung && ber.wandflaeche > 0) {
      const gp = runde2(ber.wandflaeche * tapeteEntfernenLeistung.preisProEinheit);
      positionen.push({
        posNr: posNr++,
        typ: "LEISTUNG",
        raumName: ber.name,
        bezeichnung: `${tapeteEntfernenLeistung.name} — ${ber.name}`,
        menge: ber.wandflaeche,
        einheit: tapeteEntfernenLeistung.einheit,
        einzelpreis: tapeteEntfernenLeistung.preisProEinheit,
        gesamtpreis: gp,
        leistungId: tapeteEntfernenLeistung.id,
      });
      arbeitsNetto += gp;
    }

    // Tapezieren
    if (a.tapezieren && tapezierenLeistung && ber.wandflaeche > 0) {
      const gp = runde2(ber.wandflaeche * tapezierenLeistung.preisProEinheit);
      positionen.push({
        posNr: posNr++,
        typ: "LEISTUNG",
        raumName: ber.name,
        bezeichnung: `${tapezierenLeistung.name} — ${ber.name}`,
        menge: ber.wandflaeche,
        einheit: tapezierenLeistung.einheit,
        einzelpreis: tapezierenLeistung.preisProEinheit,
        gesamtpreis: gp,
        leistungId: tapezierenLeistung.id,
      });
      arbeitsNetto += gp;
    }
  }

  // --- MATERIALIEN ---

  function findMaterial(kategorie: string, autoFilter?: (m: MaterialInfo) => boolean): MaterialInfo | undefined {
    if (selectedMaterials?.[kategorie]) {
      return materialien.find((m) => m.id === selectedMaterials[kategorie]);
    }
    if (autoFilter) {
      return materialien.find((m) => m.kategorie === kategorie && autoFilter(m))
        ?? materialien.find((m) => m.kategorie === kategorie);
    }
    return materialien.find((m) => m.kategorie === kategorie);
  }

  // Wandfarbe (basierend auf tatsächlich gestrichenen Flächen)
  const gesamtStreichFlaeche = gesamtStreichWand + gesamtStreichDecke;
  const wandfarbe = findMaterial("WANDFARBE", (m) =>
    qualitaet === "premium"
      ? m.name.toLowerCase().includes("premium") || m.name.toLowerCase().includes("caparol")
      : true
  );

  if (wandfarbe && gesamtStreichFlaeche > 0) {
    const menge = berechneMaterialBedarf(gesamtStreichFlaeche, wandfarbe, regeln);
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
        materialKategorie: "WANDFARBE",
      });
      materialNetto += gp;
    }
  }

  // Grundierung
  if (gesamtGrundierung > 0) {
    const grundierung = findMaterial("GRUNDIERUNG");
    if (grundierung) {
      const menge = berechneMaterialBedarf(
        gesamtGrundierung,
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
          materialKategorie: "GRUNDIERUNG",
        });
        materialNetto += gp;
      }
    }
  }

  // Spachtelmasse
  if (gesamtSpachtel > 0) {
    const spachtel = findMaterial("SPACHTEL");
    if (spachtel) {
      const verschnitt = 1 + regeln.verschnittFaktor / 100;
      const menge = Math.ceil(gesamtSpachtel * 0.3 * verschnitt);
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
        materialKategorie: "SPACHTEL",
      });
      materialNetto += gp;
    }
  }

  // Tapete (wenn tapeziert wird)
  const gesamtTapezieren = arbeitsbereiche.reduce((sum, b, i) =>
    b.arbeiten.tapezieren ? sum + berechnungen[i].wandflaeche : sum, 0
  );
  if (gesamtTapezieren > 0) {
    const tapete = findMaterial("TAPETE");
    if (tapete) {
      const menge = berechneMaterialBedarf(gesamtTapezieren, tapete, regeln);
      if (menge > 0) {
        const gp = runde2(menge * tapete.vkPreis);
        positionen.push({
          posNr: posNr++,
          typ: "MATERIAL",
          bezeichnung: tapete.name,
          menge,
          einheit: tapete.einheit,
          einzelpreis: tapete.vkPreis,
          gesamtpreis: gp,
          materialId: tapete.id,
          materialKategorie: "TAPETE",
        });
        materialNetto += gp;
      }
    }
  }

  // Verbrauchsmaterial
  const verbrauchsmaterialien = materialien.filter((m) => m.kategorie === "VERBRAUCH");
  for (const vm of verbrauchsmaterialien) {
    let menge = 0;
    const nameLower = vm.name.toLowerCase();
    if (nameLower.includes("folie") || nameLower.includes("abdeck")) {
      menge = arbeitsbereiche.length * regeln.abdeckfolieProRaum;
    } else if (nameLower.includes("klebe") || nameLower.includes("band")) {
      menge = arbeitsbereiche.length * regeln.abklebebandProRaum;
    } else if (nameLower.includes("acryl") && regeln.acrylProRaum > 0) {
      menge = arbeitsbereiche.length * regeln.acrylProRaum;
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
        materialKategorie: "VERBRAUCH",
      });
      materialNetto += gp;
    }
  }

  // Zusätzliche Materialien
  if (selectedMaterials) {
    for (const [key, matId] of Object.entries(selectedMaterials)) {
      if (key.startsWith("ZUSATZ_")) {
        const mat = materialien.find((m) => m.id === matId);
        if (mat) {
          const mengeKey = `ZUSATZ_MENGE_${matId}`;
          const menge = selectedMaterials[mengeKey] ? parseFloat(selectedMaterials[mengeKey]) : 1;
          const gp = runde2(menge * mat.vkPreis);
          positionen.push({
            posNr: posNr++,
            typ: "MATERIAL",
            bezeichnung: mat.name,
            menge,
            einheit: mat.einheit,
            einzelpreis: mat.vkPreis,
            gesamtpreis: gp,
            materialId: mat.id,
            materialKategorie: mat.kategorie,
          });
          materialNetto += gp;
        }
      }
    }
  }

  // --- EXTRAS ---
  if (extras && extras.length > 0) {
    for (const extra of extras) {
      const menge = extra.schaetzMenge > 0
        ? extra.schaetzMenge
        : extra.einheit === "pauschal" ? 1 : 0;
      if (menge <= 0) continue;

      const bezLower = extra.bezeichnung.toLowerCase();
      const matchedLeistung =
        leistungen.find((l) => bezLower.includes(l.name.toLowerCase()) || l.name.toLowerCase().includes(bezLower)) ??
        leistungen.find((l) => l.kategorie === extra.kategorie && l.einheit === extra.einheit) ??
        leistungen.find((l) => l.kategorie === extra.kategorie);

      const preis = extra.einzelpreis != null && extra.einzelpreis > 0
        ? extra.einzelpreis
        : (matchedLeistung ? matchedLeistung.preisProEinheit : 0);
      const gp = runde2(menge * preis);

      positionen.push({
        posNr: posNr++,
        typ: "LEISTUNG",
        bezeichnung: extra.bezeichnung,
        menge,
        einheit: extra.einheit,
        einzelpreis: preis,
        gesamtpreis: gp,
        leistungId: matchedLeistung?.id,
      });
      arbeitsNetto += gp;
    }
  }

  // --- ANFAHRT ---
  const anfahrt = customAnfahrt !== undefined
    ? customAnfahrt
    : (arbeitsbereiche.length <= regeln.anfahrtSchwelle
        ? regeln.anfahrtKlein
        : regeln.anfahrtGross);

  if (anfahrt > 0) {
    positionen.push({
      posNr: posNr++,
      typ: "ANFAHRT",
      bezeichnung: "Anfahrtspauschale",
      menge: 1,
      einheit: "pauschal",
      einzelpreis: anfahrt,
      gesamtpreis: anfahrt,
    });
  }

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

  // Material-Alternativen
  const kategorien = ["WANDFARBE", "GRUNDIERUNG", "SPACHTEL", "LACK", "VERBRAUCH", "TAPETE", "SONSTIGES"];
  const materialAlternativen: Record<string, MaterialInfo[]> = {};
  for (const kat of kategorien) {
    const items = materialien.filter((m) => m.kategorie === kat);
    if (items.length > 0) materialAlternativen[kat] = items;
  }

  // RaumBerechnung für Anzeige
  const raeume: RaumBerechnung[] = arbeitsbereiche.map((ab, i) => {
    const b = berechnungen[i];
    return {
      name: b.name,
      typ: ab.typ,
      laenge: ab.typ === "RAUM" ? ab.laenge : 0,
      breite: ab.typ === "RAUM" ? ab.breite : 0,
      hoehe: ab.typ === "RAUM" ? ab.hoehe : 0,
      fenster: ab.typ === "RAUM" ? ab.fenster : 0,
      tueren: ab.typ === "RAUM" ? ab.tueren : 0,
      wandflaeche: b.wandflaeche,
      deckenflaeche: b.deckenflaeche,
      gesamtflaeche: runde2(b.wandflaeche + b.deckenflaeche),
      arbeiten: { ...ab.arbeiten },
    };
  });

  return {
    raeume,
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
    materialAlternativen,
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
