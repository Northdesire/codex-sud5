import { CategoryLanding } from "@/components/marketing/category-landing";

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
      example="Beispiel: '2 E-Bikes und 1 Kinderrad für 5 Tage mit Helmen'. AIngebot erkennt alle Positionen und erstellt in Sekunden ein komplettes Mietangebot."
      ctaText="Fahrradverleih starten"
    />
  );
}
