import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const rabatte = await prisma.rabatt.findMany({
      where: { firmaId: user.firmaId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(rabatte);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const rabatt = await prisma.rabatt.create({
      data: {
        firmaId: user.firmaId,
        name: body.name,
        typ: body.typ || "PROZENT",
        wert: body.wert,
        bedingung: body.bedingung || null,
        automatisch: body.automatisch || false,
        aktiv: true,
      },
    });

    return NextResponse.json(rabatt);
  } catch (error) {
    console.error("Rabatt erstellen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}
