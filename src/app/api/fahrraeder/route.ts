import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    const fahrraeder = await prisma.fahrrad.findMany({
      where: { firmaId: user.firmaId },
      include: {
        preise: { orderBy: { tag: "asc" } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(fahrraeder);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const preise: Array<{ tag: number; gesamtpreis: number }> = body.preise || [];

    const fahrrad = await prisma.$transaction(async (tx) => {
      const created = await tx.fahrrad.create({
        data: {
          firmaId: user.firmaId,
          name: body.name,
          kategorie: body.kategorie || "",
          beschreibung: body.beschreibung || null,
          aktiv: body.aktiv ?? true,
          preisProWeitererTag: body.preisProWeitererTag != null && body.preisProWeitererTag !== "" ? parseFloat(String(body.preisProWeitererTag)) : null,
        },
      });

      if (preise.length > 0) {
        await tx.fahrradPreis.createMany({
          data: preise.map((p) => ({
            fahrradId: created.id,
            tag: p.tag,
            gesamtpreis: parseFloat(String(p.gesamtpreis)),
          })),
        });
      }

      return tx.fahrrad.findUnique({
        where: { id: created.id },
        include: {
          preise: { orderBy: { tag: "asc" } },
        },
      });
    });

    return NextResponse.json(fahrrad);
  } catch (error) {
    console.error("Fahrrad erstellen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}
