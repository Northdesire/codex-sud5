import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    const unterkuenfte = await prisma.unterkunft.findMany({
      where: { firmaId: user.firmaId },
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

    const unterkunft = await prisma.unterkunft.create({
      data: {
        firmaId: user.firmaId,
        name: body.name,
        beschreibung: body.beschreibung || null,
        kapazitaet: parseInt(body.kapazitaet),
        preisProNacht: parseFloat(body.preisProNacht),
        aktiv: body.aktiv ?? true,
      },
    });

    return NextResponse.json(unterkunft);
  } catch (error) {
    console.error("Unterkunft erstellen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}
