import { CategoryLanding } from "@/components/marketing/category-landing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AIngebot für Shop und E-Commerce",
  description: "Produktanfragen in Sekunden in strukturierte Angebote und Rechnungen verwandeln.",
};

export default function ShopPage() {
  return (
    <CategoryLanding
      subtitle="Branchenlösung für Shop / E-Commerce"
      title="Shop-Angebote ohne Copy-Paste"
      promise="Produktlisten aus E-Mails, Screenshots oder Sprachmemos werden in strukturierte Angebotspositionen überführt. Mengen, Einheiten und Katalogpreise werden automatisch abgeglichen."
      highlights={[
        "Produkte und Mengen aus unstrukturierten Anfragen extrahieren",
        "Eigene Produktdatenbank für konsistente Preise nutzen",
        "Schnelle Angebots- und Rechnungserstellung in einem Flow",
        "Weniger Rückfragen durch klare Angebotsdokumente",
      ]}
      painPoints={[
        "Kunden schicken Produktlisten als Fließtext, Screenshot oder PDF.",
        "Mengen und Varianten werden oft falsch übernommen.",
        "Preise aus mehreren Quellen führen zu Inkonsistenzen.",
        "Follow-up auf offene Angebote ist nicht zentral gesteuert.",
      ]}
      workflow={[
        {
          title: "Eingangsdaten sammeln",
          text: "Bestellanfrage als Text, Bild oder E-Mail-Inhalt einfügen.",
        },
        {
          title: "Positionen automatisch erzeugen",
          text: "Produkte, Mengen und Einheiten werden strukturiert erkannt und mit Katalogpreisen abgeglichen.",
        },
        {
          title: "Angebot oder Rechnung erstellen",
          text: "Mit einem Klick als PDF erzeugen, versenden und später nachverfolgen.",
        },
      ]}
      proof={[
        { label: "Manuelle Eingabe", value: "-80%" },
        { label: "Fehler bei Mengen", value: "deutlich reduziert" },
        { label: "Antwortzeit", value: "< 5 Minuten" },
        { label: "Wiederverwendbarkeit", value: "Katalogbasiert" },
      ]}
      faq={[
        {
          question: "Kann ich bestehende Preislisten importieren?",
          answer:
            "Ja. Du kannst Kataloge aus Dokumenten importieren und Produkte später im Dashboard nachbearbeiten.",
        },
        {
          question: "Wie geht AIngebot mit fehlenden Preisen um?",
          answer:
            "Fehlende Werte werden markiert, damit du sie vor Versand ergänzen kannst. So bleibt die Ausgabe kontrollierbar.",
        },
        {
          question: "Ist das auch für B2B-Anfragen mit vielen Positionen geeignet?",
          answer:
            "Ja, gerade bei langen Produktlisten spart AIngebot viel Zeit, weil die Struktur automatisch erzeugt wird.",
        },
      ]}
      example="Beispiel: '5x Laptop Dell XPS, 10x USB-C Kabel, 2x Monitor 27 Zoll'. AIngebot erkennt die Positionen, ergänzt Preise aus deinem Katalog und erstellt ein versandfertiges Angebot."
      ctaText="Shop starten"
    />
  );
}
