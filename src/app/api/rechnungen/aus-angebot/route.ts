import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { angebotId } = body;

    if (!angebotId) {
      return NextResponse.json({ error: "angebotId fehlt" }, { status: 400 });
    }

    // Branche-Guard
    const firma = await prisma.firma.findUnique({
      where: { id: user.firmaId },
    });
    if (!firma || firma.branche !== "SHOP") {
      return NextResponse.json(
        { error: "Rechnungen nur für SHOP-Branche verfügbar" },
        { status: 403 }
      );
    }

    // Angebot laden
    const angebot = await prisma.angebot.findFirst({
      where: { id: angebotId, firmaId: user.firmaId },
      include: {
        positionen: { orderBy: { sortierung: "asc" } },
      },
    });

    if (!angebot) {
      return NextResponse.json({ error: "Angebot nicht gefunden" }, { status: 404 });
    }

    if (angebot.status !== "ANGENOMMEN") {
      return NextResponse.json(
        { error: "Nur angenommene Angebote können in Rechnungen umgewandelt werden" },
        { status: 400 }
      );
    }

    // Check: Keine existierende Rechnung für dieses Angebot
    const existingRechnung = await prisma.rechnung.findUnique({
      where: { angebotId },
    });
    if (existingRechnung) {
      return NextResponse.json(
        { error: "Für dieses Angebot existiert bereits eine Rechnung", rechnungId: existingRechnung.id },
        { status: 409 }
      );
    }

    // TextVorlagen laden (optional)
    const introVorlage = await prisma.textVorlage.findFirst({
      where: { firmaId: user.firmaId, typ: "RECHNUNG_INTRO", aktiv: true },
    });
    const schlussVorlage = await prisma.textVorlage.findFirst({
      where: { firmaId: user.firmaId, typ: "RECHNUNG_SCHLUSS", aktiv: true },
    });

    // Transaction: increment counter + create Rechnung
    const rechnung = await prisma.$transaction(async (tx) => {
      const updatedFirma = await tx.firma.update({
        where: { id: user.firmaId },
        data: { rechnungNrCounter: { increment: 1 } },
      });

      const nummer = `${updatedFirma.rechnungNrPrefix}${String(updatedFirma.rechnungNrCounter).padStart(3, "0")}`;

      const faelligAm = new Date(Date.now() + (firma.zahlungsziel || 14) * 86400000);

      const created = await tx.rechnung.create({
        data: {
          firmaId: user.firmaId,
          kundeId: angebot.kundeId,
          angebotId: angebot.id,
          nummer,
          datum: new Date(),
          faelligAm,
          status: "ENTWURF",
          kundeName: angebot.kundeName,
          kundeStrasse: angebot.kundeStrasse,
          kundePlz: angebot.kundePlz,
          kundeOrt: angebot.kundeOrt,
          kundeEmail: angebot.kundeEmail,
          kundeTelefon: angebot.kundeTelefon,
          netto: angebot.netto,
          mwstSatz: firma.mwstSatz,
          mwstBetrag: angebot.mwstBetrag,
          brutto: angebot.brutto,
          einleitungsText: introVorlage?.text || null,
          schlussText: schlussVorlage?.text || null,
          positionen: {
            create: angebot.positionen.map((p, index) => ({
              posNr: p.posNr,
              typ: p.typ,
              bezeichnung: p.bezeichnung,
              menge: p.menge,
              einheit: p.einheit,
              einzelpreis: p.einzelpreis,
              gesamtpreis: p.gesamtpreis,
              sortierung: index,
            })),
          },
        },
      });

      return { id: created.id, nummer: created.nummer };
    });

    return NextResponse.json(rechnung);
  } catch (error) {
    console.error("Rechnung aus Angebot Fehler:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Rechnung" },
      { status: 500 }
    );
  }
}
