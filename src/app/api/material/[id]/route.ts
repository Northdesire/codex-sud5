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

    // Sicherstellen, dass das Material zur Firma gehört
    const existing = await prisma.material.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const material = await prisma.material.update({
      where: { id },
      data: {
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
        aktiv: body.aktiv ?? true,
        notizen: body.notizen || null,
      },
    });

    return NextResponse.json(material);
  } catch (error) {
    console.error("Material update Fehler:", error);
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

    const existing = await prisma.material.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    await prisma.material.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Material löschen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
