import { CategoryLanding } from "@/components/marketing/category-landing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AIngebot für Malerbetriebe",
  description: "Angebote für Malerarbeiten in 60 Sekunden aus Text, E-Mail oder Sprachmemo.",
};

export default function MalerPage() {
  return (
    <CategoryLanding
      subtitle="Branchenlösung für Malerbetriebe"
      title="Maler-Angebote in 60 Sekunden"
      promise="Aus Freitext, E-Mail oder Sprachmemo werden automatisch Räume, Flächen und Leistungspositionen erzeugt. Das System nutzt deinen Material- und Leistungskatalog für saubere Kalkulationen."
      highlights={[
        "Raummaße, Fenster und Türen automatisch erkennen",
        "Material und Leistungen direkt mit Firmenpreisen verknüpfen",
        "Angebote als PDF mit Firmendaten generieren",
        "Schneller von Anfrage zu zugesagtem Auftrag",
      ]}
      painPoints={[
        "Anfragen kommen per WhatsApp, Telefon und E-Mail in völlig unterschiedlicher Struktur.",
        "Räume und Maße werden jedes Mal neu in Excel oder Word übertragen.",
        "Material- und Leistungspositionen werden manuell zusammengesucht.",
        "Langsame Angebotsantwort kostet Abschlussquote.",
      ]}
      workflow={[
        {
          title: "Anfrage einfügen",
          text: "Du gibst Text ein oder lädst ein Sprachmemo/Foto hoch.",
        },
        {
          title: "AI erkennt Flächen und Leistungen",
          text: "Räume, Maße, Arbeiten und Optionen werden strukturiert extrahiert.",
        },
        {
          title: "Angebot sofort versenden",
          text: "Positionen prüfen, PDF erzeugen und direkt an den Kunden schicken.",
        },
      ]}
      proof={[
        { label: "Zeit pro Angebot", value: "20-40 Min -> 60 Sek" },
        { label: "Antwortgeschwindigkeit", value: "Taggleich" },
        { label: "Katalog-Konsistenz", value: "100% einheitlich" },
        { label: "Onboarding", value: "< 5 Minuten" },
      ]}
      faq={[
        {
          question: "Muss ich meinen Materialkatalog zuerst vollständig pflegen?",
          answer:
            "Nein. Du kannst mit wenigen Kernmaterialien starten und den Katalog nach und nach erweitern. AIngebot funktioniert bereits mit einem kleinen Basis-Setup.",
        },
        {
          question: "Funktioniert das auch mit handschriftlichen Notizen?",
          answer:
            "Ja, Fotos von Notizen oder WhatsApp-Screenshots können analysiert werden. Die erkannten Positionen kannst du vor dem Versand jederzeit prüfen und anpassen.",
        },
        {
          question: "Kann ich Standard- und Premium-Varianten anbieten?",
          answer:
            "Ja. Du kannst mehrere Leistungsvarianten anlegen und je nach Anfrage passend auswählen oder automatisch vorschlagen lassen.",
        },
      ]}
      example="Beispiel: 'Wohnzimmer 5x4m, Schlafzimmer 4x3.5m, Decke mitstreichen, Premiumfarbe'. AIngebot extrahiert Maße, berechnet Flächen, schlägt passende Positionen vor und erstellt dein Angebot."
      ctaText="Malerbetrieb starten"
    />
  );
}
