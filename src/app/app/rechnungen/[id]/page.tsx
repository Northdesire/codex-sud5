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
  Send,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatEuro } from "@/lib/kalkulation";

interface RechnungDetail {
  id: string;
  nummer: string;
  datum: string;
  faelligAm: string;
  status: string;
  bezahltAm: string | null;
  kundeName: string;
  kundeStrasse: string | null;
  kundePlz: string | null;
  kundeOrt: string | null;
  kundeEmail: string | null;
  netto: number;
  mwstSatz: number;
  mwstBetrag: number;
  brutto: number;
  einleitungsText: string | null;
  schlussText: string | null;
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
    mwstSatz: number;
    steuernummer?: string | null;
    ustIdNr?: string | null;
    agbText?: string | null;
    logoUrl?: string | null;
  };
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  ENTWURF: { label: "Entwurf", variant: "secondary" },
  OFFEN: { label: "Offen", variant: "default" },
  BEZAHLT: { label: "Bezahlt", variant: "outline" },
  STORNIERT: { label: "Storniert", variant: "destructive" },
};

export default function RechnungDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<RechnungDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(`/api/rechnungen/${id}`)
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
      const res = await fetch(`/api/rechnungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setData((prev) =>
          prev
            ? {
                ...prev,
                status,
                bezahltAm: updated.bezahltAm || prev.bezahltAm,
              }
            : prev
        );
        toast.success(
          status === "BEZAHLT"
            ? "Als bezahlt markiert"
            : status === "STORNIERT"
              ? "Rechnung storniert"
              : "Status aktualisiert"
        );
      }
    } catch {
      toast.error("Fehler beim Status-Update");
    } finally {
      setUpdating(false);
    }
  }

  async function handlePDF() {
    if (!data || pdfLoading) return;
    setPdfLoading(true);
    try {
      const { generateRechnungPDF } = await import("@/lib/pdf");
      const blob = generateRechnungPDF({
        nummer: data.nummer,
        datum: new Date(data.datum),
        faelligAm: new Date(data.faelligAm),
        kunde: {
          name: data.kundeName,
          strasse: data.kundeStrasse || undefined,
          plz: data.kundePlz || undefined,
          ort: data.kundeOrt || undefined,
        },
        firma: data.firma,
        positionen: data.positionen,
        netto: data.netto,
        mwstSatz: data.mwstSatz,
        mwstBetrag: data.mwstBetrag,
        brutto: data.brutto,
        einleitungsText: data.einleitungsText,
        schlussText: data.schlussText,
      });

      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      toast.error("Fehler beim PDF-Erstellen");
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleSenden() {
    if (!data || sending) return;
    if (!data.kundeEmail) {
      toast.error("Keine E-Mail-Adresse beim Kunden hinterlegt");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/rechnungen/${id}/senden`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Senden fehlgeschlagen");
      }
      setData((prev) =>
        prev
          ? { ...prev, status: prev.status === "ENTWURF" ? "OFFEN" : prev.status }
          : prev
      );
      toast.success(`Rechnung wurde an ${data.kundeEmail} gesendet!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Senden");
    } finally {
      setSending(false);
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
        <p className="text-muted-foreground">Rechnung nicht gefunden</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/app/rechnungen")}
        >
          Zurück
        </Button>
      </div>
    );
  }

  const cfg = statusConfig[data.status] || statusConfig.ENTWURF;

  return (
    <div className="px-4 pt-5 pb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/app/rechnungen")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <p className="font-bold">{data.nummer}</p>
          <p className="text-xs text-muted-foreground">{data.kundeName}</p>
        </div>
        <Badge variant={cfg.variant}>{cfg.label}</Badge>
      </div>

      {/* Rechnungs-Inhalt */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Kunde */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Kunde</p>
            <p className="font-medium text-sm">{data.kundeName}</p>
            {data.kundeStrasse && (
              <p className="text-sm text-muted-foreground">{data.kundeStrasse}</p>
            )}
            {(data.kundePlz || data.kundeOrt) && (
              <p className="text-sm text-muted-foreground">
                {data.kundePlz} {data.kundeOrt}
              </p>
            )}
          </div>

          <Separator />

          {/* Positionen */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Positionen
            </p>
            <div className="space-y-1">
              {data.positionen.map((p) => (
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

          <Separator />

          {/* Summen */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <p className="text-muted-foreground">Netto</p>
              <p className="font-mono">{formatEuro(data.netto)}</p>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <p>MwSt. ({data.mwstSatz}%)</p>
              <p className="font-mono">{formatEuro(data.mwstBetrag)}</p>
            </div>
            <div className="flex justify-between text-lg font-bold pt-1">
              <p>Brutto</p>
              <p className="font-mono text-primary">{formatEuro(data.brutto)}</p>
            </div>
          </div>

          <Separator />

          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>
              Datum: {new Date(data.datum).toLocaleDateString("de-DE")} |
              Zahlbar bis: {new Date(data.faelligAm).toLocaleDateString("de-DE")}
            </p>
            {data.status === "BEZAHLT" && data.bezahltAm && (
              <p className="text-green-600 font-medium">
                Bezahlt am: {new Date(data.bezahltAm).toLocaleDateString("de-DE")}
              </p>
            )}
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
          <Button className="h-12" onClick={handleSenden} disabled={sending}>
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
              onClick={() => updateStatus("BEZAHLT")}
              disabled={updating}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Als bezahlt markieren
            </Button>
            <Button
              className="h-12"
              variant="destructive"
              onClick={() => updateStatus("STORNIERT")}
              disabled={updating}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Stornieren
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
