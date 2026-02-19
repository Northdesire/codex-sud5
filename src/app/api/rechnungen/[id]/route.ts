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

    const rechnung = await prisma.rechnung.findFirst({
      where: { id, firmaId: user.firmaId },
      include: {
        positionen: { orderBy: { sortierung: "asc" } },
        firma: true,
      },
    });

    if (!rechnung) {
      return NextResponse.json(
        { error: "Rechnung nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json(rechnung);
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

    const existing = await prisma.rechnung.findFirst({
      where: { id, firmaId: user.firmaId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Rechnung nicht gefunden" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.status) {
      updateData.status = body.status;
      updateData.statusAenderung = new Date();
      if (body.status === "BEZAHLT") {
        updateData.bezahltAm = new Date();
      }
    }

    const rechnung = await prisma.rechnung.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(rechnung);
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

    const existing = await prisma.rechnung.findFirst({
      where: { id, firmaId: user.firmaId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Rechnung nicht gefunden" },
        { status: 404 }
      );
    }

    await prisma.rechnung.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
