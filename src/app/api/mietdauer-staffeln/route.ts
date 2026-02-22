import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    const staffeln = await prisma.mietdauerStaffel.findMany({
      where: { firmaId: user.firmaId },
      orderBy: { bisTag: "asc" },
    });

    return NextResponse.json(staffeln);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const staffel = await prisma.mietdauerStaffel.create({
      data: {
        firmaId: user.firmaId,
        name: body.name,
        bisTag: parseInt(body.bisTag),
      },
    });

    return NextResponse.json(staffel);
  } catch (error) {
    console.error("MietdauerStaffel erstellen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}
