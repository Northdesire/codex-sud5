import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const kategorie = searchParams.get("kategorie");

    const where: Record<string, unknown> = { firmaId: user.firmaId };
    if (kategorie) where.kategorie = kategorie;

    const leistungen = await prisma.leistung.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(leistungen);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const leistung = await prisma.leistung.create({
      data: {
        firmaId: user.firmaId,
        name: body.name,
        kategorie: body.kategorie,
        einheit: body.einheit,
        preisProEinheit: parseFloat(body.preisProEinheit),
        sqmProStunde: body.sqmProStunde ? parseFloat(body.sqmProStunde) : null,
        materialKat: body.materialKat || null,
        beschreibung: body.beschreibung || null,
      },
    });

    return NextResponse.json(leistung);
  } catch (error) {
    console.error("Leistung erstellen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}
