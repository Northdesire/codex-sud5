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
        "Kundenanfrage für Malerarbeiten. Räume, Maße in Metern, Quadratmeter, Fenster, Türen, Deckenhöhe, Straße, PLZ, Ort.",
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
