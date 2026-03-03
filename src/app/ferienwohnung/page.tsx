import { CategoryLanding } from "@/components/marketing/category-landing";

export default function FerienwohnungPage() {
  return (
    <CategoryLanding
      subtitle="Branchenlösung für Ferienwohnung und kleine Hotels"
      title="Unterkunfts-Angebote in 60 Sekunden"
      promise="Gastanfragen werden automatisch analysiert: Reisedaten, Personenzahl, Haustiere und Zusatzwünsche landen direkt als kalkuliertes Angebot in deinem System."
      highlights={[
        "Anreise/Abreise und Gästezahl automatisch erkennen",
        "Unterkünfte, Saisonpreise und Extras direkt einrechnen",
        "Passende Angebotsvorlagen je Unterkunftstyp nutzen",
        "Schneller antworten und Buchungen früher sichern",
      ]}
      example="Beispiel: '15.-22. Juli, 2 Erwachsene, 2 Kinder, Hund, Parkplatz'. AIngebot erkennt den Bedarf, kalkuliert Unterkunft + Extras und erstellt ein versandfertiges Angebot."
      ctaText="Ferienwohnung starten"
    />
  );
}
