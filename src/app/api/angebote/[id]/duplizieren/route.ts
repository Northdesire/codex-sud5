import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const original = await prisma.angebot.findFirst({
      where: { id, firmaId: user.firmaId },
      include: {
        positionen: { orderBy: { sortierung: "asc" } },
      },
    });

    if (!original) {
      return NextResponse.json({ error: "Angebot nicht gefunden" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const firma = await tx.firma.update({
        where: { id: user.firmaId },
        data: { nrCounter: { increment: 1 } },
      });

      const nummer = `${firma.nrPrefix}${String(firma.nrCounter).padStart(3, "0")}`;

      const gueltigBis = new Date();
      gueltigBis.setDate(gueltigBis.getDate() + (firma.angebotsGueltig || 14));

      const angebot = await tx.angebot.create({
        data: {
          firmaId: user.firmaId,
          kundeId: original.kundeId,
          nummer,
          datum: new Date(),
          gueltigBis,
          status: "ENTWURF",
          eingabeMethode: original.eingabeMethode,
          originalText: original.originalText,
          kundeName: original.kundeName,
          kundeStrasse: original.kundeStrasse,
          kundePlz: original.kundePlz,
          kundeOrt: original.kundeOrt,
          kundeEmail: original.kundeEmail,
          kundeTelefon: original.kundeTelefon,
          materialNetto: original.materialNetto,
          arbeitsNetto: original.arbeitsNetto,
          anfahrt: original.anfahrt,
          zuschlagNetto: original.zuschlagNetto,
          rabattNetto: original.rabattNetto,
          netto: original.netto,
          mwstBetrag: original.mwstBetrag,
          brutto: original.brutto,
          einleitungsText: original.einleitungsText,
          schlussText: original.schlussText,
          positionen: {
            create: original.positionen.map((p, i) => ({
              posNr: p.posNr,
              typ: p.typ,
              raumName: p.raumName,
              raumLaenge: p.raumLaenge,
              raumBreite: p.raumBreite,
              raumHoehe: p.raumHoehe,
              raumFenster: p.raumFenster,
              raumTueren: p.raumTueren,
              wandflaeche: p.wandflaeche,
              deckenflaeche: p.deckenflaeche,
              bezeichnung: p.bezeichnung,
              menge: p.menge,
              einheit: p.einheit,
              einzelpreis: p.einzelpreis,
              gesamtpreis: p.gesamtpreis,
              leistungId: p.leistungId,
              materialId: p.materialId,
              sortierung: i,
            })),
          },
        },
        include: { positionen: true },
      });

      return angebot;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Duplizieren Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Duplizieren" }, { status: 500 });
  }
}
