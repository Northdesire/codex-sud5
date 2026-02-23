import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    const preise = await prisma.auscheckPreis.findMany({
      where: { firmaId: user.firmaId },
      orderBy: { kategorie: "asc" },
    });

    return NextResponse.json(preise);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const { kategorie, preisOptionen } = body;
    if (!kategorie || !Array.isArray(preisOptionen)) {
      return NextResponse.json({ error: "kategorie und preisOptionen erforderlich" }, { status: 400 });
    }

    const result = await prisma.auscheckPreis.upsert({
      where: {
        firmaId_kategorie: {
          firmaId: user.firmaId,
          kategorie,
        },
      },
      update: {
        preisOptionen: preisOptionen.map(Number),
      },
      create: {
        firmaId: user.firmaId,
        kategorie,
        preisOptionen: preisOptionen.map(Number),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("AuscheckPreis upsert Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}
