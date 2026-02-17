import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const zuschlaege = await prisma.zuschlag.findMany({
      where: { firmaId: user.firmaId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(zuschlaege);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const zuschlag = await prisma.zuschlag.create({
      data: {
        firmaId: user.firmaId,
        name: body.name,
        typ: body.typ || "PROZENT",
        wert: body.wert,
        proEinheit: body.proEinheit || null,
        automatisch: body.automatisch || false,
        bedingung: body.bedingung || null,
        bedingungFeld: body.bedingungFeld || null,
        bedingungOp: body.bedingungOp || null,
        bedingungWert: body.bedingungWert ?? null,
        aktiv: true,
      },
    });

    return NextResponse.json(zuschlag);
  } catch (error) {
    console.error("Zuschlag erstellen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}
