import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parsePayload, produktPayloadSchema } from "@/lib/validation/category-inputs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const kategorie = searchParams.get("kategorie");

    const where: Record<string, unknown> = { firmaId: user.firmaId };
    if (kategorie) where.kategorie = kategorie;

    const produkte = await prisma.produkt.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(produkte);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = parsePayload(produktPayloadSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const data = parsed.data;

    const produkt = await prisma.produkt.create({
      data: {
        firmaId: user.firmaId,
        name: data.name,
        kategorie: data.kategorie,
        artikelNr: data.artikelNr,
        beschreibung: data.beschreibung,
        ekPreis: data.ekPreis,
        vkPreis: data.vkPreis,
        einheit: data.einheit,
      },
    });

    return NextResponse.json(produkt);
  } catch (error) {
    console.error("Produkt erstellen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}
