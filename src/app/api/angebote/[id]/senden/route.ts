import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { generateAngebotPDFBuffer } from "@/lib/pdf";

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

    const angebot = await prisma.angebot.findFirst({
      where: { id, firmaId: user.firmaId },
      include: {
        positionen: { orderBy: { sortierung: "asc" } },
        firma: true,
      },
    });

    if (!angebot) {
      return NextResponse.json(
        { error: "Angebot nicht gefunden" },
        { status: 404 }
      );
    }

    if (!angebot.kundeEmail) {
      return NextResponse.json(
        { error: "Keine E-Mail-Adresse beim Kunden hinterlegt" },
        { status: 400 }
      );
    }

    // PDF generieren
    const pdfBuffer = generateAngebotPDFBuffer({
      nummer: angebot.nummer,
      datum: angebot.datum,
      gueltigBis: angebot.gueltigBis,
      kunde: {
        name: angebot.kundeName,
        strasse: angebot.kundeStrasse || undefined,
        plz: angebot.kundePlz || undefined,
        ort: angebot.kundeOrt || undefined,
        email: angebot.kundeEmail || undefined,
      },
      firma: angebot.firma,
      positionen: angebot.positionen.map((p) => ({
        posNr: p.posNr,
        typ: p.typ,
        bezeichnung: p.bezeichnung,
        menge: p.menge,
        einheit: p.einheit,
        einzelpreis: p.einzelpreis,
        gesamtpreis: p.gesamtpreis,
      })),
      materialNetto: angebot.materialNetto,
      arbeitsNetto: angebot.arbeitsNetto,
      anfahrt: angebot.anfahrt,
      netto: angebot.netto,
      mwstSatz: angebot.firma.branche === "FEWO" ? 7.0 : angebot.firma.mwstSatz,
      mwstBetrag: angebot.mwstBetrag,
      brutto: angebot.brutto,
    });

    const filename = `${angebot.nummer}_${angebot.kundeName.replace(/\s+/g, "_")}.pdf`;

    // E-Mail-Text generieren (KI oder Fallback)
    let emailHtml: string;
    const firma = angebot.firma;

    if (firma.wissenstext && angebot.originalText && process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `Du bist ein freundlicher Gastgeber. Schreibe eine persönliche E-Mail als Antwort auf eine Gästeanfrage.

Firmenwissen: ${firma.wissenstext}
Gästeanfrage: ${angebot.originalText}
Angebot: ${angebot.nummer}, ${angebot.brutto.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}, Anreise: ${angebot.anreise ? angebot.anreise.toLocaleDateString("de-DE") : "—"}, Abreise: ${angebot.abreise ? angebot.abreise.toLocaleDateString("de-DE") : "—"}, ${angebot.naechte ?? "—"} Nächte, ${angebot.personen ?? "—"} Personen

Regeln:
- Begrüße den Gast mit Namen (${angebot.kundeName})
- Beantworte spezifische Fragen aus der Anfrage anhand des Firmenwissens
- Erwähne das beigefügte Angebot mit Betrag und Gültigkeit (${angebot.gueltigBis.toLocaleDateString("de-DE")})
- Halte es kurz, freundlich, persönlich
- Schließe mit dem Namen des Inhabers (${firma.inhaberName})
- Gib NUR den HTML-Body zurück (kein <html>/<body> Tag, nur Absätze mit <p>)`,
            },
            {
              role: "user",
              content: "Schreibe jetzt die E-Mail.",
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        });

        emailHtml = completion.choices[0]?.message?.content || "";
      } catch (aiError) {
        console.error("KI-Mail Fehler, nutze Fallback:", aiError);
        emailHtml = "";
      }
    } else {
      emailHtml = "";
    }

    // Fallback: statischer Text
    if (!emailHtml) {
      emailHtml = `
        <p>Sehr geehrte(r) ${angebot.kundeName},</p>
        <p>vielen Dank für Ihre Anfrage. Anbei erhalten Sie unser Angebot <strong>${angebot.nummer}</strong>.</p>
        <p><strong>Gesamtbetrag: ${angebot.brutto.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</strong> (inkl. MwSt.)</p>
        <p>Das Angebot ist gültig bis zum ${angebot.gueltigBis.toLocaleDateString("de-DE")}.</p>
        <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
        <p>Mit freundlichen Grüßen<br>${firma.inhaberName}<br>${firma.firmenname}<br>Tel: ${firma.telefon}<br>${firma.email}</p>
      `;
    }

    // E-Mail senden
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const fromField = fromEmail === "onboarding@resend.dev"
      ? "Acme <onboarding@resend.dev>"
      : `${firma.firmenname} <${fromEmail}>`;

    const { data: sendResult, error: sendError } = await resend.emails.send({
      from: fromField,
      to: angebot.kundeEmail,
      subject: `Angebot ${angebot.nummer} — ${firma.firmenname}`,
      html: emailHtml,
      attachments: [
        {
          filename,
          content: pdfBuffer,
        },
      ],
    });

    if (sendError) {
      console.error("Resend Fehler:", sendError);
      return NextResponse.json(
        { error: `E-Mail Fehler: ${sendError.message}` },
        { status: 500 }
      );
    }

    console.log("Resend OK:", sendResult);

    // Status auf OFFEN setzen
    await prisma.angebot.update({
      where: { id },
      data: {
        status: angebot.status === "ENTWURF" ? "OFFEN" : angebot.status,
        statusAenderung: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Senden Fehler:", error);
    return NextResponse.json(
      { error: "Fehler beim Senden" },
      { status: 500 }
    );
  }
}
