import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const angebot = await prisma.angebot.findFirst({
      where: { id, firmaId: user.firmaId },
      include: {
        positionen: { orderBy: { sortierung: "asc" } },
        firma: true,
      },
    });

    if (!angebot) {
      return NextResponse.json(
        { error: "Angebot nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json(angebot);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existing = await prisma.angebot.findFirst({
      where: { id, firmaId: user.firmaId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Angebot nicht gefunden" },
        { status: 404 }
      );
    }

    // Full edit: positionen + summen + kunde
    if (body.positionen) {
      const result = await prisma.$transaction(async (tx) => {
        // Delete old positions
        await tx.angebotPosition.deleteMany({ where: { angebotId: id } });

        // Update Angebot with new data
        const updated = await tx.angebot.update({
          where: { id },
          data: {
            kundeName: body.kundeName ?? existing.kundeName,
            kundeStrasse: body.kundeStrasse ?? existing.kundeStrasse,
            kundePlz: body.kundePlz ?? existing.kundePlz,
            kundeOrt: body.kundeOrt ?? existing.kundeOrt,
            kundeEmail: body.kundeEmail ?? existing.kundeEmail,
            kundeTelefon: body.kundeTelefon ?? existing.kundeTelefon,
            materialNetto: body.materialNetto,
            arbeitsNetto: body.arbeitsNetto,
            anfahrt: body.anfahrt,
            zuschlagNetto: body.zuschlagNetto ?? 0,
            rabattNetto: body.rabattNetto ?? 0,
            netto: body.netto,
            mwstBetrag: body.mwstBetrag,
            brutto: body.brutto,
            einleitungsText: body.einleitungsText ?? existing.einleitungsText,
            schlussText: body.schlussText ?? existing.schlussText,
            positionen: {
              create: body.positionen.map(
                (p: { posNr: number; typ: string; raumName?: string; bezeichnung: string; menge: number; einheit: string; einzelpreis: number; gesamtpreis: number }, i: number) => ({
                  posNr: p.posNr,
                  typ: p.typ,
                  raumName: p.raumName || null,
                  bezeichnung: p.bezeichnung,
                  menge: p.menge,
                  einheit: p.einheit,
                  einzelpreis: p.einzelpreis,
                  gesamtpreis: p.gesamtpreis,
                  sortierung: i,
                })
              ),
            },
          },
          include: { positionen: { orderBy: { sortierung: "asc" } }, firma: true },
        });

        return updated;
      });

      return NextResponse.json(result);
    }

    // Simple status update
    const updateData: Record<string, unknown> = {};

    if (body.status) {
      updateData.status = body.status;
      updateData.statusAenderung = new Date();
    }

    const angebot = await prisma.angebot.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(angebot);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    // Verify ownership
    const existing = await prisma.angebot.findFirst({
      where: { id, firmaId: user.firmaId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Angebot nicht gefunden" },
        { status: 404 }
      );
    }

    await prisma.angebot.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
