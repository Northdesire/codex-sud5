import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Building2,
  Users,
  Paintbrush,
  ClipboardList,
  Percent,
  DoorOpen,
  Calculator,
  FileText,
  FileSpreadsheet,
  Sparkles,
  GraduationCap,
  Package,
  Receipt,
  Home,
  CalendarRange,
  Star,
  Bike,
  Clock,
  Plus,
  HelpCircle,
} from "lucide-react";

export type Branche = "MALER" | "SHOP" | "FEWO" | "FAHRRAD";

export interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface TutorialStep {
  key: string;
  nr: number;
  title: string;
  icon: LucideIcon;
  href: string;
  warum: string;
  beispiel: string;
  color: string;
}

export interface BrancheConfig {
  label: string;
  beschreibung: string;
  sidebarItems: SidebarItem[];
  tutorialSteps: TutorialStep[];
  appFeatures: {
    hasRaeume: boolean;
    hasKalkRegeln: boolean;
    hasMaterial: boolean;
    hasLeistungen: boolean;
    hasProdukte: boolean;
    hasRaumvorlagen: boolean;
    hasRechnungen: boolean;
    hasUnterkuenfte: boolean;
    hasSaisons: boolean;
    hasFewoExtras: boolean;
    hasFahrraeder: boolean;
    hasMietdauerStaffeln: boolean;
    hasFahrradExtras: boolean;
  };
  registerPlaceholders: {
    firmenname: string;
    email: string;
  };
  setupChecks: Array<{ key: string; label: string }>;
  dashboardStats: Array<{
    key: string;
    label: string;
    icon: LucideIcon;
    href: string;
    color: string;
  }>;
  quickActions: Array<{
    href: string;
    title: string;
    description: string;
  }>;
  angebotEinleitung: string;
}

export const BRANCHE_CONFIG: Record<Branche, BrancheConfig> = {
  MALER: {
    label: "Malerbetrieb",
    beschreibung: "Malerbetrieb-Software",
    sidebarItems: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/firma", label: "Firmendaten", icon: Building2 },
      { href: "/dashboard/kunden", label: "Kunden", icon: Users },
      { href: "/dashboard/material", label: "Material & Preise", icon: Paintbrush },
      { href: "/dashboard/leistungen", label: "Leistungen", icon: ClipboardList },
      { href: "/dashboard/zuschlaege", label: "Zuschläge & Rabatte", icon: Percent },
      { href: "/dashboard/raumvorlagen", label: "Raum-Vorlagen", icon: DoorOpen },
      { href: "/dashboard/kalkulation", label: "Kalkulation", icon: Calculator },
      { href: "/dashboard/textvorlagen", label: "Textvorlagen", icon: FileText },
      { href: "/dashboard/angebote", label: "Angebote", icon: FileSpreadsheet },
      { href: "/dashboard/import", label: "AI-Import", icon: Sparkles },
      { href: "/dashboard/tutorial", label: "Einrichtungs-Guide", icon: GraduationCap },
    ],
    tutorialSteps: [
      {
        key: "hasFirma",
        nr: 1,
        title: "Firmendaten",
        icon: Building2,
        href: "/dashboard/firma",
        warum: "Deine Firmendaten erscheinen auf jedem Angebot: Briefkopf, Fusszeile, Bankverbindung.",
        beispiel: "Firmenname, Adresse, Telefon, IBAN, Logo hochladen.",
        color: "text-blue-600",
      },
      {
        key: "hasMaterial",
        nr: 2,
        title: "Material & Preise",
        icon: Paintbrush,
        href: "/dashboard/material",
        warum: "Materialien werden zuerst angelegt, weil Leistungen darauf verweisen. Jede Farbe, Grundierung oder Spachtel bekommt einen EK- und VK-Preis und eine Ergiebigkeit (m\u00B2 pro Liter). Das Angebot berechnet daraus automatisch den Materialbedarf.",
        beispiel: 'Lege z.B. an: "Caparol CapaMaxx" (Kategorie: Wandfarbe, VK 18,90 \u20AC/Liter, Ergiebigkeit 7 m\u00B2/Liter) und "Tiefengrund" (Kategorie: Grundierung, VK 8,50 \u20AC/Liter).',
        color: "text-emerald-600",
      },
      {
        key: "hasLeistungen",
        nr: 3,
        title: "Leistungen anlegen",
        icon: ClipboardList,
        href: "/dashboard/leistungen",
        warum: "Leistungen sind deine Arbeitspreise pro m\u00B2. Jede Leistung kann mit einer Material-Kategorie verknüpft werden — z.B. 'Wände streichen' mit Wandfarbe. So weiss die Kalkulation, welches Material automatisch berechnet wird. Ohne Leistung = kein Arbeitspreis auf dem Angebot.",
        beispiel: 'Lege z.B. an: "Wände streichen Standard" (Kategorie: Streichen, 8,50 \u20AC/m\u00B2, Material: Wandfarbe) und "Wände streichen Premium" (12 \u20AC/m\u00B2, Material: Wandfarbe). Für Vorarbeiten: "Grundierung" (3 \u20AC/m\u00B2, Material: Grundierung).',
        color: "text-amber-600",
      },
      {
        key: "hasKalkRegeln",
        nr: 4,
        title: "Kalkulationsregeln",
        icon: Calculator,
        href: "/dashboard/kalkulation",
        warum: "Hier stellst du ein, wie die Kalkulation rechnet: Wieviel Verschnitt aufgeschlagen wird, wieviele Anstriche Standard sind und wie hoch die Anfahrtspauschale ist. Diese Werte gelten für alle Angebote.",
        beispiel: "Verschnitt 10% (= 10% mehr Material), 2 Anstriche, Anfahrt klein 35 \u20AC / gross 55 \u20AC, Fenster-Abzug 1,5 m\u00B2 pro Fenster.",
        color: "text-purple-600",
      },
      {
        key: "hasAngebote",
        nr: 5,
        title: "Erstes Angebot erstellen",
        icon: Sparkles,
        href: "/app/ai",
        warum: "Alles testen: AI-Eingabe oder Formular ausfüllen und das erste Angebot generieren.",
        beispiel: 'Text eingeben wie: "3 Zimmer streichen, Wohnzimmer 5x4m, Schlafzimmer 4x3.5m".',
        color: "text-rose-600",
      },
    ],
    appFeatures: {
      hasRaeume: true,
      hasKalkRegeln: true,
      hasMaterial: true,
      hasLeistungen: true,
      hasProdukte: false,
      hasRaumvorlagen: true,
      hasRechnungen: false,
      hasUnterkuenfte: false,
      hasSaisons: false,
      hasFewoExtras: false,
      hasFahrraeder: false,
      hasMietdauerStaffeln: false,
      hasFahrradExtras: false,
    },
    registerPlaceholders: {
      firmenname: "Malerbetrieb Schneider",
      email: "info@maler-schneider.de",
    },
    setupChecks: [
      { key: "hasFirma", label: "Firmendaten" },
      { key: "hasMaterial", label: "Material" },
      { key: "hasLeistungen", label: "Leistungen" },
      { key: "hasKalkRegeln", label: "Kalkulation" },
      { key: "hasAngebote", label: "Angebot" },
    ],
    dashboardStats: [
      { key: "kunden", label: "Kunden", icon: Users, href: "/dashboard/kunden", color: "text-blue-600" },
      { key: "materialien", label: "Materialien", icon: Paintbrush, href: "/dashboard/material", color: "text-emerald-600" },
      { key: "leistungen", label: "Leistungen", icon: ClipboardList, href: "/dashboard/leistungen", color: "text-amber-600" },
      { key: "angebote", label: "Angebote", icon: FileSpreadsheet, href: "/dashboard/angebote", color: "text-purple-600" },
    ],
    quickActions: [
      { href: "/dashboard/firma", title: "Firmendaten pflegen", description: "Logo, Kontaktdaten und Einstellungen hinterlegen" },
      { href: "/dashboard/material", title: "Material anlegen", description: "Einkaufs- und Verkaufspreise verwalten" },
      { href: "/dashboard/leistungen", title: "Leistungen definieren", description: "Preise pro Einheit und Material-Verknüpfungen" },
    ],
    angebotEinleitung: "Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot für die Malerarbeiten:",
  },

  SHOP: {
    label: "Shop / E-Commerce",
    beschreibung: "Shop-Angebotssoftware",
    sidebarItems: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/firma", label: "Firmendaten", icon: Building2 },
      { href: "/dashboard/kunden", label: "Kunden", icon: Users },
      { href: "/dashboard/produkte", label: "Produkte", icon: Package },
      { href: "/dashboard/textvorlagen", label: "Textvorlagen", icon: FileText },
      { href: "/dashboard/angebote", label: "Angebote", icon: FileSpreadsheet },
      { href: "/dashboard/rechnungen", label: "Rechnungen", icon: Receipt },
      { href: "/dashboard/import", label: "AI-Import", icon: Sparkles },
      { href: "/dashboard/tutorial", label: "Einrichtungs-Guide", icon: GraduationCap },
    ],
    tutorialSteps: [
      {
        key: "hasFirma",
        nr: 1,
        title: "Firmendaten",
        icon: Building2,
        href: "/dashboard/firma",
        warum: "Deine Firmendaten erscheinen auf jedem Angebot: Briefkopf, Fusszeile, Bankverbindung.",
        beispiel: "Firmenname, Adresse, Telefon, IBAN, Logo hochladen.",
        color: "text-blue-600",
      },
      {
        key: "hasProdukte",
        nr: 2,
        title: "Produkte anlegen",
        icon: Package,
        href: "/dashboard/produkte",
        warum: "Produkte bilden deinen Katalog. Jedes Produkt hat einen Einkaufs- und Verkaufspreis. Beim Erstellen eines Angebots wählst du Produkte aus dem Katalog.",
        beispiel: 'Lege z.B. an: "Laptop Dell XPS 15" (Kategorie: Computer, EK 900 \u20AC, VK 1.299 \u20AC) oder "USB-C Kabel" (Kategorie: Zubehör, VK 12,90 \u20AC).',
        color: "text-emerald-600",
      },
      {
        key: "hasAngebote",
        nr: 3,
        title: "Erstes Angebot erstellen",
        icon: Sparkles,
        href: "/app/ai",
        warum: "Erstelle dein erstes Angebot: Entweder per AI-Texteingabe oder manuell im Formular.",
        beispiel: 'Text eingeben wie: "Angebot für 5x Laptop Dell, 10x Maus Logitech, 2x Monitor 27 Zoll".',
        color: "text-rose-600",
      },
    ],
    appFeatures: {
      hasRaeume: false,
      hasKalkRegeln: false,
      hasMaterial: false,
      hasLeistungen: false,
      hasProdukte: true,
      hasRaumvorlagen: false,
      hasRechnungen: true,
      hasUnterkuenfte: false,
      hasSaisons: false,
      hasFewoExtras: false,
      hasFahrraeder: false,
      hasMietdauerStaffeln: false,
      hasFahrradExtras: false,
    },
    registerPlaceholders: {
      firmenname: "Mein Shop GmbH",
      email: "info@mein-shop.de",
    },
    setupChecks: [
      { key: "hasFirma", label: "Firmendaten" },
      { key: "hasProdukte", label: "Produkte" },
      { key: "hasAngebote", label: "Angebot" },
    ],
    dashboardStats: [
      { key: "kunden", label: "Kunden", icon: Users, href: "/dashboard/kunden", color: "text-blue-600" },
      { key: "produkte", label: "Produkte", icon: Package, href: "/dashboard/produkte", color: "text-emerald-600" },
      { key: "angebote", label: "Angebote", icon: FileSpreadsheet, href: "/dashboard/angebote", color: "text-purple-600" },
      { key: "rechnungen", label: "Rechnungen", icon: Receipt, href: "/dashboard/rechnungen", color: "text-orange-600" },
    ],
    quickActions: [
      { href: "/dashboard/firma", title: "Firmendaten pflegen", description: "Logo, Kontaktdaten und Einstellungen hinterlegen" },
      { href: "/dashboard/produkte", title: "Produkte anlegen", description: "Produktkatalog mit EK- und VK-Preisen" },
      { href: "/app/ai", title: "Angebot erstellen", description: "Per AI oder manuell ein Angebot erstellen" },
    ],
    angebotEinleitung: "Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:",
  },

  FEWO: {
    label: "Ferienwohnung / Unterkunft",
    beschreibung: "Ferienwohnung-Angebotssoftware",
    sidebarItems: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/firma", label: "Firmendaten", icon: Building2 },
      { href: "/dashboard/kunden", label: "Kunden", icon: Users },
      { href: "/dashboard/unterkuenfte", label: "Unterkünfte", icon: Home },
      { href: "/dashboard/saisons", label: "Saisons", icon: CalendarRange },
      { href: "/dashboard/fewo-extras", label: "Extras", icon: Star },
      { href: "/dashboard/textvorlagen", label: "Textvorlagen", icon: FileText },
      { href: "/dashboard/angebote", label: "Angebote", icon: FileSpreadsheet },
      { href: "/dashboard/tutorial", label: "Einrichtungs-Guide", icon: GraduationCap },
    ],
    tutorialSteps: [
      {
        key: "hasFirma",
        nr: 1,
        title: "Firmendaten",
        icon: Building2,
        href: "/dashboard/firma",
        warum: "Deine Firmendaten erscheinen auf jedem Angebot: Briefkopf, Fusszeile, Bankverbindung.",
        beispiel: "Firmenname, Adresse, Telefon, IBAN, Logo hochladen.",
        color: "text-blue-600",
      },
      {
        key: "hasUnterkuenfte",
        nr: 2,
        title: "Unterkünfte anlegen",
        icon: Home,
        href: "/dashboard/unterkuenfte",
        warum: "Unterkünfte sind dein Katalog: Jede Wohnung/Zimmer bekommt einen Namen, Kapazität und Grundpreis pro Nacht. Beim Erstellen eines Angebots wählst du die passende Unterkunft aus.",
        beispiel: 'Lege z.B. an: "Ferienwohnung Seeblick" (Kapazität: 4 Personen, 85 €/Nacht) oder "Doppelzimmer Bergpanorama" (2 Personen, 65 €/Nacht).',
        color: "text-emerald-600",
      },
      {
        key: "hasSaisons",
        nr: 3,
        title: "Saisons definieren (optional)",
        icon: CalendarRange,
        href: "/dashboard/saisons",
        warum: "Saisons passen den Preis automatisch an: Hauptsaison teurer, Nebensaison günstiger. Saisonpreise werden pro Unterkunft festgelegt.",
        beispiel: 'Lege z.B. an: "Hauptsaison" (Juli-August) oder "Nebensaison" (November-März) und setze dann Preise pro Unterkunft.',
        color: "text-amber-600",
      },
      {
        key: "hasAngebote",
        nr: 4,
        title: "Erstes Angebot erstellen",
        icon: Sparkles,
        href: "/app/ai",
        warum: "Alles testen: AI-Eingabe oder Formular ausfüllen und das erste Angebot generieren.",
        beispiel: 'Anfrage einfügen wie: "Wir möchten vom 15.-22. Juli mit 2 Erwachsenen und Hund kommen."',
        color: "text-rose-600",
      },
    ],
    appFeatures: {
      hasRaeume: false,
      hasKalkRegeln: false,
      hasMaterial: false,
      hasLeistungen: false,
      hasProdukte: false,
      hasRaumvorlagen: false,
      hasRechnungen: false,
      hasUnterkuenfte: true,
      hasSaisons: true,
      hasFewoExtras: true,
      hasFahrraeder: false,
      hasMietdauerStaffeln: false,
      hasFahrradExtras: false,
    },
    registerPlaceholders: {
      firmenname: "Ferienwohnung Seeblick",
      email: "info@fewo-seeblick.de",
    },
    setupChecks: [
      { key: "hasFirma", label: "Firmendaten" },
      { key: "hasUnterkuenfte", label: "Unterkünfte" },
      { key: "hasAngebote", label: "Angebot" },
    ],
    dashboardStats: [
      { key: "kunden", label: "Gäste", icon: Users, href: "/dashboard/kunden", color: "text-blue-600" },
      { key: "unterkuenfte", label: "Unterkünfte", icon: Home, href: "/dashboard/unterkuenfte", color: "text-emerald-600" },
      { key: "saisons", label: "Saisons", icon: CalendarRange, href: "/dashboard/saisons", color: "text-amber-600" },
      { key: "angebote", label: "Angebote", icon: FileSpreadsheet, href: "/dashboard/angebote", color: "text-purple-600" },
    ],
    quickActions: [
      { href: "/dashboard/firma", title: "Firmendaten pflegen", description: "Logo, Kontaktdaten und Einstellungen hinterlegen" },
      { href: "/dashboard/unterkuenfte", title: "Unterkünfte anlegen", description: "Wohnungen und Zimmer mit Preisen verwalten" },
      { href: "/app/ai", title: "Angebot erstellen", description: "Per AI oder manuell ein Angebot erstellen" },
    ],
    angebotEinleitung: "Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot für Ihren Aufenthalt:",
  },

  FAHRRAD: {
    label: "Fahrradverleih",
    beschreibung: "Verleih-Angebotssoftware",
    sidebarItems: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/firma", label: "Firmendaten", icon: Building2 },
      { href: "/dashboard/kunden", label: "Kunden", icon: Users },
      { href: "/dashboard/fahrraeder", label: "Fahrräder", icon: Bike },
      { href: "/dashboard/mietdauer", label: "Mietdauer-Staffeln", icon: Clock },
      { href: "/dashboard/fahrrad-extras", label: "Extras", icon: Plus },
      { href: "/dashboard/textvorlagen", label: "Textvorlagen", icon: FileText },
      { href: "/dashboard/angebote", label: "Angebote", icon: FileSpreadsheet },
      { href: "/dashboard/rechnungen", label: "Rechnungen", icon: Receipt },
      { href: "/dashboard/tutorial", label: "Einrichtungs-Guide", icon: HelpCircle },
    ],
    tutorialSteps: [
      {
        key: "hasFirma",
        nr: 1,
        title: "Firmendaten",
        icon: Building2,
        href: "/dashboard/firma",
        warum: "Deine Firmendaten erscheinen auf jedem Angebot: Briefkopf, Fusszeile, Bankverbindung.",
        beispiel: "Firmenname, Adresse, Telefon, IBAN, Logo hochladen.",
        color: "text-blue-600",
      },
      {
        key: "hasFahrraeder",
        nr: 2,
        title: "Fahrräder anlegen",
        icon: Bike,
        href: "/dashboard/fahrraeder",
        warum: "Fahrräder bilden deinen Katalog. Jedes Rad bekommt einen Namen, Kategorie und Tagespreis. Beim Erstellen eines Angebots wählst du Fahrräder und Mengen aus.",
        beispiel: 'Lege z.B. an: "E-Bike Standard" (Kategorie: E-Bike, 25 \u20AC/Tag) oder "Kinderrad" (Kategorie: Kinderrad, 8 \u20AC/Tag).',
        color: "text-emerald-600",
      },
      {
        key: "hasMietdauerStaffeln",
        nr: 3,
        title: "Mietdauer-Staffeln (optional)",
        icon: Clock,
        href: "/dashboard/mietdauer",
        warum: "Staffelpreise machen längere Mieten günstiger. Definiere Tage-Bereiche und setze dann Staffelpreise pro Fahrrad.",
        beispiel: 'Lege z.B. an: "1\u20133 Tage" (bisTag: 3), "4\u20137 Tage" (bisTag: 7), "ab 8 Tage" (bisTag: 9999).',
        color: "text-amber-600",
      },
      {
        key: "hasAngebote",
        nr: 4,
        title: "Erstes Angebot erstellen",
        icon: Sparkles,
        href: "/app/fahrrad-formular",
        warum: "Alles testen: Fahrräder auswählen, Mietdauer eingeben und das erste Angebot generieren.",
        beispiel: 'Anfrage wie: "2 E-Bikes + 1 Kinderrad für 5 Tage ab 15. Juli".',
        color: "text-rose-600",
      },
    ],
    appFeatures: {
      hasRaeume: false,
      hasKalkRegeln: false,
      hasMaterial: false,
      hasLeistungen: false,
      hasProdukte: false,
      hasRaumvorlagen: false,
      hasRechnungen: true,
      hasUnterkuenfte: false,
      hasSaisons: false,
      hasFewoExtras: false,
      hasFahrraeder: true,
      hasMietdauerStaffeln: true,
      hasFahrradExtras: true,
    },
    registerPlaceholders: {
      firmenname: "Radverleih Sonnenschein",
      email: "info@radverleih-sonnenschein.de",
    },
    setupChecks: [
      { key: "hasFirma", label: "Firmendaten" },
      { key: "hasFahrraeder", label: "Fahrräder" },
      { key: "hasAngebote", label: "Angebot" },
    ],
    dashboardStats: [
      { key: "kunden", label: "Kunden", icon: Users, href: "/dashboard/kunden", color: "text-blue-600" },
      { key: "fahrraeder", label: "Fahrräder", icon: Bike, href: "/dashboard/fahrraeder", color: "text-emerald-600" },
      { key: "staffeln", label: "Staffeln", icon: Clock, href: "/dashboard/mietdauer", color: "text-amber-600" },
      { key: "angebote", label: "Angebote", icon: FileSpreadsheet, href: "/dashboard/angebote", color: "text-purple-600" },
    ],
    quickActions: [
      { href: "/dashboard/firma", title: "Firmendaten pflegen", description: "Logo, Kontaktdaten und Einstellungen hinterlegen" },
      { href: "/dashboard/fahrraeder", title: "Fahrräder anlegen", description: "Fahrradkatalog mit Tagespreisen verwalten" },
      { href: "/app/fahrrad-formular", title: "Angebot erstellen", description: "Fahrräder, Mietdauer und Extras konfigurieren" },
    ],
    angebotEinleitung: "Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot für Ihren Fahrradverleih:",
  },
};

export function getBrancheConfig(branche: Branche): BrancheConfig {
  return BRANCHE_CONFIG[branche] || BRANCHE_CONFIG.MALER;
}
