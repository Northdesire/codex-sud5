import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  kalkuliere,
  DEFAULT_REGELN,
  type Raum,
  type KalkOptionen,
  type MaterialInfo,
  type LeistungInfo,
  type KalkRegeln,
  type ZuschlagInfo,
  type RabattInfo,
} from "@/lib/kalkulation";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const { kunde, raeume: rawRaeume, optionen: rawOptionen } = body;

    // Räume aufbereiten
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

    // Daten aus der DB laden
    const [materialien, leistungen, kalkRegeln, firma, zuschlaege, rabatte] = await Promise.all([
      prisma.material.findMany({
        where: { firmaId: user.firmaId, aktiv: true },
      }),
      prisma.leistung.findMany({
        where: { firmaId: user.firmaId, aktiv: true },
      }),
      prisma.kalkulationsRegeln.findFirst({
        where: { firmaId: user.firmaId },
      }),
      prisma.firma.findUnique({ where: { id: user.firmaId } }),
      prisma.zuschlag.findMany({
        where: { firmaId: user.firmaId, aktiv: true },
      }),
      prisma.rabatt.findMany({
        where: { firmaId: user.firmaId, aktiv: true },
      }),
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

    // Zuschläge & Rabatte aufbereiten
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

    // Kalkulation durchführen
    const ergebnis = kalkuliere(
      raeume,
      optionen,
      regeln,
      matInfos,
      leistInfos,
      mwstSatz,
      zuschlagInfos,
      rabattInfos
    );

    return NextResponse.json({
      ...ergebnis,
      kunde,
      firma: firma
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
        : null,
    });
  } catch (error) {
    console.error("Kalkulation Fehler:", error);
    return NextResponse.json(
      { error: "Fehler bei der Kalkulation" },
      { status: 500 }
    );
  }
}
