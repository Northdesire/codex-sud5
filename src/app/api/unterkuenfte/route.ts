import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    const unterkuenfte = await prisma.unterkunft.findMany({
      where: { firmaId: user.firmaId },
      include: {
        komplex: true,
        saisonPreise: { include: { saison: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(unterkuenfte);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const saisonPreise: Array<{ saisonId: string; preisProNacht: number }> = body.saisonPreise || [];

    const unterkunft = await prisma.$transaction(async (tx) => {
      const created = await tx.unterkunft.create({
        data: {
          firmaId: user.firmaId,
          name: body.name,
          beschreibung: body.beschreibung || null,
          typ: body.typ || "FERIENWOHNUNG",
          kapazitaet: parseInt(body.kapazitaet),
          preisProNacht: parseFloat(body.preisProNacht),
          aktiv: body.aktiv ?? true,
          komplexId: body.komplexId || null,
        },
      });

      if (saisonPreise.length > 0) {
        await tx.unterkunftPreis.createMany({
          data: saisonPreise.map((sp) => ({
            unterkunftId: created.id,
            saisonId: sp.saisonId,
            preisProNacht: parseFloat(String(sp.preisProNacht)),
          })),
        });
      }

      return tx.unterkunft.findUnique({
        where: { id: created.id },
        include: {
          komplex: true,
          saisonPreise: { include: { saison: true } },
        },
      });
    });

    return NextResponse.json(unterkunft);
  } catch (error) {
    console.error("Unterkunft erstellen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}
