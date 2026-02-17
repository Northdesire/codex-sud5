import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const firma = await prisma.firma.findUnique({
      where: { id: user.firmaId },
    });
    return NextResponse.json(firma);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    // Nur erlaubte Felder updaten
    const allowedFields = [
      "firmenname", "inhaberName", "inhaberTitel", "strasse", "plz", "ort",
      "telefon", "email", "website", "steuernummer", "ustIdNr",
      "iban", "bic", "bankname", "logoUrl",
      "mwstSatz", "stundensatz", "zahlungsziel", "angebotsGueltig",
      "nrPrefix", "agbText", "googleReviewUrl",
    ];

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        data[field] = body[field];
      }
    }

    const firma = await prisma.firma.update({
      where: { id: user.firmaId },
      data,
    });

    return NextResponse.json(firma);
  } catch {
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}
