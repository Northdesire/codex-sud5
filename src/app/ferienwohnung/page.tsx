import { CategoryLanding } from "@/components/marketing/category-landing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AIngebot für Ferienwohnungen",
  description: "Gästeanfragen automatisch in kalkulierte Unterkunftsangebote umwandeln.",
};

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
      painPoints={[
        "Anfragen enthalten oft unvollständige Reise- und Gastdaten.",
        "Preise unterscheiden sich je nach Saison und Unterkunft.",
        "Extras wie Hund, Parkplatz oder Frühstück müssen manuell addiert werden.",
        "Späte Rückmeldungen führen zu verlorenen Buchungen.",
      ]}
      workflow={[
        {
          title: "Gästeanfrage erfassen",
          text: "Text, Screenshot oder Sprachmemo mit Reisedaten einfügen.",
        },
        {
          title: "Aufenthalt automatisch strukturieren",
          text: "Anreise, Abreise, Personenzahl und Wünsche werden erkannt und zugeordnet.",
        },
        {
          title: "Angebot kalkulieren und senden",
          text: "Unterkunft, Saisondaten und Extras werden berechnet und als PDF versendet.",
        },
      ]}
      proof={[
        { label: "Antwortzeit auf Anfrage", value: "unter 2 Minuten" },
        { label: "Saisonlogik", value: "automatisch" },
        { label: "Zusatzleistungen", value: "direkt eingerechnet" },
        { label: "Buchungschance", value: "höhere Erstreaktion" },
      ]}
      faq={[
        {
          question: "Kann ich mehrere Unterkünfte parallel verwalten?",
          answer:
            "Ja. Du kannst verschiedene Unterkünfte, Zimmer und Häuser mit eigenen Preisen und Kapazitäten pflegen.",
        },
        {
          question: "Wie werden Saisonpreise berücksichtigt?",
          answer:
            "Saisons werden im Dashboard definiert und bei passenden Reisedaten automatisch in die Kalkulation übernommen.",
        },
        {
          question: "Kann ich Extras pro Unterkunftstyp steuern?",
          answer:
            "Ja. Extras lassen sich so konfigurieren, dass sie je nach Unterkunftstyp oder Anfrage passend angeboten werden.",
        },
      ]}
      example="Beispiel: '15.-22. Juli, 2 Erwachsene, 2 Kinder, Hund, Parkplatz'. AIngebot erkennt den Bedarf, kalkuliert Unterkunft + Extras und erstellt ein versandfertiges Angebot."
      ctaText="Ferienwohnung starten"
    />
  );
}
