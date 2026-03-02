import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const unterkunft = await prisma.unterkunft.findFirst({
      where: { id, firmaId: user.firmaId },
      include: {
        komplex: true,
        saisonPreise: { include: { saison: true } },
      },
    });
    if (!unterkunft) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(unterkunft);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.unterkunft.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const saisonPreise: Array<{ saisonId: string; preisProNacht: number; gastPreise?: Record<string, number> | null }> = body.saisonPreise || [];

    const unterkunft = await prisma.$transaction(async (tx) => {
      await tx.unterkunft.update({
        where: { id },
        data: {
          name: body.name,
          beschreibung: body.beschreibung || null,
          typ: body.typ || existing.typ,
          kapazitaet: parseInt(body.kapazitaet),
          preisProNacht: parseFloat(body.preisProNacht),
          gastPreise: body.gastPreise ? body.gastPreise : body.gastPreise === null ? Prisma.DbNull : undefined,
          aktiv: body.aktiv ?? true,
          komplexId: body.komplexId || null,
          icalUrl: body.icalUrl || null,
        },
      });

      // Replace all season prices
      await tx.unterkunftPreis.deleteMany({ where: { unterkunftId: id } });
      if (saisonPreise.length > 0) {
        await tx.unterkunftPreis.createMany({
          data: saisonPreise.map((sp) => ({
            unterkunftId: id,
            saisonId: sp.saisonId,
            preisProNacht: parseFloat(String(sp.preisProNacht)),
            gastPreise: sp.gastPreise || undefined,
          })),
        });
      }

      return tx.unterkunft.findUnique({
        where: { id },
        include: {
          komplex: true,
          saisonPreise: { include: { saison: true } },
        },
      });
    });

    return NextResponse.json(unterkunft);
  } catch (error) {
    console.error("Unterkunft update Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Aktualisieren" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const existing = await prisma.unterkunft.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    await prisma.unterkunft.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unterkunft löschen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
