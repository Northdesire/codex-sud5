import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Finde die erste Firma in der DB
  const firma = await prisma.firma.findFirst();

  if (!firma) {
    console.error("Keine Firma gefunden! Bitte erst registrieren.");
    process.exit(1);
  }

  console.log(`\nSeed-Daten fuer: ${firma.firmenname} (ID: ${firma.id})\n`);

  // ═══════════════════════════════════════════
  // MATERIALIEN
  // ═══════════════════════════════════════════

  const materialien = [
    // Wandfarbe
    {
      name: "Caparol CapaMaxx",
      kategorie: "WANDFARBE" as const,
      einheit: "Liter",
      ekPreis: 4.5,
      vkPreis: 7.5,
      ergiebigkeit: 7.0,
      anstriche: 2,
      notizen: "Premium Innenfarbe, stumpfmatt, hoechste Deckkraft Klasse 1",
    },
    {
      name: "Alpina Weisslack",
      kategorie: "WANDFARBE" as const,
      einheit: "Liter",
      ekPreis: 3.2,
      vkPreis: 5.5,
      ergiebigkeit: 7.0,
      anstriche: 2,
      notizen: "Standard Innenfarbe, gute Deckkraft Klasse 2",
    },
    {
      name: "Caparol Indeko Plus",
      kategorie: "WANDFARBE" as const,
      einheit: "Liter",
      ekPreis: 5.8,
      vkPreis: 9.0,
      ergiebigkeit: 6.5,
      anstriche: 2,
      notizen: "Premium Innenfarbe, doppelweiss, scheuerbestaendig",
    },
    // Grundierung
    {
      name: "Caparol Tiefengrund",
      kategorie: "GRUNDIERUNG" as const,
      einheit: "Liter",
      ekPreis: 2.8,
      vkPreis: 4.5,
      ergiebigkeit: 10.0,
      anstriche: 1,
      notizen: "Tiefengrundierung fuer saugende Untergruende",
    },
    {
      name: "Pufas Tiefengrund LF",
      kategorie: "GRUNDIERUNG" as const,
      einheit: "Liter",
      ekPreis: 2.2,
      vkPreis: 3.8,
      ergiebigkeit: 10.0,
      anstriche: 1,
      notizen: "Loesemittelfreie Tiefengrundierung",
    },
    // Spachtelmasse
    {
      name: "Knauf Uniflott",
      kategorie: "SPACHTEL" as const,
      einheit: "kg",
      ekPreis: 1.5,
      vkPreis: 3.0,
      ergiebigkeit: 1.5,
      anstriche: 1,
      notizen: "Fugenspachtel fuer Gipsplatten und Risse",
    },
    {
      name: "Caparol AcrylSpachtel",
      kategorie: "SPACHTEL" as const,
      einheit: "kg",
      ekPreis: 2.0,
      vkPreis: 3.5,
      ergiebigkeit: 2.0,
      anstriche: 1,
      notizen: "Fertigspachtel fuer kleine Ausbesserungen",
    },
    // Verbrauchsmaterial (VERBRAUCH-Kategorie fuer Kalkulations-Engine)
    {
      name: "tesa Malerkrepp 50m",
      kategorie: "VERBRAUCH" as const,
      einheit: "Rolle",
      ekPreis: 3.5,
      vkPreis: 5.5,
      ergiebigkeit: null,
      anstriche: null,
      notizen: "Abklebeband 38mm x 50m, saubere Kanten",
    },
    {
      name: "HDPE Abdeckfolie 4x5m",
      kategorie: "VERBRAUCH" as const,
      einheit: "Stueck",
      ekPreis: 1.2,
      vkPreis: 2.5,
      ergiebigkeit: null,
      anstriche: null,
      notizen: "Abdeckfolie 4x5m, 50um",
    },
    {
      name: "Acryl weiss 310ml",
      kategorie: "VERBRAUCH" as const,
      einheit: "Kartusche",
      ekPreis: 2.0,
      vkPreis: 4.0,
      ergiebigkeit: null,
      anstriche: null,
      notizen: "Maleracryl fuer Fugen und Anschluesse",
    },
  ];

  for (const mat of materialien) {
    await prisma.material.upsert({
      where: {
        firmaId_name: { firmaId: firma.id, name: mat.name },
      },
      update: {
        kategorie: mat.kategorie,
        einheit: mat.einheit,
        ekPreis: mat.ekPreis,
        vkPreis: mat.vkPreis,
        ergiebigkeit: mat.ergiebigkeit,
        anstriche: mat.anstriche,
        notizen: mat.notizen,
      },
      create: {
        firmaId: firma.id,
        name: mat.name,
        kategorie: mat.kategorie,
        einheit: mat.einheit,
        ekPreis: mat.ekPreis,
        vkPreis: mat.vkPreis,
        ergiebigkeit: mat.ergiebigkeit,
        anstriche: mat.anstriche,
        notizen: mat.notizen,
        aktiv: true,
      },
    });
  }
  console.log(`${materialien.length} Materialien angelegt`);

  // ═══════════════════════════════════════════
  // LEISTUNGEN
  // ═══════════════════════════════════════════

  const leistungen = [
    {
      name: "Waende streichen Standard",
      kategorie: "STREICHEN" as const,
      einheit: "m2",
      preisProEinheit: 8.5,
      materialKat: "WANDFARBE" as const,
      beschreibung: "Waende streichen mit Standard-Farbe, 2 Anstriche",
    },
    {
      name: "Waende streichen Premium",
      kategorie: "STREICHEN" as const,
      einheit: "m2",
      preisProEinheit: 12.0,
      materialKat: "WANDFARBE" as const,
      beschreibung: "Waende streichen mit Premium-Farbe, 2 Anstriche",
    },
    {
      name: "Decke streichen Standard",
      kategorie: "STREICHEN" as const,
      einheit: "m2",
      preisProEinheit: 10.0,
      materialKat: "WANDFARBE" as const,
      beschreibung: "Decke streichen mit Standard-Farbe, 2 Anstriche",
    },
    {
      name: "Decke streichen Premium",
      kategorie: "STREICHEN" as const,
      einheit: "m2",
      preisProEinheit: 14.0,
      materialKat: "WANDFARBE" as const,
      beschreibung: "Decke streichen mit Premium-Farbe, 2 Anstriche",
    },
    {
      name: "Grundierung auftragen",
      kategorie: "VORBEREITUNG" as const,
      einheit: "m2",
      preisProEinheit: 3.5,
      materialKat: "GRUNDIERUNG" as const,
      beschreibung: "Tiefengrund auf saugende Untergruende auftragen",
    },
    {
      name: "Spachteln / Risse ausbessern",
      kategorie: "VORBEREITUNG" as const,
      einheit: "m2",
      preisProEinheit: 15.0,
      materialKat: "SPACHTEL" as const,
      beschreibung: "Risse und Unebenheiten spachteln und schleifen",
    },
    {
      name: "Tapete entfernen",
      kategorie: "TAPEZIEREN" as const,
      einheit: "m2",
      preisProEinheit: 6.0,
      materialKat: null,
      beschreibung: "Alte Tapete abloesen und Untergrund vorbereiten",
    },
    {
      name: "Abkleben & Abdecken",
      kategorie: "VORBEREITUNG" as const,
      einheit: "pauschal",
      preisProEinheit: 25.0,
      materialKat: null,
      beschreibung: "Fenster, Tuerrahmen, Boeden abkleben und abdecken",
    },
  ];

  for (const lst of leistungen) {
    await prisma.leistung.upsert({
      where: {
        firmaId_name: { firmaId: firma.id, name: lst.name },
      },
      update: {
        kategorie: lst.kategorie,
        einheit: lst.einheit,
        preisProEinheit: lst.preisProEinheit,
        materialKat: lst.materialKat,
        beschreibung: lst.beschreibung,
      },
      create: {
        firmaId: firma.id,
        name: lst.name,
        kategorie: lst.kategorie,
        einheit: lst.einheit,
        preisProEinheit: lst.preisProEinheit,
        materialKat: lst.materialKat,
        beschreibung: lst.beschreibung,
        aktiv: true,
      },
    });
  }
  console.log(`${leistungen.length} Leistungen angelegt`);

  // ═══════════════════════════════════════════
  // KALKULATIONS-REGELN (Update falls noetig)
  // ═══════════════════════════════════════════

  await prisma.kalkulationsRegeln.upsert({
    where: { firmaId: firma.id },
    update: {
      verschnittFaktor: 10.0,
      standardAnstriche: 2,
      grundierungImmer: true,
      abklebebandProRaum: 2,
      abdeckfolieProRaum: 1,
      acrylProRaum: 1,
      anfahrtKlein: 35.0,
      anfahrtGross: 55.0,
      anfahrtSchwelle: 3,
      fensterAbzug: 1.5,
      tuerAbzug: 2.0,
    },
    create: {
      firmaId: firma.id,
      verschnittFaktor: 10.0,
      standardAnstriche: 2,
      grundierungImmer: true,
      abklebebandProRaum: 2,
      abdeckfolieProRaum: 1,
      acrylProRaum: 1,
      anfahrtKlein: 35.0,
      anfahrtGross: 55.0,
      anfahrtSchwelle: 3,
      fensterAbzug: 1.5,
      tuerAbzug: 2.0,
    },
  });
  console.log(`Kalkulationsregeln aktualisiert`);

  // ═══════════════════════════════════════════
  // RAUM-VORLAGEN
  // ═══════════════════════════════════════════

  const raumvorlagen = [
    { name: "Wohnzimmer (gross)", laenge: 5.5, breite: 4.5, hoehe: 2.55, fenster: 2, tueren: 1 },
    { name: "Wohnzimmer (mittel)", laenge: 4.5, breite: 3.8, hoehe: 2.55, fenster: 1, tueren: 1 },
    { name: "Schlafzimmer", laenge: 4.0, breite: 3.5, hoehe: 2.55, fenster: 1, tueren: 1 },
    { name: "Kinderzimmer", laenge: 3.5, breite: 3.0, hoehe: 2.55, fenster: 1, tueren: 1 },
    { name: "Kueche", laenge: 3.5, breite: 2.8, hoehe: 2.55, fenster: 1, tueren: 1 },
    { name: "Bad", laenge: 2.5, breite: 2.0, hoehe: 2.55, fenster: 1, tueren: 1 },
    { name: "Flur", laenge: 5.0, breite: 1.5, hoehe: 2.55, fenster: 0, tueren: 3 },
    { name: "Buero", laenge: 3.5, breite: 3.0, hoehe: 2.55, fenster: 1, tueren: 1 },
    { name: "Gaestezimmer", laenge: 3.5, breite: 3.0, hoehe: 2.55, fenster: 1, tueren: 1 },
    { name: "Altbau Wohnzimmer", laenge: 5.0, breite: 4.5, hoehe: 3.20, fenster: 2, tueren: 2 },
  ];

  for (const rv of raumvorlagen) {
    await prisma.raumVorlage.upsert({
      where: {
        firmaId_name: { firmaId: firma.id, name: rv.name },
      },
      update: {
        laenge: rv.laenge,
        breite: rv.breite,
        hoehe: rv.hoehe,
        fenster: rv.fenster,
        tueren: rv.tueren,
      },
      create: {
        firmaId: firma.id,
        name: rv.name,
        laenge: rv.laenge,
        breite: rv.breite,
        hoehe: rv.hoehe,
        fenster: rv.fenster,
        tueren: rv.tueren,
      },
    });
  }
  console.log(`${raumvorlagen.length} Raumvorlagen angelegt`);

  // ═══════════════════════════════════════════
  // ZUSCHLAEGE & RABATTE
  // ═══════════════════════════════════════════

  const zuschlaege = [
    { name: "Wochenend-Zuschlag", typ: "PROZENT" as const, wert: 25.0 },
    { name: "Eilzuschlag", typ: "PROZENT" as const, wert: 15.0 },
    { name: "Hoehenzuschlag", typ: "PROZENT" as const, wert: 20.0 },
  ];

  for (const z of zuschlaege) {
    const existing = await prisma.zuschlag.findFirst({
      where: { firmaId: firma.id, name: z.name },
    });
    if (!existing) {
      await prisma.zuschlag.create({
        data: { firmaId: firma.id, name: z.name, typ: z.typ, wert: z.wert, aktiv: true },
      });
    }
  }
  console.log(`${zuschlaege.length} Zuschlaege angelegt`);

  const rabatte = [
    { name: "Neukunden-Rabatt", typ: "PROZENT" as const, wert: 5.0 },
    { name: "Grossauftrag-Rabatt", typ: "PROZENT" as const, wert: 10.0 },
    { name: "Stammkunden-Rabatt", typ: "PROZENT" as const, wert: 8.0 },
  ];

  for (const r of rabatte) {
    const existing = await prisma.rabatt.findFirst({
      where: { firmaId: firma.id, name: r.name },
    });
    if (!existing) {
      await prisma.rabatt.create({
        data: { firmaId: firma.id, name: r.name, typ: r.typ, wert: r.wert, aktiv: true },
      });
    }
  }
  console.log(`${rabatte.length} Rabatte angelegt`);

  // ═══════════════════════════════════════════
  // TEXT-VORLAGEN
  // ═══════════════════════════════════════════

  const textvorlagen = [
    {
      name: "Standard Einleitung",
      typ: "ANGEBOT_INTRO" as const,
      text: "Vielen Dank fuer Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot fuer die gewuenschten Malerarbeiten:",
    },
    {
      name: "Standard Schluss",
      typ: "ANGEBOT_SCHLUSS" as const,
      text: "Wir freuen uns auf Ihren Auftrag und stehen fuer Rueckfragen jederzeit zur Verfuegung. Die Arbeiten koennen nach Auftragsbestaetigung innerhalb von 2 Wochen begonnen werden.",
    },
    {
      name: "Follow-Up Tag 3",
      typ: "FOLLOWUP_TAG3" as const,
      text: "Sehr geehrte(r) {KUNDE}, wir hoffen, unser Angebot vom {DATUM} entspricht Ihren Vorstellungen. Haben Sie noch Fragen? Wir beraten Sie gerne!",
    },
    {
      name: "Follow-Up Tag 7",
      typ: "FOLLOWUP_TAG7" as const,
      text: "Sehr geehrte(r) {KUNDE}, wir moechten uns erkundigen, ob Sie unser Angebot vom {DATUM} erhalten haben und ob wir Ihnen weiterhelfen koennen.",
    },
  ];

  for (const tv of textvorlagen) {
    const existing = await prisma.textVorlage.findFirst({
      where: { firmaId: firma.id, name: tv.name },
    });
    if (!existing) {
      await prisma.textVorlage.create({
        data: { firmaId: firma.id, name: tv.name, typ: tv.typ, text: tv.text },
      });
    }
  }
  console.log(`${textvorlagen.length} Textvorlagen angelegt`);

  console.log("\nAlle Seed-Daten erfolgreich angelegt!\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
