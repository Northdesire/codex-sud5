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

    const existing = await prisma.leistung.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const leistung = await prisma.leistung.update({
      where: { id },
      data: {
        name: body.name,
        kategorie: body.kategorie,
        einheit: body.einheit,
        preisProEinheit: parseFloat(body.preisProEinheit),
        sqmProStunde: body.sqmProStunde ? parseFloat(body.sqmProStunde) : null,
        materialKat: body.materialKat || null,
        beschreibung: body.beschreibung || null,
        aktiv: body.aktiv ?? true,
      },
    });

    return NextResponse.json(leistung);
  } catch (error) {
    console.error("Leistung update Fehler:", error);
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

    const existing = await prisma.leistung.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    await prisma.leistung.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Leistung löschen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
