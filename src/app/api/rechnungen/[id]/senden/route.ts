import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { generateRechnungPDFBuffer } from "@/lib/pdf";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "E-Mail nicht konfiguriert. Bitte RESEND_API_KEY setzen." },
        { status: 500 }
      );
    }

    const rechnung = await prisma.rechnung.findFirst({
      where: { id, firmaId: user.firmaId },
      include: {
        positionen: { orderBy: { sortierung: "asc" } },
        firma: true,
      },
    });

    if (!rechnung) {
      return NextResponse.json(
        { error: "Rechnung nicht gefunden" },
        { status: 404 }
      );
    }

    if (!rechnung.kundeEmail) {
      return NextResponse.json(
        { error: "Keine E-Mail-Adresse beim Kunden hinterlegt" },
        { status: 400 }
      );
    }

    const pdfBuffer = generateRechnungPDFBuffer({
      nummer: rechnung.nummer,
      datum: rechnung.datum,
      faelligAm: rechnung.faelligAm,
      kunde: {
        name: rechnung.kundeName,
        strasse: rechnung.kundeStrasse || undefined,
        plz: rechnung.kundePlz || undefined,
        ort: rechnung.kundeOrt || undefined,
      },
      firma: rechnung.firma,
      positionen: rechnung.positionen.map((p) => ({
        posNr: p.posNr,
        typ: p.typ,
        bezeichnung: p.bezeichnung,
        menge: p.menge,
        einheit: p.einheit,
        einzelpreis: p.einzelpreis,
        gesamtpreis: p.gesamtpreis,
      })),
      netto: rechnung.netto,
      mwstSatz: rechnung.mwstSatz,
      mwstBetrag: rechnung.mwstBetrag,
      brutto: rechnung.brutto,
      einleitungsText: rechnung.einleitungsText,
      schlussText: rechnung.schlussText,
    });

    const filename = `${rechnung.nummer}_${rechnung.kundeName.replace(/\s+/g, "_")}.pdf`;
    const faelligStr = rechnung.faelligAm.toLocaleDateString("de-DE");

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    await resend.emails.send({
      from: `${rechnung.firma.firmenname} <${fromEmail}>`,
      to: rechnung.kundeEmail,
      subject: `Rechnung ${rechnung.nummer} — ${rechnung.firma.firmenname}`,
      html: `
        <p>Sehr geehrte(r) ${rechnung.kundeName},</p>
        <p>anbei erhalten Sie unsere Rechnung <strong>${rechnung.nummer}</strong>.</p>
        <p><strong>Gesamtbetrag: ${rechnung.brutto.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</strong> (inkl. MwSt.)</p>
        <p>Bitte überweisen Sie den Betrag bis zum <strong>${faelligStr}</strong>.</p>
        <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
        <p>Mit freundlichen Grüßen<br>${rechnung.firma.inhaberName}<br>${rechnung.firma.firmenname}<br>Tel: ${rechnung.firma.telefon}<br>${rechnung.firma.email}</p>
      `,
      attachments: [
        {
          filename,
          content: pdfBuffer,
        },
      ],
    });

    // Status ENTWURF → OFFEN nach Senden
    if (rechnung.status === "ENTWURF") {
      await prisma.rechnung.update({
        where: { id },
        data: {
          status: "OFFEN",
          statusAenderung: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Rechnung senden Fehler:", error);
    return NextResponse.json(
      { error: "Fehler beim Senden" },
      { status: 500 }
    );
  }
}
