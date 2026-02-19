import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    const firma = await prisma.firma.findUnique({
      where: { id: user.firmaId },
      select: { branche: true },
    });

    return NextResponse.json({ branche: firma?.branche ?? "MALER" });
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
