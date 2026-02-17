import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.zuschlag.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const zuschlag = await prisma.zuschlag.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        typ: body.typ ?? existing.typ,
        wert: body.wert ?? existing.wert,
        proEinheit: body.proEinheit !== undefined ? body.proEinheit : existing.proEinheit,
        automatisch: body.automatisch ?? existing.automatisch,
        bedingung: body.bedingung !== undefined ? body.bedingung : existing.bedingung,
        bedingungFeld: body.bedingungFeld !== undefined ? body.bedingungFeld : existing.bedingungFeld,
        bedingungOp: body.bedingungOp !== undefined ? body.bedingungOp : existing.bedingungOp,
        bedingungWert: body.bedingungWert !== undefined ? body.bedingungWert : existing.bedingungWert,
        aktiv: body.aktiv ?? existing.aktiv,
      },
    });
    return NextResponse.json(zuschlag);
  } catch {
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const existing = await prisma.zuschlag.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    await prisma.zuschlag.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
