import { CategoryLanding } from "@/components/marketing/category-landing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AIngebot für Fahrradverleih",
  description: "Mietanfragen für Fahrräder in Sekunden in fertige Angebote umwandeln.",
};

export default function FahrradverleihPage() {
  return (
    <CategoryLanding
      subtitle="Branchenlösung für Fahrradverleih"
      title="Mietangebote ohne Tabellen-Chaos"
      promise="Kundenanfragen per Text oder Sprache werden automatisch in konkrete Mietpositionen übersetzt: Fahrradtypen, Mengen, Mietdauer und Extras inklusive."
      highlights={[
        "Fahrradtypen und Stückzahlen automatisch erkennen",
        "Mietdauer und Tagespreise sauber kalkulieren",
        "Extras wie Helme, Körbe oder Kindersitze direkt ergänzen",
        "Angebote und Rechnungen aus einem System versenden",
      ]}
      painPoints={[
        "Anfragen mit verschiedenen Fahrradtypen sind oft unvollständig.",
        "Mietdauer und Staffelpreise müssen manuell berechnet werden.",
        "Extras und Zusatzgebühren gehen in der Hektik verloren.",
        "Schnelle Rückmeldung ist entscheidend, vor allem in Saisonzeiten.",
      ]}
      workflow={[
        {
          title: "Anfrage aufnehmen",
          text: "Kundenwunsch per Text, Bild oder Sprache eingeben.",
        },
        {
          title: "Mietpositionen automatisch erstellen",
          text: "Radtypen, Mengen, Mietdauer und Extras werden strukturiert erkannt.",
        },
        {
          title: "Angebot direkt versenden",
          text: "Preis prüfen, PDF erzeugen, sofort an den Kunden schicken.",
        },
      ]}
      proof={[
        { label: "Angebotserstellung", value: "~60 Sekunden" },
        { label: "Kalkulation", value: "automatisch je Mietdauer" },
        { label: "Extras", value: "mit einem Klick" },
        { label: "Saisonbetrieb", value: "deutlich entlastet" },
      ]}
      faq={[
        {
          question: "Kann ich unterschiedliche Fahrradkategorien verwalten?",
          answer:
            "Ja. E-Bikes, Citybikes, Kinderräder und weitere Kategorien lassen sich mit eigenen Preisen anlegen.",
        },
        {
          question: "Wie funktionieren Preise für längere Mietdauer?",
          answer:
            "Du kannst Staffel- oder Tagespreise hinterlegen. AIngebot nutzt diese automatisch bei der Berechnung.",
        },
        {
          question: "Sind Extras wie Helm und Kindersitz abbildbar?",
          answer:
            "Ja. Extras können als eigene Positionen gepflegt und bei der Angebotserstellung direkt ergänzt werden.",
        },
      ]}
      example="Beispiel: '2 E-Bikes und 1 Kinderrad für 5 Tage mit Helmen'. AIngebot erkennt alle Positionen und erstellt in Sekunden ein komplettes Mietangebot."
      ctaText="Fahrradverleih starten"
    />
  );
}
