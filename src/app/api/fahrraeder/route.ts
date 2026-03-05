import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fahrradPayloadSchema, parsePayload } from "@/lib/validation/category-inputs";

export async function GET() {
  try {
    const user = await requireUser();

    const fahrraeder = await prisma.fahrrad.findMany({
      where: { firmaId: user.firmaId },
      include: {
        preise: { orderBy: { tag: "asc" } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(fahrraeder);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = parsePayload(fahrradPayloadSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const data = parsed.data;

    const preise = data.preise;

    const fahrrad = await prisma.$transaction(async (tx) => {
      const created = await tx.fahrrad.create({
        data: {
          firmaId: user.firmaId,
          name: data.name,
          kategorie: data.kategorie,
          beschreibung: data.beschreibung,
          aktiv: data.aktiv,
          preisProWeitererTag: data.preisProWeitererTag,
        },
      });

      if (preise.length > 0) {
        await tx.fahrradPreis.createMany({
          data: preise.map((p) => ({
            fahrradId: created.id,
            tag: p.tag,
            gesamtpreis: p.gesamtpreis,
          })),
        });
      }

      return tx.fahrrad.findUnique({
        where: { id: created.id },
        include: {
          preise: { orderBy: { tag: "asc" } },
        },
      });
    });

    return NextResponse.json(fahrrad);
  } catch (error) {
    console.error("Fahrrad erstellen Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}
