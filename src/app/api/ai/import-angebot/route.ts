import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

interface ImportPosition {
  posNr: number;
  typ: string;
  bezeichnung: string;
  menge: number;
  einheit: string;
  einzelpreis: number;
  gesamtpreis: number;
  raumName?: string | null;
}

interface ImportMaterial {
  name: string;
  kategorie: string;
  vkPreis: number;
  einheit: string;
  ergiebigkeit?: number | null;
  lieferant?: string | null;
  selected?: boolean;
}

interface ImportLeistung {
  name: string;
  kategorie: string;
  preisProEinheit: number;
  einheit: string;
  selected?: boolean;
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const {
      kunde,
      positionen,
      summen,
      materialien: newMaterialien,
      leistungen: newLeistungen,
      meta,
    } = body;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create missing Materialien
      let matCreated = 0;
      for (const mat of (newMaterialien as ImportMaterial[]) || []) {
        if (mat.selected === false) continue;
        try {
          await tx.material.upsert({
            where: {
              firmaId_name: { firmaId: user.firmaId, name: mat.name },
            },
            create: {
              firmaId: user.firmaId,
              name: mat.name,
              kategorie: mat.kategorie as "WANDFARBE" | "GRUNDIERUNG" | "SPACHTEL" | "LACK" | "VERBRAUCH" | "TAPETE" | "SONSTIGES",
              ekPreis: 0,
              vkPreis: mat.vkPreis,
              einheit: mat.einheit,
              ergiebigkeit: mat.ergiebigkeit || null,
              lieferant: mat.lieferant || null,
            },
            update: {
              // Don't overwrite existing — only fill gaps
              vkPreis: mat.vkPreis,
            },
          });
          matCreated++;
        } catch (e) {
          console.error("Material upsert error:", e);
        }
      }

      // 2. Create missing Leistungen
      let leistCreated = 0;
      for (const leist of (newLeistungen as ImportLeistung[]) || []) {
        if (leist.selected === false) continue;
        try {
          await tx.leistung.upsert({
            where: {
              firmaId_name: { firmaId: user.firmaId, name: leist.name },
            },
            create: {
              firmaId: user.firmaId,
              name: leist.name,
              kategorie: leist.kategorie as "STREICHEN" | "VORBEREITUNG" | "LACKIEREN" | "FASSADE" | "BODEN" | "TAPEZIEREN" | "TROCKENBAU" | "SONSTIGES",
              preisProEinheit: leist.preisProEinheit,
              einheit: leist.einheit,
            },
            update: {
              preisProEinheit: leist.preisProEinheit,
            },
          });
          leistCreated++;
        } catch (e) {
          console.error("Leistung upsert error:", e);
        }
      }

      // 3. Find or create Kunde
      let kundeId: string | null = null;
      if (kunde?.name) {
        const existing = await tx.kunde.findFirst({
          where: { firmaId: user.firmaId, name: kunde.name },
        });
        if (existing) {
          kundeId = existing.id;
          await tx.kunde.update({
            where: { id: existing.id },
            data: {
              strasse: kunde.strasse || existing.strasse,
              plz: kunde.plz || existing.plz,
              ort: kunde.ort || existing.ort,
              email: kunde.email || existing.email,
              telefon: kunde.telefon || existing.telefon,
            },
          });
        } else {
          const created = await tx.kunde.create({
            data: {
              firmaId: user.firmaId,
              name: kunde.name,
              strasse: kunde.strasse || null,
              plz: kunde.plz || null,
              ort: kunde.ort || null,
              email: kunde.email || null,
              telefon: kunde.telefon || null,
            },
          });
          kundeId = created.id;
        }
      }

      // 4. Create Angebot with auto-numbered nummer
      const firma = await tx.firma.update({
        where: { id: user.firmaId },
        data: { nrCounter: { increment: 1 } },
      });
      const nummer = `${firma.nrPrefix}${String(firma.nrCounter).padStart(3, "0")}`;

      const gueltigBis = new Date();
      gueltigBis.setDate(gueltigBis.getDate() + (firma.angebotsGueltig || 14));

      const angebot = await tx.angebot.create({
        data: {
          firmaId: user.firmaId,
          kundeId,
          nummer,
          datum: meta?.datum ? new Date(meta.datum) : new Date(),
          gueltigBis,
          status: "ENTWURF",
          eingabeMethode: "TEXT_SONSTIG",
          originalText: `Import: ${meta?.typ || "ANGEBOT"} ${meta?.nummer || ""}`.trim(),
          kundeName: kunde?.name || "Unbekannt",
          kundeStrasse: kunde?.strasse || null,
          kundePlz: kunde?.plz || null,
          kundeOrt: kunde?.ort || null,
          kundeEmail: kunde?.email || null,
          kundeTelefon: kunde?.telefon || null,
          materialNetto: summen?.materialNetto || 0,
          arbeitsNetto: summen?.arbeitsNetto || 0,
          anfahrt: summen?.anfahrt || 0,
          zuschlagNetto: summen?.zuschlagNetto || 0,
          rabattNetto: summen?.rabattNetto || 0,
          netto: summen?.netto || 0,
          mwstBetrag: summen?.mwstBetrag || 0,
          brutto: summen?.brutto || 0,
          positionen: {
            create: (positionen as ImportPosition[]).map((p, i) => ({
              posNr: p.posNr || i + 1,
              typ: p.typ as "LEISTUNG" | "MATERIAL" | "ZUSCHLAG" | "RABATT" | "ANFAHRT",
              bezeichnung: p.bezeichnung,
              menge: p.menge,
              einheit: p.einheit,
              einzelpreis: p.einzelpreis,
              gesamtpreis: p.gesamtpreis,
              raumName: p.raumName || null,
              sortierung: i,
            })),
          },
        },
        include: { positionen: true },
      });

      return {
        angebotId: angebot.id,
        nummer: angebot.nummer,
        matCreated,
        leistCreated,
        positionenCount: positionen.length,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Angebot-Import Fehler:", error);
    return NextResponse.json(
      { error: "Fehler beim Import" },
      { status: 500 }
    );
  }
}
