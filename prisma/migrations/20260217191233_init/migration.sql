-- CreateEnum
CREATE TYPE "Rolle" AS ENUM ('INHABER', 'MITARBEITER', 'BUERO');

-- CreateEnum
CREATE TYPE "KundenTyp" AS ENUM ('PRIVAT', 'GEWERBE', 'HAUSVERWALTUNG');

-- CreateEnum
CREATE TYPE "MaterialKat" AS ENUM ('WANDFARBE', 'GRUNDIERUNG', 'SPACHTEL', 'LACK', 'VERBRAUCH', 'TAPETE', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "LeistungsKat" AS ENUM ('STREICHEN', 'VORBEREITUNG', 'LACKIEREN', 'FASSADE', 'BODEN', 'TAPEZIEREN', 'TROCKENBAU', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "WertTyp" AS ENUM ('PROZENT', 'PAUSCHAL');

-- CreateEnum
CREATE TYPE "VorlagenTyp" AS ENUM ('ANGEBOT_INTRO', 'ANGEBOT_SCHLUSS', 'FOLLOWUP_TAG3', 'FOLLOWUP_TAG7', 'FOLLOWUP_TAG12', 'GOOGLE_BEWERTUNG', 'SONSTIGE');

-- CreateEnum
CREATE TYPE "AngebotsStatus" AS ENUM ('ENTWURF', 'OFFEN', 'ANGENOMMEN', 'ABGELEHNT', 'ABGELAUFEN');

-- CreateEnum
CREATE TYPE "EingabeMethode" AS ENUM ('SPRACHE', 'TEXT_EMAIL', 'TEXT_WHATSAPP', 'TEXT_SONSTIG', 'FORMULAR');

-- CreateEnum
CREATE TYPE "PositionsTyp" AS ENUM ('LEISTUNG', 'MATERIAL', 'ZUSCHLAG', 'RABATT', 'ANFAHRT');

-- CreateEnum
CREATE TYPE "FollowUpTyp" AS ENUM ('TAG3', 'TAG7', 'TAG12', 'GOOGLE_BEWERTUNG');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('GEPLANT', 'GESENDET', 'ABGEBROCHEN');

-- CreateTable
CREATE TABLE "Firma" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firmenname" TEXT NOT NULL,
    "inhaberName" TEXT NOT NULL,
    "inhaberTitel" TEXT,
    "strasse" TEXT NOT NULL,
    "plz" TEXT NOT NULL,
    "ort" TEXT NOT NULL,
    "telefon" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "steuernummer" TEXT,
    "ustIdNr" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "bankname" TEXT,
    "logoUrl" TEXT,
    "mwstSatz" DOUBLE PRECISION NOT NULL DEFAULT 19.0,
    "stundensatz" DOUBLE PRECISION NOT NULL DEFAULT 47.0,
    "zahlungsziel" INTEGER NOT NULL DEFAULT 14,
    "angebotsGueltig" INTEGER NOT NULL DEFAULT 14,
    "nrPrefix" TEXT NOT NULL DEFAULT 'ANG-',
    "nrCounter" INTEGER NOT NULL DEFAULT 1,
    "agbText" TEXT,
    "googleReviewUrl" TEXT,

    CONSTRAINT "Firma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rolle" "Rolle" NOT NULL DEFAULT 'INHABER',
    "firmaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kunde" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "typ" "KundenTyp" NOT NULL DEFAULT 'PRIVAT',
    "strasse" TEXT,
    "plz" TEXT,
    "ort" TEXT,
    "email" TEXT,
    "telefon" TEXT,
    "telefon2" TEXT,
    "notizen" TEXT,
    "stammkunde" BOOLEAN NOT NULL DEFAULT false,
    "rabattProzent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kunde_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kategorie" "MaterialKat" NOT NULL,
    "artikelNr" TEXT,
    "ekPreis" DOUBLE PRECISION NOT NULL,
    "vkPreis" DOUBLE PRECISION NOT NULL,
    "einheit" TEXT NOT NULL,
    "ergiebigkeit" DOUBLE PRECISION,
    "anstriche" INTEGER,
    "lieferant" TEXT,
    "lieferantNr" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "notizen" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leistung" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kategorie" "LeistungsKat" NOT NULL,
    "einheit" TEXT NOT NULL,
    "preisProEinheit" DOUBLE PRECISION NOT NULL,
    "sqmProStunde" DOUBLE PRECISION,
    "materialKat" "MaterialKat",
    "beschreibung" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Leistung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zuschlag" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "typ" "WertTyp" NOT NULL,
    "wert" DOUBLE PRECISION NOT NULL,
    "proEinheit" TEXT,
    "automatisch" BOOLEAN NOT NULL DEFAULT false,
    "bedingung" TEXT,
    "bedingungFeld" TEXT,
    "bedingungOp" TEXT,
    "bedingungWert" DOUBLE PRECISION,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Zuschlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rabatt" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "typ" "WertTyp" NOT NULL,
    "wert" DOUBLE PRECISION NOT NULL,
    "bedingung" TEXT,
    "automatisch" BOOLEAN NOT NULL DEFAULT false,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Rabatt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaumVorlage" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "laenge" DOUBLE PRECISION NOT NULL,
    "breite" DOUBLE PRECISION NOT NULL,
    "hoehe" DOUBLE PRECISION NOT NULL,
    "fenster" INTEGER NOT NULL DEFAULT 1,
    "tueren" INTEGER NOT NULL DEFAULT 1,
    "sortierung" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RaumVorlage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KalkulationsRegeln" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "verschnittFaktor" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "standardAnstriche" INTEGER NOT NULL DEFAULT 2,
    "grundierungImmer" BOOLEAN NOT NULL DEFAULT true,
    "abklebebandProRaum" INTEGER NOT NULL DEFAULT 2,
    "abdeckfolieProRaum" INTEGER NOT NULL DEFAULT 1,
    "acrylProRaum" INTEGER NOT NULL DEFAULT 0,
    "anfahrtKlein" DOUBLE PRECISION NOT NULL DEFAULT 35.0,
    "anfahrtGross" DOUBLE PRECISION NOT NULL DEFAULT 55.0,
    "anfahrtSchwelle" INTEGER NOT NULL DEFAULT 3,
    "standardQualitaet" TEXT NOT NULL DEFAULT 'standard',
    "deckeStandard" BOOLEAN NOT NULL DEFAULT false,
    "grundierungStandard" BOOLEAN NOT NULL DEFAULT true,
    "zuschlagAutoErkennen" BOOLEAN NOT NULL DEFAULT true,
    "fensterAbzug" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "tuerAbzug" DOUBLE PRECISION NOT NULL DEFAULT 2.0,

    CONSTRAINT "KalkulationsRegeln_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TextVorlage" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "typ" "VorlagenTyp" NOT NULL,
    "betreff" TEXT,
    "text" TEXT NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TextVorlage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Angebot" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "kundeId" TEXT,
    "nummer" TEXT NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gueltigBis" TIMESTAMP(3) NOT NULL,
    "status" "AngebotsStatus" NOT NULL DEFAULT 'OFFEN',
    "statusAenderung" TIMESTAMP(3),
    "eingabeMethode" "EingabeMethode" NOT NULL,
    "originalText" TEXT,
    "kundeName" TEXT NOT NULL,
    "kundeStrasse" TEXT,
    "kundePlz" TEXT,
    "kundeOrt" TEXT,
    "kundeEmail" TEXT,
    "kundeTelefon" TEXT,
    "materialNetto" DOUBLE PRECISION NOT NULL,
    "arbeitsNetto" DOUBLE PRECISION NOT NULL,
    "anfahrt" DOUBLE PRECISION NOT NULL,
    "zuschlagNetto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rabattNetto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netto" DOUBLE PRECISION NOT NULL,
    "mwstBetrag" DOUBLE PRECISION NOT NULL,
    "brutto" DOUBLE PRECISION NOT NULL,
    "einleitungsText" TEXT,
    "schlussText" TEXT,
    "pdfUrl" TEXT,
    "bewertungAngefragt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Angebot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AngebotPosition" (
    "id" TEXT NOT NULL,
    "angebotId" TEXT NOT NULL,
    "posNr" INTEGER NOT NULL,
    "typ" "PositionsTyp" NOT NULL,
    "raumName" TEXT,
    "raumLaenge" DOUBLE PRECISION,
    "raumBreite" DOUBLE PRECISION,
    "raumHoehe" DOUBLE PRECISION,
    "raumFenster" INTEGER,
    "raumTueren" INTEGER,
    "wandflaeche" DOUBLE PRECISION,
    "deckenflaeche" DOUBLE PRECISION,
    "bezeichnung" TEXT NOT NULL,
    "menge" DOUBLE PRECISION NOT NULL,
    "einheit" TEXT NOT NULL,
    "einzelpreis" DOUBLE PRECISION NOT NULL,
    "gesamtpreis" DOUBLE PRECISION NOT NULL,
    "leistungId" TEXT,
    "materialId" TEXT,
    "sortierung" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AngebotPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "angebotId" TEXT NOT NULL,
    "typ" "FollowUpTyp" NOT NULL,
    "geplanterVersand" TIMESTAMP(3) NOT NULL,
    "gesendetAm" TIMESTAMP(3),
    "status" "FollowUpStatus" NOT NULL DEFAULT 'GEPLANT',
    "kanal" TEXT NOT NULL DEFAULT 'email',

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "KalkulationsRegeln_firmaId_key" ON "KalkulationsRegeln"("firmaId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kunde" ADD CONSTRAINT "Kunde_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leistung" ADD CONSTRAINT "Leistung_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zuschlag" ADD CONSTRAINT "Zuschlag_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rabatt" ADD CONSTRAINT "Rabatt_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaumVorlage" ADD CONSTRAINT "RaumVorlage_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KalkulationsRegeln" ADD CONSTRAINT "KalkulationsRegeln_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TextVorlage" ADD CONSTRAINT "TextVorlage_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Angebot" ADD CONSTRAINT "Angebot_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Angebot" ADD CONSTRAINT "Angebot_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AngebotPosition" ADD CONSTRAINT "AngebotPosition_angebotId_fkey" FOREIGN KEY ("angebotId") REFERENCES "Angebot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_angebotId_fkey" FOREIGN KEY ("angebotId") REFERENCES "Angebot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
