import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    const komplexe = await prisma.komplex.findMany({
      where: { firmaId: user.firmaId },
      include: { unterkuenfte: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(komplexe);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const komplex = await prisma.komplex.create({
      data: {
        firmaId: user.firmaId,
        name: body.name,
        beschreibung: body.beschreibung || null,
      },
      include: { unterkuenfte: true },
    });

    return NextResponse.json(komplex);
  } catch (error) {
    console.error("Komplex erstellen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}
