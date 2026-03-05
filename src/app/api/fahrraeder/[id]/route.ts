import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fahrradPayloadSchema, parsePayload } from "@/lib/validation/category-inputs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const parsed = parsePayload(fahrradPayloadSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await prisma.fahrrad.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const preise = data.preise;

    const fahrrad = await prisma.$transaction(async (tx) => {
      await tx.fahrrad.update({
        where: { id },
        data: {
          name: data.name,
          kategorie: data.kategorie,
          beschreibung: data.beschreibung,
          aktiv: data.aktiv,
          preisProWeitererTag: data.preisProWeitererTag,
        },
      });

      // Preise: alle löschen und neu anlegen
      await tx.fahrradPreis.deleteMany({ where: { fahrradId: id } });
      if (preise.length > 0) {
        await tx.fahrradPreis.createMany({
          data: preise.map((p) => ({
            fahrradId: id,
            tag: p.tag,
            gesamtpreis: p.gesamtpreis,
          })),
        });
      }

      return tx.fahrrad.findUnique({
        where: { id },
        include: {
          preise: { orderBy: { tag: "asc" } },
        },
      });
    });

    return NextResponse.json(fahrrad);
  } catch (error) {
    console.error("Fahrrad update Fehler:", error);
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

    const existing = await prisma.fahrrad.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    await prisma.fahrrad.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fahrrad löschen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
