import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();


    const rechnungen = await prisma.rechnung.findMany({
      where: { firmaId: user.firmaId },
      orderBy: { createdAt: "desc" },
      include: {
        positionen: { orderBy: { sortierung: "asc" } },
        firma: true,
      },
    });

    return NextResponse.json(rechnungen);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
