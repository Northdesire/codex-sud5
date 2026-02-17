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

    const existing = await prisma.kunde.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const kunde = await prisma.kunde.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        typ: body.typ ?? existing.typ,
        strasse: body.strasse ?? existing.strasse,
        plz: body.plz ?? existing.plz,
        ort: body.ort ?? existing.ort,
        email: body.email ?? existing.email,
        telefon: body.telefon ?? existing.telefon,
        notizen: body.notizen ?? existing.notizen,
      },
    });
    return NextResponse.json(kunde);
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

    const existing = await prisma.kunde.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    await prisma.kunde.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
