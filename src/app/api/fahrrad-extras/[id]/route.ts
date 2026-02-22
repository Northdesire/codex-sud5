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

    const existing = await prisma.fahrradExtra.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const extra = await prisma.fahrradExtra.update({
      where: { id },
      data: {
        name: body.name,
        preis: parseFloat(body.preis),
        einheit: body.einheit || "pauschal",
        aktiv: body.aktiv ?? true,
      },
    });

    return NextResponse.json(extra);
  } catch (error) {
    console.error("FahrradExtra update Fehler:", error);
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

    const existing = await prisma.fahrradExtra.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    await prisma.fahrradExtra.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("FahrradExtra löschen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
