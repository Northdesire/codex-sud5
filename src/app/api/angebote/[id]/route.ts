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
