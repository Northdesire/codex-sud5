import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    const angebote = await prisma.angebot.findMany({
      where: { firmaId: user.firmaId },
      orderBy: { createdAt: "desc" },
      include: {
        positionen: {
          orderBy: { sortierung: "asc" },
        },
        firma: true,
        rechnung: { select: { id: true, nummer: true } },
      },
    });

    return NextResponse.json(angebote);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const {
      kunde,
      positionen,
      materialNetto,
      arbeitsNetto,
      anfahrt,
      zuschlagNetto,
      rabattNetto,
      netto,
      mwstSatz,
      mwstBetrag,
      brutto,
      eingabeMethode,
      originalText,
      einleitungsText,
      schlussText,
      raeume,
      // FEWO-spezifische Felder
      anreise,
      abreise,
      naechte,
      personen,
    } = body;

    // Transaction: increment counter + create Angebot + Positionen
    const angebot = await prisma.$transaction(async (tx) => {
      // Get firma and increment nrCounter
      const firma = await tx.firma.update({
        where: { id: user.firmaId },
        data: { nrCounter: { increment: 1 } },
      });

      const nummer = `${firma.nrPrefix}${String(firma.nrCounter).padStart(3, "0")}`;

      const gueltigBis = new Date();
      gueltigBis.setDate(gueltigBis.getDate() + (firma.angebotsGueltig || 14));

      // Find or create Kunde
      let kundeId: string | null = null;
      if (kunde.name) {
        const existing = await tx.kunde.findFirst({
          where: {
            firmaId: user.firmaId,
            name: kunde.name,
          },
        });

        if (existing) {
          kundeId = existing.id;
          // Update Kundendaten falls neue Infos vorhanden
          await tx.kunde.update({
            where: { id: existing.id },
            data: {
              strasse: kunde.strasse || existing.strasse,
              plz: kunde.plz || existing.plz,
              ort: kunde.ort || existing.ort,
              email: kunde.email?.trim() || existing.email,
              telefon: kunde.telefon || existing.telefon,
            },
          });
        } else {
          const created = await tx.kunde.create({
            data: {
              firmaId: user.firmaId,
              name: kunde.name,
              strasse: kunde.strasse || null,
              plz: kunde.plz || null,
              ort: kunde.ort || null,
              email: kunde.email?.trim() || null,
              telefon: kunde.telefon || null,
            },
          });
          kundeId = created.id;
        }
      }

      // Create Angebot with denormalized Kundendaten
      const created = await tx.angebot.create({
        data: {
          firmaId: user.firmaId,
          kundeId,
          nummer,
          datum: new Date(),
          gueltigBis,
          status: "ENTWURF",
          eingabeMethode: eingabeMethode || "FORMULAR",
          originalText: originalText || null,
          kundeName: kunde.name,
          kundeStrasse: kunde.strasse || null,
          kundePlz: kunde.plz || null,
          kundeOrt: kunde.ort || null,
          kundeEmail: kunde.email?.trim() || null,
          kundeTelefon: kunde.telefon || null,
          materialNetto,
          arbeitsNetto,
          anfahrt,
          zuschlagNetto: zuschlagNetto || 0,
          rabattNetto: rabattNetto || 0,
          netto,
          mwstBetrag,
          brutto,
          einleitungsText: einleitungsText || null,
          schlussText: schlussText || null,
          anreise: anreise ? new Date(anreise) : null,
          abreise: abreise ? new Date(abreise) : null,
          naechte: naechte ?? null,
          personen: personen ?? null,
          positionen: {
            create: positionen.map(
              (
                p: {
                  posNr: number;
                  typ: string;
                  raumName?: string;
                  bezeichnung: string;
                  menge: number;
                  einheit: string;
                  einzelpreis: number;
                  gesamtpreis: number;
                  leistungId?: string;
                  materialId?: string;
                },
                index: number
              ) => {
                // Find matching raum data for this position
                const raum = p.raumName
                  ? raeume?.find(
                      (r: { name: string }) => r.name === p.raumName
                    )
                  : null;

                return {
                  posNr: p.posNr,
                  typ: p.typ,
                  raumName: p.raumName || null,
                  raumLaenge: raum?.laenge || null,
                  raumBreite: raum?.breite || null,
                  raumHoehe: raum?.hoehe || null,
                  raumFenster: raum?.fenster || null,
                  raumTueren: raum?.tueren || null,
                  wandflaeche: raum?.wandflaeche || null,
                  deckenflaeche: raum?.deckenflaeche || null,
                  bezeichnung: p.bezeichnung,
                  menge: p.menge,
                  einheit: p.einheit,
                  einzelpreis: p.einzelpreis,
                  gesamtpreis: p.gesamtpreis,
                  leistungId: p.leistungId || null,
                  materialId: p.materialId || null,
                  sortierung: index,
                };
              }
            ),
          },
        },
        include: { positionen: true },
      });

      return created;
    });

    return NextResponse.json(angebot);
  } catch (error) {
    console.error("Angebot erstellen Fehler:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen" },
      { status: 500 }
    );
  }
}
