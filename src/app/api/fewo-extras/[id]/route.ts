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

    const extra = await prisma.fewoExtra.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!extra) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(extra);
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

    const existing = await prisma.fewoExtra.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const extra = await prisma.fewoExtra.update({
      where: { id },
      data: {
        name: body.name,
        preis: parseFloat(body.preis),
        einheit: body.einheit || "pauschal",
        unterkunftTypen: body.unterkunftTypen ?? [],
        aktiv: body.aktiv ?? true,
      },
    });

    return NextResponse.json(extra);
  } catch (error) {
    console.error("FewoExtra update Fehler:", error);
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

    const existing = await prisma.fewoExtra.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    await prisma.fewoExtra.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("FewoExtra löschen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
