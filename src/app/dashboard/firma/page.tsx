"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Save, Loader2, Upload, Trash2 } from "lucide-react";
import { HelpTour } from "@/components/dashboard/help-tour";

interface FirmaData {
  id: string;
  firmenname: string;
  inhaberName: string;
  inhaberTitel: string | null;
  strasse: string;
  plz: string;
  ort: string;
  telefon: string;
  email: string;
  website: string | null;
  steuernummer: string | null;
  ustIdNr: string | null;
  iban: string | null;
  bic: string | null;
  bankname: string | null;
  mwstSatz: number;
  stundensatz: number;
  zahlungsziel: number;
  angebotsGueltig: number;
  nrPrefix: string;
  rechnungNrPrefix: string;
  agbText: string | null;
  logoUrl: string | null;
  googleReviewUrl: string | null;
  branche?: string;
}

export default function FirmaPage() {
  return <Suspense><FirmaContent /></Suspense>;
}

function FirmaContent() {
  const searchParams = useSearchParams();
  const guideMode = searchParams.get("guide") === "1";

  const [firma, setFirma] = useState<FirmaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !firma) return;
    if (file.size > 500_000) {
      toast.error("Logo darf max. 500 KB sein");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFirma({ ...firma, logoUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    fetch("/api/firma")
      .then((res) => res.json())
      .then((data) => {
        setFirma(data);
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    if (!firma) return;
    setSaving(true);
    const res = await fetch("/api/firma", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(firma),
    });

    if (res.ok) {
      toast.success("Firmendaten gespeichert");
    } else {
      toast.error("Fehler beim Speichern");
    }
    setSaving(false);
  }

  function update(field: keyof FirmaData, value: string | number) {
    if (!firma) return;
    setFirma({ ...firma, [field]: value });
  }

  if (loading) {
    return (
      <>
        <Header title="Firmendaten" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!firma) return null;

  return (
    <>
      <Header
        title="Firmendaten"
        description="Stammdaten, Bankverbindung und Angebotseinstellungen"
        actions={
          <div className="flex gap-2">
            <HelpTour
              autoStart={guideMode && !loading}
              steps={[
                { element: "[data-tour='logo']", popover: { title: "Firmenlogo", description: "Wird oben links im PDF-Angebot angezeigt. Max. 500 KB, am besten PNG mit transparentem Hintergrund." } },
                { element: "[data-tour='stammdaten']", popover: { title: "Stammdaten", description: "Firmenname und Adresse erscheinen im Briefkopf jedes Angebots. Mindestens Firmenname und Strasse ausfüllen." } },
                { element: "[data-tour='bank']", popover: { title: "Bankverbindung", description: "IBAN und Bankname erscheinen in der Fusszeile des Angebots. Wichtig für professionelle Angebote." } },
                { element: "[data-tour='einstellungen']", popover: { title: "Angebotseinstellungen", description: "MwSt-Satz (Standard 19%), Zahlungsziel und Gültigkeit werden auf jedes neue Angebot angewendet. Die Defaults passen meist schon." } },
              ]}
            />
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Speichern
            </Button>
          </div>
        }
      />
      <div className="p-8 max-w-4xl space-y-6">
        {/* Logo */}
        <Card data-tour="logo">
          <CardHeader>
            <CardTitle>Firmenlogo</CardTitle>
            <CardDescription>Wird im PDF-Header angezeigt (max. 500 KB)</CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <div className="flex items-center gap-4">
              {firma.logoUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={firma.logoUrl}
                    alt="Firmenlogo"
                    className="h-16 max-w-[200px] object-contain rounded border p-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white hover:bg-destructive/90"
                    onClick={() => setFirma({ ...firma, logoUrl: null })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div
                  className="h-16 w-40 rounded border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => logoRef.current?.click()}
                >
                  <span className="text-xs text-muted-foreground">Kein Logo</span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => logoRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {firma.logoUrl ? "Ändern" : "Hochladen"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stammdaten */}
        <Card data-tour="stammdaten">
          <CardHeader>
            <CardTitle>Stammdaten</CardTitle>
            <CardDescription>Firmierung und Kontaktdaten</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Firmenname</Label>
                <Input
                  value={firma.firmenname}
                  onChange={(e) => update("firmenname", e.target.value)}
                  placeholder="Malerbetrieb Schneider"
                />
              </div>
              <div className="space-y-2">
                <Label>Inhaber</Label>
                <Input
                  value={firma.inhaberName}
                  onChange={(e) => update("inhaberName", e.target.value)}
                  placeholder="Thomas Schneider"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Titel</Label>
                <Input
                  value={firma.inhaberTitel ?? ""}
                  onChange={(e) => update("inhaberTitel", e.target.value)}
                  placeholder="Malermeister"
                />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  value={firma.website ?? ""}
                  onChange={(e) => update("website", e.target.value)}
                  placeholder="www.maler-schneider.de"
                />
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Strasse</Label>
              <Input
                value={firma.strasse}
                onChange={(e) => update("strasse", e.target.value)}
                placeholder="Handwerksweg 12"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>PLZ</Label>
                <Input
                  value={firma.plz}
                  onChange={(e) => update("plz", e.target.value)}
                  placeholder="26721"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Ort</Label>
                <Input
                  value={firma.ort}
                  onChange={(e) => update("ort", e.target.value)}
                  placeholder="Emden"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input
                  value={firma.telefon}
                  onChange={(e) => update("telefon", e.target.value)}
                  placeholder="04921-555 123"
                />
              </div>
              <div className="space-y-2">
                <Label>E-Mail</Label>
                <Input
                  value={firma.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="info@maler-schneider.de"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Steuer & Bank */}
        <Card data-tour="bank">
          <CardHeader>
            <CardTitle>Steuer & Bankverbindung</CardTitle>
            <CardDescription>Erscheint auf Angeboten und Rechnungen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Steuernummer</Label>
                <Input
                  value={firma.steuernummer ?? ""}
                  onChange={(e) => update("steuernummer", e.target.value)}
                  placeholder="59/123/45678"
                />
              </div>
              <div className="space-y-2">
                <Label>USt-IdNr.</Label>
                <Input
                  value={firma.ustIdNr ?? ""}
                  onChange={(e) => update("ustIdNr", e.target.value)}
                  placeholder="DE123456789"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>IBAN</Label>
              <Input
                value={firma.iban ?? ""}
                onChange={(e) => update("iban", e.target.value)}
                placeholder="DE89 3704 0044 0532 0130 00"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>BIC</Label>
                <Input
                  value={firma.bic ?? ""}
                  onChange={(e) => update("bic", e.target.value)}
                  placeholder="COBADEFFXXX"
                />
              </div>
              <div className="space-y-2">
                <Label>Bankname</Label>
                <Input
                  value={firma.bankname ?? ""}
                  onChange={(e) => update("bankname", e.target.value)}
                  placeholder="Commerzbank Emden"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Angebotseinstellungen */}
        <Card data-tour="einstellungen">
          <CardHeader>
            <CardTitle>Angebotseinstellungen</CardTitle>
            <CardDescription>Standard-Werte für neue Angebote</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>MwSt-Satz (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={firma.mwstSatz}
                  onChange={(e) => update("mwstSatz", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Stundensatz (EUR)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={firma.stundensatz}
                  onChange={(e) => update("stundensatz", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Zahlungsziel (Tage)</Label>
                <Input
                  type="number"
                  value={firma.zahlungsziel}
                  onChange={(e) => update("zahlungsziel", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Gültigkeit (Tage)</Label>
                <Input
                  type="number"
                  value={firma.angebotsGueltig}
                  onChange={(e) => update("angebotsGueltig", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Angebotsnr.-Prefix</Label>
                <Input
                  value={firma.nrPrefix}
                  onChange={(e) => update("nrPrefix", e.target.value)}
                  placeholder="ANG-"
                />
              </div>
              <div className="space-y-2">
                <Label>Google-Bewertungslink</Label>
                <Input
                  value={firma.googleReviewUrl ?? ""}
                  onChange={(e) => update("googleReviewUrl", e.target.value)}
                  placeholder="https://g.page/r/..."
                />
              </div>
            </div>
            {firma.branche === "SHOP" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rechnungsnr.-Prefix</Label>
                  <Input
                    value={firma.rechnungNrPrefix ?? "RE-"}
                    onChange={(e) => update("rechnungNrPrefix", e.target.value)}
                    placeholder="RE-"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>AGB / Fusszeile</Label>
              <Textarea
                value={firma.agbText ?? ""}
                onChange={(e) => update("agbText", e.target.value)}
                placeholder="Es gelten unsere AGB..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
