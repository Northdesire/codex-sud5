import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const unterkunft = await prisma.unterkunft.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!unterkunft) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(unterkunft);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.unterkunft.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const unterkunft = await prisma.unterkunft.update({
      where: { id },
      data: {
        name: body.name,
        beschreibung: body.beschreibung || null,
        kapazitaet: parseInt(body.kapazitaet),
        preisProNacht: parseFloat(body.preisProNacht),
        aktiv: body.aktiv ?? true,
      },
    });

    return NextResponse.json(unterkunft);
  } catch (error) {
    console.error("Unterkunft update Fehler:", error);
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

    const existing = await prisma.unterkunft.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    await prisma.unterkunft.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unterkunft löschen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
