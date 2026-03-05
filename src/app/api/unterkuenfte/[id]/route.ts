import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parsePayload, unterkunftPayloadSchema } from "@/lib/validation/category-inputs";

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
    const parsed = parsePayload(unterkunftPayloadSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await prisma.unterkunft.findFirst({
      where: { id, firmaId: user.firmaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const saisonPreise = data.saisonPreise;

    const unterkunft = await prisma.$transaction(async (tx) => {
      await tx.unterkunft.update({
        where: { id },
        data: {
          name: data.name,
          beschreibung: data.beschreibung,
          typ: data.typ || existing.typ,
          kapazitaet: data.kapazitaet,
          preisProNacht: data.preisProNacht,
          gastPreise: data.gastPreise === null ? Prisma.DbNull : data.gastPreise,
          aktiv: data.aktiv,
          komplexId: data.komplexId,
          icalUrl: data.icalUrl,
        },
      });

      // Replace all season prices
      await tx.unterkunftPreis.deleteMany({ where: { unterkunftId: id } });
      if (saisonPreise.length > 0) {
        await tx.unterkunftPreis.createMany({
          data: saisonPreise.map((sp) => ({
            unterkunftId: id,
            saisonId: sp.saisonId,
            preisProNacht: sp.preisProNacht,
            gastPreise: sp.gastPreise ?? undefined,
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
