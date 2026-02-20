import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    const saisons = await prisma.saison.findMany({
      where: { firmaId: user.firmaId },
      orderBy: { von: "asc" },
    });

    return NextResponse.json(saisons);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const saison = await prisma.saison.create({
      data: {
        firmaId: user.firmaId,
        name: body.name,
        von: new Date(body.von),
        bis: new Date(body.bis),
        faktor: parseFloat(body.faktor),
      },
    });

    return NextResponse.json(saison);
  } catch (error) {
    console.error("Saison erstellen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}
