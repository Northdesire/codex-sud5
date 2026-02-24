"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  Send,
  Pencil,
  Copy,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { formatEuro } from "@/lib/kalkulation";

interface AngebotDetail {
  id: string;
  nummer: string;
  datum: string;
  gueltigBis: string;
  status: string;
  kundeName: string;
  kundeStrasse: string | null;
  kundePlz: string | null;
  kundeOrt: string | null;
  kundeEmail: string | null;
  kundeTelefon: string | null;
  materialNetto: number;
  arbeitsNetto: number;
  anfahrt: number;
  netto: number;
  mwstBetrag: number;
  brutto: number;
  mwstSatz?: number;
  anreise?: string | null;
  abreise?: string | null;
  naechte?: number | null;
  personen?: number | null;
  positionen: Array<{
    posNr: number;
    typ: string;
    bezeichnung: string;
    menge: number;
    einheit: string;
    einzelpreis: number;
    gesamtpreis: number;
  }>;
  firma: {
    firmenname: string;
    inhaberName: string;
    inhaberTitel: string | null;
    strasse: string;
    plz: string;
    ort: string;
    telefon: string;
    email: string;
    iban: string | null;
    bic: string | null;
    bankname: string | null;
    zahlungsziel: number;
    mwstSatz: number;
  };
  rechnung?: { id: string; nummer: string } | null;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  ENTWURF: { label: "Entwurf", variant: "secondary" },
  OFFEN: { label: "Offen", variant: "default" },
  ANGENOMMEN: { label: "Angenommen", variant: "outline" },
  ABGELEHNT: { label: "Abgelehnt", variant: "destructive" },
  ABGELAUFEN: { label: "Abgelaufen", variant: "secondary" },
};

export default function AngebotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<AngebotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [creatingRechnung, setCreatingRechnung] = useState(false);

  useEffect(() => {
    fetch(`/api/angebote/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  async function updateStatus(status: string) {
    if (updating) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/angebote/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setData((prev) => (prev ? { ...prev, status } : prev));
        toast.success(status === "ANGENOMMEN" ? "Angebot angenommen" : "Angebot abgelehnt");

        // SHOP: Auto-Rechnung erstellen bei ANGENOMMEN
        if (status === "ANGENOMMEN" && isShop) {
          try {
            const rRes = await fetch("/api/rechnungen/aus-angebot", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ angebotId: id }),
            });
            if (rRes.ok) {
              const rData = await rRes.json();
              toast.success(`Rechnung ${rData.nummer} erstellt`);
              router.push(`/app/rechnungen/${rData.id}`);
              return;
            }
          } catch {
            // Rechnung-Erstellung optional
          }
        }
      }
    } catch (error) {
      console.error("Status update Fehler:", error);
    } finally {
      setUpdating(false);
    }
  }

  async function handlePDF() {
    if (!data || pdfLoading) return;
    setPdfLoading(true);
    try {
      const { generateAngebotPDF } = await import("@/lib/pdf");
      const mwstSatz = data.mwstSatz ?? data.firma?.mwstSatz ?? 19;
      const blob = generateAngebotPDF({
        nummer: data.nummer,
        datum: new Date(data.datum),
        gueltigBis: new Date(data.gueltigBis),
        kunde: {
          name: data.kundeName,
          strasse: data.kundeStrasse || undefined,
          plz: data.kundePlz || undefined,
          ort: data.kundeOrt || undefined,
        },
        firma: data.firma,
        positionen: data.positionen,
        materialNetto: data.materialNetto,
        arbeitsNetto: data.arbeitsNetto,
        anfahrt: data.anfahrt,
        netto: data.netto,
        mwstSatz,
        mwstBetrag: data.mwstBetrag,
        brutto: data.brutto,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.nummer}_${data.kundeName.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF Fehler:", error);
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleSenden() {
    if (!data || sending) return;
    if (!data.kundeEmail) {
      alert("Keine E-Mail-Adresse beim Kunden hinterlegt.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/angebote/${id}/senden`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Senden fehlgeschlagen");
      }
      setData((prev) => prev ? { ...prev, status: prev.status === "ENTWURF" ? "OFFEN" : prev.status } : prev);
      alert(`Angebot wurde an ${data.kundeEmail} gesendet!`);
    } catch (error) {
      console.error("Senden Fehler:", error);
      alert(error instanceof Error ? error.message : "Fehler beim Senden");
    } finally {
      setSending(false);
    }
  }

  function handleBearbeiten() {
    if (!data) return;
    const isFewoAngebot = !!(data.anreise || data.abreise || data.naechte);
    const isFahrradAngebot = isFewoAngebot && data.positionen.some((p) => p.typ === "PRODUKT" && p.bezeichnung.includes("×"));
    const isShopAngebot = !isFewoAngebot && data.positionen.some((p) => p.typ === "PRODUKT");
    const kundeData = {
      name: data.kundeName,
      strasse: data.kundeStrasse || "",
      plz: data.kundePlz || "",
      ort: data.kundeOrt || "",
      email: data.kundeEmail || "",
      telefon: data.kundeTelefon || "",
    };

    if (isFahrradAngebot) {
      sessionStorage.setItem("edit-angebot-id", data.id);
      router.push("/app/fahrrad-formular");
      return;
    }

    if (isFewoAngebot) {
      sessionStorage.setItem("edit-angebot-id", data.id);
      router.push("/app/fewo-formular");
      return;
    }

    if (isShopAngebot) {
      // Shop: Positionen als Produkte ins shop-formular laden
      const shopDaten = {
        kunde: kundeData,
        produkte: data.positionen.map((p) => ({
          name: p.bezeichnung,
          menge: p.menge,
          einheit: p.einheit,
          preis: p.einzelpreis,
        })),
      };
      sessionStorage.setItem("ai-ergebnis", JSON.stringify(shopDaten));
      sessionStorage.setItem("edit-angebot-id", data.id);
      router.push("/app/shop-formular");
    } else {
      // Maler: Original-Flow
      const formularDaten = {
        kunde: kundeData,
        arbeitsbereiche: [] as Array<Record<string, unknown>>,
        qualitaet: "standard",
        extras: [] as Array<Record<string, unknown>>,
      };
      sessionStorage.setItem("ai-ergebnis", JSON.stringify(formularDaten));
      sessionStorage.setItem("kalkulation", JSON.stringify({
        raeume: [],
        positionen: data.positionen,
        materialNetto: data.materialNetto,
        arbeitsNetto: data.arbeitsNetto,
        anfahrt: data.anfahrt,
        zuschlagNetto: 0,
        rabattNetto: 0,
        netto: data.netto,
        mwstSatz: data.mwstSatz ?? data.firma?.mwstSatz ?? 19,
        mwstBetrag: data.mwstBetrag,
        brutto: data.brutto,
        kunde: kundeData,
        firma: data.firma,
      }));
      router.push("/app/formular");
    }
  }

  async function handleDuplizieren() {
    if (!data) return;
    try {
      const res = await fetch(`/api/angebote/${id}/duplizieren`, { method: "POST" });
      if (!res.ok) throw new Error("Duplizieren fehlgeschlagen");
      const result = await res.json();
      toast.success(`Angebot ${result.nummer} erstellt`);
      router.push(`/app/uebersicht/${result.id}`);
    } catch {
      toast.error("Fehler beim Duplizieren");
    }
  }

  async function handleRechnungErstellen() {
    if (!data || creatingRechnung) return;
    setCreatingRechnung(true);
    try {
      const res = await fetch("/api/rechnungen/aus-angebot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ angebotId: id }),
      });
      if (!res.ok) {
        const err = await res.json();
        if (res.status === 409 && err.rechnungId) {
          toast.info("Rechnung existiert bereits");
          router.push(`/app/rechnungen/${err.rechnungId}`);
          return;
        }
        throw new Error(err.error || "Fehler beim Erstellen");
      }
      const result = await res.json();
      toast.success(`Rechnung ${result.nummer} erstellt`);
      router.push(`/app/rechnungen/${result.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Erstellen der Rechnung");
    } finally {
      setCreatingRechnung(false);
    }
  }

  if (loading) {
    return (
      <div className="px-5 pt-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-5 pt-8 text-center">
        <p className="text-muted-foreground">Angebot nicht gefunden</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/app/uebersicht")}
        >
          Zurück
        </Button>
      </div>
    );
  }

  const cfg = statusConfig[data.status] || statusConfig.ENTWURF;
  const isFewo = !!(data.anreise || data.abreise || data.naechte);
  const isFahrrad = isFewo && data.positionen.some((p) => p.typ === "PRODUKT" && p.bezeichnung.includes("×"));
  const isShop = !isFewo && data.positionen.some((p) => p.typ === "PRODUKT");
  const leistungen = data.positionen.filter((p) => p.typ === "LEISTUNG");
  const materialien = data.positionen.filter((p) => p.typ === "MATERIAL");
  const produktPositionen = data.positionen.filter((p) => p.typ === "PRODUKT" || p.typ === "VERSAND");
  const anfahrtPos = data.positionen.find((p) => p.typ === "ANFAHRT");
  const mwstSatz = data.mwstSatz ?? data.firma?.mwstSatz ?? 19;

  return (
    <div className="px-4 pt-5 pb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/app/uebersicht")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <p className="font-bold">{data.nummer}</p>
          <p className="text-xs text-muted-foreground">{data.kundeName}</p>
        </div>
        <Badge variant={cfg.variant}>{cfg.label}</Badge>
      </div>

      {/* Angebots-Inhalt */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Kunde */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Kunde</p>
            <p className="font-medium text-sm">{data.kundeName}</p>
            {data.kundeStrasse && (
              <p className="text-sm text-muted-foreground">
                {data.kundeStrasse}
              </p>
            )}
            {(data.kundePlz || data.kundeOrt) && (
              <p className="text-sm text-muted-foreground">
                {data.kundePlz} {data.kundeOrt}
              </p>
            )}
          </div>

          {/* FEWO/FAHRRAD: Aufenthalt/Mietdauer */}
          {isFewo && (data.anreise || data.abreise) && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {isFahrrad ? "Mietdauer" : "Aufenthalt"}
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {data.anreise && (
                    <div>
                      <p className="text-muted-foreground text-xs">{isFahrrad ? "Mietbeginn" : "Anreise"}</p>
                      <p className="font-medium">{new Date(data.anreise).toLocaleDateString("de-DE")}</p>
                    </div>
                  )}
                  {data.abreise && (
                    <div>
                      <p className="text-muted-foreground text-xs">{isFahrrad ? "Mietende" : "Abreise"}</p>
                      <p className="font-medium">{new Date(data.abreise).toLocaleDateString("de-DE")}</p>
                    </div>
                  )}
                  {data.naechte && (
                    <div>
                      <p className="text-muted-foreground text-xs">{isFahrrad ? "Tage" : "Nächte"}</p>
                      <p className="font-medium">{data.naechte}</p>
                    </div>
                  )}
                  {data.personen && (
                    <div>
                      <p className="text-muted-foreground text-xs">Personen</p>
                      <p className="font-medium">{data.personen}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Shop: Produkte */}
          {isShop && produktPositionen.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Produkte
              </p>
              <div className="space-y-1">
                {produktPositionen.map((p) => (
                  <div
                    key={p.posNr}
                    className="flex justify-between text-sm py-1"
                  >
                    <div>
                      <p>{p.bezeichnung}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.menge} {p.einheit} × {formatEuro(p.einzelpreis)}
                      </p>
                    </div>
                    <p className="font-mono font-medium shrink-0 ml-4">
                      {formatEuro(p.gesamtpreis)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Maler: Leistungen */}
          {!isShop && leistungen.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Arbeitsleistungen
              </p>
              <div className="space-y-1">
                {leistungen.map((p) => (
                  <div
                    key={p.posNr}
                    className="flex justify-between text-sm py-1"
                  >
                    <div>
                      <p>{p.bezeichnung}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.menge.toFixed(1)} {p.einheit} ×{" "}
                        {formatEuro(p.einzelpreis)}
                      </p>
                    </div>
                    <p className="font-mono font-medium shrink-0 ml-4">
                      {formatEuro(p.gesamtpreis)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Maler: Material */}
          {!isShop && materialien.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Material
              </p>
              <div className="space-y-1">
                {materialien.map((p) => (
                  <div
                    key={p.posNr}
                    className="flex justify-between text-sm py-1"
                  >
                    <div>
                      <p>{p.bezeichnung}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.menge} {p.einheit} × {formatEuro(p.einzelpreis)}
                      </p>
                    </div>
                    <p className="font-mono font-medium shrink-0 ml-4">
                      {formatEuro(p.gesamtpreis)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Maler: Anfahrt */}
          {!isShop && anfahrtPos && (
            <div className="flex justify-between text-sm">
              <p>Anfahrtspauschale</p>
              <p className="font-mono font-medium">
                {formatEuro(anfahrtPos.gesamtpreis)}
              </p>
            </div>
          )}

          <Separator />

          {/* Summen */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <p className="text-muted-foreground">Netto</p>
              <p className="font-mono">{formatEuro(data.netto)}</p>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <p>MwSt. ({mwstSatz}%)</p>
              <p className="font-mono">{formatEuro(data.mwstBetrag)}</p>
            </div>
            <div className="flex justify-between text-lg font-bold pt-1">
              <p>Brutto</p>
              <p className="font-mono text-primary">
                {formatEuro(data.brutto)}
              </p>
            </div>
          </div>

          <Separator />

          <div className="text-xs text-muted-foreground">
            <p>
              Datum: {new Date(data.datum).toLocaleDateString("de-DE")} |
              Gültig bis:{" "}
              {new Date(data.gueltigBis).toLocaleDateString("de-DE")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Aktionen */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12" onClick={handlePDF} disabled={pdfLoading}>
          {pdfLoading ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1" />
          )}
          PDF
        </Button>

        {(data.status === "ENTWURF" || data.status === "OFFEN") && (
          <Button
            className="h-12"
            onClick={handleSenden}
            disabled={sending}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            {data.kundeEmail ? "Per E-Mail senden" : "Keine E-Mail"}
          </Button>
        )}

        {(data.status === "ENTWURF" || data.status === "OFFEN") && (
          <>
            <Button
              className="h-12 bg-green-600 hover:bg-green-700"
              onClick={() => updateStatus("ANGENOMMEN")}
              disabled={updating}
            >
              {updating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1" />
              )}
              Angenommen
            </Button>
            <Button
              className="h-12"
              variant="destructive"
              onClick={() => updateStatus("ABGELEHNT")}
              disabled={updating}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Abgelehnt
            </Button>
          </>
        )}

        {data.status === "ANGENOMMEN" && (
          data.rechnung ? (
            <Button
              className="h-12 col-span-2"
              variant="outline"
              onClick={() => router.push(`/app/rechnungen/${data.rechnung!.id}`)}
            >
              <Receipt className="h-4 w-4 mr-1" />
              Zur Rechnung {data.rechnung.nummer}
            </Button>
          ) : (
            <Button
              className="h-12 col-span-2 bg-green-600 hover:bg-green-700"
              onClick={handleRechnungErstellen}
              disabled={creatingRechnung}
            >
              {creatingRechnung ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Receipt className="h-4 w-4 mr-1" />
              )}
              Rechnung erstellen
            </Button>
          )
        )}

        <Button variant="outline" className="h-12" onClick={handleBearbeiten}>
          <Pencil className="h-4 w-4 mr-1" />
          Bearbeiten
        </Button>

        <Button variant="outline" className="h-12" onClick={handleDuplizieren}>
          <Copy className="h-4 w-4 mr-1" />
          Duplizieren
        </Button>
      </div>
    </div>
  );
}
