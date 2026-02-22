import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    const fahrraeder = await prisma.fahrrad.findMany({
      where: { firmaId: user.firmaId },
      include: {
        staffelPreise: { include: { staffel: true } },
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

    const staffelPreise: Array<{ staffelId: string; preisProTag: number }> = body.staffelPreise || [];

    const fahrrad = await prisma.$transaction(async (tx) => {
      const created = await tx.fahrrad.create({
        data: {
          firmaId: user.firmaId,
          name: body.name,
          kategorie: body.kategorie || "",
          beschreibung: body.beschreibung || null,
          preisProTag: parseFloat(body.preisProTag),
          aktiv: body.aktiv ?? true,
        },
      });

      if (staffelPreise.length > 0) {
        await tx.fahrradPreis.createMany({
          data: staffelPreise.map((sp) => ({
            fahrradId: created.id,
            staffelId: sp.staffelId,
            preisProTag: parseFloat(String(sp.preisProTag)),
          })),
        });
      }

      return tx.fahrrad.findUnique({
        where: { id: created.id },
        include: {
          staffelPreise: { include: { staffel: true } },
        },
      });
    });

    return NextResponse.json(fahrrad);
  } catch (error) {
    console.error("Fahrrad erstellen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}
