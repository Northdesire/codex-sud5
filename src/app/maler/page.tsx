import { CategoryLanding } from "@/components/marketing/category-landing";

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
      example="Beispiel: 'Wohnzimmer 5x4m, Schlafzimmer 4x3.5m, Decke mitstreichen, Premiumfarbe'. AIngebot extrahiert Maße, berechnet Flächen, schlägt passende Positionen vor und erstellt dein Angebot."
      ctaText="Malerbetrieb starten"
    />
  );
}
