import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, firmenname, email, branche } = body;

    if (!name || !firmenname || !email) {
      return NextResponse.json(
        { error: "Name, Firmenname und E-Mail sind Pflichtfelder" },
        { status: 400 }
      );
    }

    // Prüfen ob User schon existiert
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Ein Konto mit dieser E-Mail existiert bereits" },
        { status: 409 }
      );
    }

    const selectedBranche = branche === "SHOP" ? "SHOP" : branche === "FEWO" ? "FEWO" : "MALER";

    // Firma + User + (ggf. Kalkulationsregeln) in einer Transaktion erstellen
    const result = await prisma.$transaction(async (tx) => {
      const firma = await tx.firma.create({
        data: {
          firmenname,
          inhaberName: name,
          strasse: "",
          plz: "",
          ort: "",
          telefon: "",
          email,
          branche: selectedBranche,
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          passwordHash: "supabase-managed", // Auth wird über Supabase gehandhabt
          name,
          rolle: "INHABER",
          firmaId: firma.id,
        },
      });

      // Nur für MALER: Standard-Kalkulationsregeln erstellen
      if (selectedBranche === "MALER") {
        await tx.kalkulationsRegeln.create({
          data: { firmaId: firma.id },
        });
      }

      return { firma, user };
    });

    return NextResponse.json({
      success: true,
      firmaId: result.firma.id,
      userId: result.user.id,
    });
  } catch (error) {
    console.error("Registrierungsfehler:", error);
    return NextResponse.json(
      { error: "Interner Fehler bei der Registrierung" },
      { status: 500 }
    );
  }
}
