import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const vorlagen = await prisma.textVorlage.findMany({
      where: { firmaId: user.firmaId },
      orderBy: { typ: "asc" },
    });
    return NextResponse.json(vorlagen);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const vorlage = await prisma.textVorlage.create({
      data: {
        firmaId: user.firmaId,
        name: body.name,
        typ: body.typ,
        betreff: body.betreff || null,
        text: body.text,
        aktiv: body.aktiv ?? true,
      },
    });

    return NextResponse.json(vorlage);
  } catch (error) {
    console.error("TextVorlage erstellen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}
