import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.produkt.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const produkt = await prisma.produkt.update({
      where: { id },
      data: {
        name: body.name,
        kategorie: body.kategorie,
        artikelNr: body.artikelNr || null,
        beschreibung: body.beschreibung || null,
        ekPreis: parseFloat(body.ekPreis),
        vkPreis: parseFloat(body.vkPreis),
        einheit: body.einheit || "Stk.",
        aktiv: body.aktiv ?? true,
      },
    });

    return NextResponse.json(produkt);
  } catch (error) {
    console.error("Produkt update Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Aktualisieren" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const existing = await prisma.produkt.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    await prisma.produkt.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Produkt löschen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
