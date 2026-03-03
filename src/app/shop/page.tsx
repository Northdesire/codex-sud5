import { CategoryLanding } from "@/components/marketing/category-landing";

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
      example="Beispiel: '5x Laptop Dell XPS, 10x USB-C Kabel, 2x Monitor 27 Zoll'. AIngebot erkennt die Positionen, ergänzt Preise aus deinem Katalog und erstellt ein versandfertiges Angebot."
      ctaText="Shop starten"
    />
  );
}
