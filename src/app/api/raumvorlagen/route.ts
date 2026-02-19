import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    const vorlagen = await prisma.raumVorlage.findMany({
      where: { firmaId: user.firmaId },
      orderBy: { sortierung: "asc" },
    });

    return NextResponse.json(vorlagen);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
