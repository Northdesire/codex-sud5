import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// PATCH: Bulk update kategorie
export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const { ids, kategorie } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Keine IDs angegeben" }, { status: 400 });
    }
    if (!kategorie) {
      return NextResponse.json({ error: "Keine Kategorie angegeben" }, { status: 400 });
    }

    const result = await prisma.material.updateMany({
      where: { id: { in: ids }, firmaId: user.firmaId },
      data: { kategorie },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error("Bulk-Update Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Aktualisieren" }, { status: 500 });
  }
}

// DELETE: Bulk delete
export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Keine IDs angegeben" }, { status: 400 });
    }

    const result = await prisma.material.deleteMany({
      where: { id: { in: ids }, firmaId: user.firmaId },
    });

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("Bulk-Delete Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
