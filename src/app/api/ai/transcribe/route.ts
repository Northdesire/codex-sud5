import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Kein OpenAI API Key konfiguriert" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "Keine Audiodatei empfangen" },
        { status: 400 }
      );
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "de",
      prompt:
        "Kundenanfrage für Malerarbeiten in einem deutschen Malerbetrieb. " +
        "Raumtypen: Wohnzimmer, Schlafzimmer, Kinderzimmer, Küche, Badezimmer, Flur, Treppenhaus, Keller, " +
        "Hauswirtschaftsraum, Diele, Gäste-WC, Dachgeschoss, Büro, Arbeitszimmer, Esszimmer, Gästezimmer. " +
        "Abkürzungen: WoZi, SZ, KiZi, WC, HWR, EG, OG, DG, KG, qm, lfm, lm, m². " +
        "Maßangaben: fünf mal vier Meter, dreieinhalb, Deckenhöhe 2,55 Meter, 5,2 mal 4,1 Meter, 3,5 mal 3 Meter, " +
        "ca. 20 Quadratmeter, ungefähr 4 auf 3. " +
        "Materialien/Hersteller: Caparol, Brillux, Knauf, Sto, Sikkens, Dulux, Alpina, Schöner Wohnen, " +
        "CapaGrund, Uniflott, CapaDur, Tiefgrund LF, Capadur Weiß, CapaTop, Sylitol, Muresko, " +
        "Caparol Amphisilan, ELF, Latex, Silikatfarbe, Raufaser, Vliestapete, Glasgewebe. " +
        "Arbeiten: streichen, spachteln, grundieren, tapezieren, Tapete entfernen, Raufaser entfernen, " +
        "abkleben, schleifen, lackieren, lasieren, Decken streichen, Wände streichen, " +
        "Anstrich, Grundierung, Voranstrich, Zwischenanstrich, Schlussanstrich. " +
        "Extras: Sockelleisten, Fußleisten, Türzargen, Türrahmen, Heizkörper, Fassade, Balkon, " +
        "Möbel rücken, Risse ausbessern, Schimmel behandeln, Schimmelbehandlung. " +
        "Adressen: Straße, Hausnummer, Postleitzahl, PLZ, Ort, Emden, Aurich, Leer, Norden, Wittmund, " +
        "Wilhelmshaven, Oldenburg, Jever, Esens, Friedeburg, Wiesmoor, Großefehn, Moormerland, Westoverledingen. " +
        "Personen: Familie Müller, Herr Schmidt, Frau Weber, Firma, GmbH.",
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    console.error("Whisper Fehler:", error);
    return NextResponse.json(
      { error: "Transkription fehlgeschlagen" },
      { status: 500 }
    );
  }
}
