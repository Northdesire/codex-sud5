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
        "Kundenanfrage für Malerarbeiten in einem Malerbetrieb. " +
        "Wohnzimmer, Schlafzimmer, Kinderzimmer, Küche, Badezimmer, Flur, Treppenhaus. " +
        "Maße in Metern: 5,2 mal 4,1 Meter, 3,5 mal 3 Meter, Deckenhöhe 2,55 Meter. " +
        "Quadratmeter, Fenster, Türen. " +
        "Streichen, Spachteln, Tapete entfernen, Grundierung, Decken streichen. " +
        "Caparol, Brillux, Knauf, Sikkens. " +
        "Straße, Hausnummer, Postleitzahl, PLZ, Ort. " +
        "Familie Müller, Herr Schmidt, Frau Weber.",
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
