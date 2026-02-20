import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const firmaId = user.firmaId;

    const firma = await prisma.firma.findUnique({
      where: { id: firmaId },
      select: { firmenname: true, strasse: true, iban: true, branche: true },
    });

    const branche = firma?.branche ?? "MALER";

    if (branche === "FEWO") {
      const [unterkuenfteCount, saisonsCount, angeboteCount] = await Promise.all([
        prisma.unterkunft.count({ where: { firmaId } }),
        prisma.saison.count({ where: { firmaId } }),
        prisma.angebot.count({ where: { firmaId } }),
      ]);

      return NextResponse.json({
        branche,
        hasFirma: !!(firma?.firmenname && firma?.strasse),
        hasUnterkuenfte: unterkuenfteCount > 0,
        hasSaisons: saisonsCount > 0,
        hasAngebote: angeboteCount > 0,
        hasLeistungen: false,
        hasMaterial: false,
        hasKalkRegeln: false,
        hasProdukte: false,
      });
    }

    if (branche === "SHOP") {
      const [produkteCount, angeboteCount] = await Promise.all([
        prisma.produkt.count({ where: { firmaId } }),
        prisma.angebot.count({ where: { firmaId } }),
      ]);

      return NextResponse.json({
        branche,
        hasFirma: !!(firma?.firmenname && firma?.strasse),
        hasProdukte: produkteCount > 0,
        hasAngebote: angeboteCount > 0,
        hasLeistungen: false,
        hasMaterial: false,
        hasKalkRegeln: false,
      });
    }

    // MALER
    const [leistungenCount, materialCount, angeboteCount, kalkRegeln] =
      await Promise.all([
        prisma.leistung.count({ where: { firmaId } }),
        prisma.material.count({ where: { firmaId } }),
        prisma.angebot.count({ where: { firmaId } }),
        prisma.kalkulationsRegeln.findUnique({ where: { firmaId } }),
      ]);

    return NextResponse.json({
      branche,
      hasFirma: !!(firma?.firmenname && firma?.strasse),
      hasLeistungen: leistungenCount > 0,
      hasMaterial: materialCount > 0,
      hasKalkRegeln: !!kalkRegeln,
      hasAngebote: angeboteCount > 0,
      hasProdukte: false,
    });
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
