import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const { vonUnterkunftId, nachUnterkunftIds } = body as {
      vonUnterkunftId: string;
      nachUnterkunftIds: string[];
    };

    if (!vonUnterkunftId || !nachUnterkunftIds?.length) {
      return NextResponse.json({ error: "Quelle und Ziele erforderlich" }, { status: 400 });
    }

    // Verify source belongs to user's firma
    const quelle = await prisma.unterkunft.findFirst({
      where: { id: vonUnterkunftId, firmaId: user.firmaId },
      include: { saisonPreise: true },
    });
    if (!quelle) {
      return NextResponse.json({ error: "Quell-Unterkunft nicht gefunden" }, { status: 404 });
    }

    // Verify all targets belong to user's firma
    const ziele = await prisma.unterkunft.findMany({
      where: { id: { in: nachUnterkunftIds }, firmaId: user.firmaId },
    });
    if (ziele.length !== nachUnterkunftIds.length) {
      return NextResponse.json({ error: "Nicht alle Ziel-Unterkünfte gefunden" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      for (const zielId of nachUnterkunftIds) {
        // Copy Basispreis
        await tx.unterkunft.update({
          where: { id: zielId },
          data: { preisProNacht: quelle.preisProNacht },
        });

        // Replace season prices
        await tx.unterkunftPreis.deleteMany({ where: { unterkunftId: zielId } });
        if (quelle.saisonPreise.length > 0) {
          await tx.unterkunftPreis.createMany({
            data: quelle.saisonPreise.map((sp) => ({
              unterkunftId: zielId,
              saisonId: sp.saisonId,
              preisProNacht: sp.preisProNacht,
            })),
          });
        }
      }
    });

    return NextResponse.json({ success: true, kopiert: nachUnterkunftIds.length });
  } catch (error) {
    console.error("Preise kopieren Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Kopieren" }, { status: 500 });
  }
}
