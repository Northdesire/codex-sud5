import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

interface ImportItem {
  name: string;
  typ: "MATERIAL" | "LEISTUNG";
  kategorie: string;
  leistungsKat?: string | null;
  ekPreis: number;
  vkPreis: number;
  preisProEinheit?: number | null;
  einheit: string;
  ergiebigkeit?: number | null;
  anstriche?: number | null;
  lieferant?: string | null;
  artikelNr?: string | null;
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { items }: { items: ImportItem[] } = await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "Keine Produkte zum Importieren" },
        { status: 400 }
      );
    }

    const materialien = items.filter((i) => i.typ === "MATERIAL");
    const leistungen = items.filter((i) => i.typ === "LEISTUNG");

    let materialCount = 0;
    let leistungCount = 0;
    let skipCount = 0;

    // Materialien importieren
    for (const m of materialien) {
      try {
        await prisma.material.upsert({
          where: {
            firmaId_name: {
              firmaId: user.firmaId,
              name: m.name,
            },
          },
          update: {
            ekPreis: m.ekPreis,
            vkPreis: m.vkPreis,
            einheit: m.einheit,
            ergiebigkeit: m.ergiebigkeit || null,
            anstriche: m.anstriche ? Math.round(m.anstriche) : null,
            lieferant: m.lieferant || null,
            artikelNr: m.artikelNr || null,
          },
          create: {
            firmaId: user.firmaId,
            name: m.name,
            kategorie: m.kategorie as "WANDFARBE" | "GRUNDIERUNG" | "SPACHTEL" | "LACK" | "VERBRAUCH" | "TAPETE" | "SONSTIGES",
            ekPreis: m.ekPreis,
            vkPreis: m.vkPreis,
            einheit: m.einheit,
            ergiebigkeit: m.ergiebigkeit || null,
            anstriche: m.anstriche ? Math.round(m.anstriche) : null,
            lieferant: m.lieferant || null,
            artikelNr: m.artikelNr || null,
          },
        });
        materialCount++;
      } catch {
        skipCount++;
      }
    }

    // Leistungen importieren
    for (const l of leistungen) {
      try {
        await prisma.leistung.upsert({
          where: {
            firmaId_name: {
              firmaId: user.firmaId,
              name: l.name,
            },
          },
          update: {
            preisProEinheit: l.preisProEinheit || l.vkPreis,
            einheit: l.einheit,
          },
          create: {
            firmaId: user.firmaId,
            name: l.name,
            kategorie: (l.leistungsKat || "SONSTIGES") as "STREICHEN" | "VORBEREITUNG" | "LACKIEREN" | "FASSADE" | "BODEN" | "TAPEZIEREN" | "TROCKENBAU" | "SONSTIGES",
            einheit: l.einheit,
            preisProEinheit: l.preisProEinheit || l.vkPreis,
            materialKat: l.kategorie !== "SONSTIGES" ? l.kategorie as "WANDFARBE" | "GRUNDIERUNG" | "SPACHTEL" | "LACK" | "VERBRAUCH" | "TAPETE" | "SONSTIGES" : null,
          },
        });
        leistungCount++;
      } catch {
        skipCount++;
      }
    }

    return NextResponse.json({
      success: true,
      materialCount,
      leistungCount,
      skipCount,
    });
  } catch (error) {
    console.error("Import Fehler:", error);
    return NextResponse.json(
      { error: "Fehler beim Import" },
      { status: 500 }
    );
  }
}
