import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const regeln = await prisma.kalkulationsRegeln.findUnique({
      where: { firmaId: user.firmaId },
    });
    return NextResponse.json(regeln);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const regeln = await prisma.kalkulationsRegeln.upsert({
      where: { firmaId: user.firmaId },
      create: {
        firmaId: user.firmaId,
        verschnittFaktor: body.verschnittFaktor ?? 10,
        standardAnstriche: body.standardAnstriche ?? 2,
        grundierungImmer: body.grundierungImmer ?? true,
        abklebebandProRaum: body.abklebebandProRaum ?? 2,
        abdeckfolieProRaum: body.abdeckfolieProRaum ?? 1,
        acrylProRaum: body.acrylProRaum ?? 0,
        anfahrtKlein: body.anfahrtKlein ?? 35,
        anfahrtGross: body.anfahrtGross ?? 55,
        anfahrtSchwelle: body.anfahrtSchwelle ?? 3,
        fensterAbzug: body.fensterAbzug ?? 1.5,
        tuerAbzug: body.tuerAbzug ?? 2.0,
        standardQualitaet: body.standardQualitaet ?? "standard",
        deckeStandard: body.deckeStandard ?? false,
        grundierungStandard: body.grundierungStandard ?? true,
        zuschlagAutoErkennen: body.zuschlagAutoErkennen ?? true,
      },
      update: {
        verschnittFaktor: body.verschnittFaktor,
        standardAnstriche: body.standardAnstriche,
        grundierungImmer: body.grundierungImmer,
        abklebebandProRaum: body.abklebebandProRaum,
        abdeckfolieProRaum: body.abdeckfolieProRaum,
        acrylProRaum: body.acrylProRaum,
        anfahrtKlein: body.anfahrtKlein,
        anfahrtGross: body.anfahrtGross,
        anfahrtSchwelle: body.anfahrtSchwelle,
        fensterAbzug: body.fensterAbzug,
        tuerAbzug: body.tuerAbzug,
        standardQualitaet: body.standardQualitaet,
        deckeStandard: body.deckeStandard,
        grundierungStandard: body.grundierungStandard,
        zuschlagAutoErkennen: body.zuschlagAutoErkennen,
      },
    });

    return NextResponse.json(regeln);
  } catch (error) {
    console.error("KalkRegeln Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}
