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

    const materialien = await prisma.material.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(materialien);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const material = await prisma.material.create({
      data: {
        firmaId: user.firmaId,
        name: body.name,
        kategorie: body.kategorie,
        artikelNr: body.artikelNr || null,
        ekPreis: parseFloat(body.ekPreis),
        vkPreis: parseFloat(body.vkPreis),
        einheit: body.einheit,
        ergiebigkeit: body.ergiebigkeit ? parseFloat(body.ergiebigkeit) : null,
        anstriche: body.anstriche ? parseInt(body.anstriche) : null,
        lieferant: body.lieferant || null,
        lieferantNr: body.lieferantNr || null,
        notizen: body.notizen || null,
      },
    });

    return NextResponse.json(material);
  } catch (error) {
    console.error("Material erstellen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}
