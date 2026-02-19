import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  kalkuliere,
  kalkuliereV2,
  DEFAULT_REGELN,
  type Raum,
  type KalkOptionen,
  type Arbeitsbereich,
  type MaterialInfo,
  type LeistungInfo,
  type KalkRegeln,
  type ZuschlagInfo,
  type RabattInfo,
  type ExtraInfo,
} from "@/lib/kalkulation";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const { kunde, selectedMaterials, extras: rawExtras } = body;

    // Format-Erkennung: neues V2-Format vs. altes Format
    const isV2 = Array.isArray(body.arbeitsbereiche);

    if (!isV2) {
      // --- ALTES FORMAT (Backward-Compat) ---
      const { raeume: rawRaeume, optionen: rawOptionen } = body;

      if (!rawRaeume || !Array.isArray(rawRaeume) || rawRaeume.length === 0) {
        return NextResponse.json(
          { error: "Mindestens ein Raum muss angegeben werden" },
          { status: 400 }
        );
      }

      const raeume: Raum[] = rawRaeume.map(
        (r: { name: string; laenge: number; breite: number; hoehe: number; fenster: number; tueren: number }) => ({
          name: r.name,
          laenge: r.laenge,
          breite: r.breite,
          hoehe: r.hoehe,
          fenster: r.fenster ?? 1,
          tueren: r.tueren ?? 1,
          decke: rawOptionen?.decke ?? false,
        })
      );

      const optionen: KalkOptionen = {
        qualitaet: rawOptionen?.qualitaet || "standard",
        spachteln: rawOptionen?.spachteln || false,
        tapeteEntfernen: rawOptionen?.tapeteEntfernen || false,
        grundierung: true,
      };

      const { regeln, matInfos, leistInfos, mwstSatz, zuschlagInfos, rabattInfos, firma } = await loadKalkData(user.firmaId);

      const extrasInfos = parseExtras(rawExtras);

      const ergebnis = kalkuliere(
        raeume,
        optionen,
        regeln,
        matInfos,
        leistInfos,
        mwstSatz,
        zuschlagInfos,
        rabattInfos,
        selectedMaterials,
        extrasInfos
      );

      return NextResponse.json({
        ...ergebnis,
        kunde,
        firma: firmaResponse(firma),
      });
    }

    // --- NEUES V2-FORMAT ---
    const rawBereiche = body.arbeitsbereiche as Arbeitsbereich[];

    if (rawBereiche.length === 0) {
      return NextResponse.json(
        { error: "Mindestens ein Arbeitsbereich muss angegeben werden" },
        { status: 400 }
      );
    }

    const qualitaet = body.qualitaet || "standard";
    const customAnfahrt = typeof body.anfahrt === "number" ? body.anfahrt : undefined;
    const { regeln, matInfos, leistInfos, mwstSatz, zuschlagInfos, rabattInfos, firma } = await loadKalkData(user.firmaId);
    const extrasInfos = parseExtras(rawExtras);

    const ergebnis = kalkuliereV2(
      rawBereiche,
      qualitaet,
      regeln,
      matInfos,
      leistInfos,
      mwstSatz,
      zuschlagInfos,
      rabattInfos,
      selectedMaterials,
      extrasInfos,
      customAnfahrt,
    );

    return NextResponse.json({
      ...ergebnis,
      kunde,
      firma: firmaResponse(firma),
    });
  } catch (error) {
    console.error("Kalkulation Fehler:", error);
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json(
      { error: `Kalkulation fehlgeschlagen: ${message}` },
      { status: 500 }
    );
  }
}

// --- Helpers ---

async function loadKalkData(firmaId: string) {
  const [materialien, leistungen, kalkRegeln, firma, zuschlaege, rabatte] = await Promise.all([
    prisma.material.findMany({ where: { firmaId, aktiv: true } }),
    prisma.leistung.findMany({ where: { firmaId, aktiv: true } }),
    prisma.kalkulationsRegeln.findFirst({ where: { firmaId } }),
    prisma.firma.findUnique({ where: { id: firmaId } }),
    prisma.zuschlag.findMany({ where: { firmaId, aktiv: true } }),
    prisma.rabatt.findMany({ where: { firmaId, aktiv: true } }),
  ]);

  const regeln: KalkRegeln = kalkRegeln
    ? {
        verschnittFaktor: kalkRegeln.verschnittFaktor,
        standardAnstriche: kalkRegeln.standardAnstriche,
        grundierungImmer: kalkRegeln.grundierungImmer,
        abklebebandProRaum: kalkRegeln.abklebebandProRaum,
        abdeckfolieProRaum: kalkRegeln.abdeckfolieProRaum,
        acrylProRaum: kalkRegeln.acrylProRaum,
        anfahrtKlein: kalkRegeln.anfahrtKlein,
        anfahrtGross: kalkRegeln.anfahrtGross,
        anfahrtSchwelle: kalkRegeln.anfahrtSchwelle,
        fensterAbzug: kalkRegeln.fensterAbzug,
        tuerAbzug: kalkRegeln.tuerAbzug,
      }
    : DEFAULT_REGELN;

  const matInfos: MaterialInfo[] = materialien.map((m) => ({
    id: m.id,
    name: m.name,
    kategorie: m.kategorie,
    vkPreis: m.vkPreis,
    einheit: m.einheit,
    ergiebigkeit: m.ergiebigkeit,
    anstriche: m.anstriche,
  }));

  const leistInfos: LeistungInfo[] = leistungen.map((l) => ({
    id: l.id,
    name: l.name,
    kategorie: l.kategorie,
    einheit: l.einheit,
    preisProEinheit: l.preisProEinheit,
    materialKat: l.materialKat,
  }));

  const mwstSatz = firma?.mwstSatz ?? 19.0;

  const zuschlagInfos: ZuschlagInfo[] = zuschlaege.map((z) => ({
    name: z.name,
    typ: z.typ as "PROZENT" | "PAUSCHAL",
    wert: z.wert,
  }));

  const rabattInfos: RabattInfo[] = rabatte.map((r) => ({
    name: r.name,
    typ: r.typ as "PROZENT" | "PAUSCHAL",
    wert: r.wert,
  }));

  return { regeln, matInfos, leistInfos, mwstSatz, zuschlagInfos, rabattInfos, firma };
}

function parseExtras(rawExtras: unknown): ExtraInfo[] {
  if (!Array.isArray(rawExtras)) return [];
  return rawExtras.map((e: { bezeichnung: string; kategorie: string; schaetzMenge: number; einheit: string; einzelpreis?: number }) => ({
    bezeichnung: e.bezeichnung || "",
    kategorie: e.kategorie || "SONSTIGES",
    schaetzMenge: e.schaetzMenge || 0,
    einheit: e.einheit || "pauschal",
    einzelpreis: e.einzelpreis,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firmaResponse(firma: any) {
  return firma
    ? {
        firmenname: firma.firmenname,
        inhaberName: firma.inhaberName,
        inhaberTitel: firma.inhaberTitel,
        strasse: firma.strasse,
        plz: firma.plz,
        ort: firma.ort,
        telefon: firma.telefon,
        email: firma.email,
        iban: firma.iban,
        bic: firma.bic,
        bankname: firma.bankname,
        nrPrefix: firma.nrPrefix,
        zahlungsziel: firma.zahlungsziel,
        steuernummer: firma.steuernummer,
        ustIdNr: firma.ustIdNr,
        agbText: firma.agbText,
      }
    : null;
}
