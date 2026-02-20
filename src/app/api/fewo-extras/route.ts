import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    const extras = await prisma.fewoExtra.findMany({
      where: { firmaId: user.firmaId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(extras);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const extra = await prisma.fewoExtra.create({
      data: {
        firmaId: user.firmaId,
        name: body.name,
        preis: parseFloat(body.preis),
        einheit: body.einheit || "pauschal",
        aktiv: body.aktiv ?? true,
      },
    });

    return NextResponse.json(extra);
  } catch (error) {
    console.error("FewoExtra erstellen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}
