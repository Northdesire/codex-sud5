import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const kunden = await prisma.kunde.findMany({
      where: { firmaId: user.firmaId },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { angebote: true } },
      },
    });
    return NextResponse.json(kunden);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const kunde = await prisma.kunde.create({
      data: {
        firmaId: user.firmaId,
        name: body.name,
        typ: body.typ || "PRIVAT",
        strasse: body.strasse || null,
        plz: body.plz || null,
        ort: body.ort || null,
        email: body.email || null,
        telefon: body.telefon || null,
        notizen: body.notizen || null,
      },
    });
    return NextResponse.json(kunde);
  } catch (error) {
    console.error("Kunde erstellen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}
