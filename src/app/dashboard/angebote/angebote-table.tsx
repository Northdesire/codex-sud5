"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { formatEuro } from "@/lib/kalkulation";

interface Angebot {
  id: string;
  nummer: string;
  datum: string;
  status: string;
  kundeName: string;
  kundeEmail: string | null;
  materialNetto: number;
  arbeitsNetto: number;
  anfahrt: number;
  netto: number;
  mwstBetrag: number;
  brutto: number;
  mwstSatz?: number;
  positionen: Array<{
    posNr: number;
    typ: string;
    bezeichnung: string;
    menge: number;
    einheit: string;
    einzelpreis: number;
    gesamtpreis: number;
  }>;
  firma?: {
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
  kundeStrasse: string | null;
  kundePlz: string | null;
  kundeOrt: string | null;
  gueltigBis: string;
}

const statusConfig: Record<
  string,
  { label: string; color: string }
> = {
  ENTWURF: { label: "Entwurf", color: "bg-gray-100 text-gray-700" },
  OFFEN: { label: "Offen", color: "bg-blue-100 text-blue-700" },
  ANGENOMMEN: { label: "Angenommen", color: "bg-green-100 text-green-700" },
  ABGELEHNT: { label: "Abgelehnt", color: "bg-red-100 text-red-700" },
  ABGELAUFEN: { label: "Abgelaufen", color: "bg-yellow-100 text-yellow-700" },
};

export function AngeboteTable() {
  const [angebote, setAngebote] = useState<Angebot[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/angebote")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAngebote(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/angebote/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setAngebote((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status } : a))
        );
      }
    } catch (error) {
      console.error("Status update Fehler:", error);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handlePDF(angebot: Angebot) {
    try {
      const { generateAngebotPDF } = await import("@/lib/pdf");
      const mwstSatz = angebot.mwstSatz ?? angebot.firma?.mwstSatz ?? 19;
      const blob = generateAngebotPDF({
        nummer: angebot.nummer,
        datum: new Date(angebot.datum),
        gueltigBis: new Date(angebot.gueltigBis),
        kunde: {
          name: angebot.kundeName,
          strasse: angebot.kundeStrasse || undefined,
          plz: angebot.kundePlz || undefined,
          ort: angebot.kundeOrt || undefined,
          email: angebot.kundeEmail || undefined,
        },
        firma: angebot.firma || null,
        positionen: angebot.positionen,
        materialNetto: angebot.materialNetto,
        arbeitsNetto: angebot.arbeitsNetto,
        anfahrt: angebot.anfahrt,
        netto: angebot.netto,
        mwstSatz,
        mwstBetrag: angebot.mwstBetrag,
        brutto: angebot.brutto,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${angebot.nummer}_${angebot.kundeName.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF Fehler:", error);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (angebote.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 p-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          Noch keine Angebote erstellt
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Erstelle Angebote über die Mobile-App (AI-Eingabe)
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-muted/50 text-sm">
            <th className="text-left px-4 py-3 font-medium">Nummer</th>
            <th className="text-left px-4 py-3 font-medium">Kunde</th>
            <th className="text-left px-4 py-3 font-medium">Datum</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            <th className="text-right px-4 py-3 font-medium">Brutto</th>
            <th className="text-right px-4 py-3 font-medium">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {angebote.map((a) => {
            const cfg = statusConfig[a.status] || statusConfig.ENTWURF;
            return (
              <tr key={a.id} className="border-t hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-sm">{a.nummer}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-sm">{a.kundeName}</p>
                  {a.kundeEmail && (
                    <p className="text-xs text-muted-foreground">
                      {a.kundeEmail}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(a.datum).toLocaleDateString("de-DE")}
                </td>
                <td className="px-4 py-3">
                  <Badge className={`${cfg.color} border-0 text-xs`}>
                    {cfg.label}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm font-medium">
                  {formatEuro(a.brutto)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePDF(a)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {a.status === "ENTWURF" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(a.id, "OFFEN")}
                        disabled={updatingId === a.id}
                      >
                        Freigeben
                      </Button>
                    )}
                    {a.status === "OFFEN" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(a.id, "ANGENOMMEN")}
                          disabled={updatingId === a.id}
                        >
                          Angenommen
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(a.id, "ABGELEHNT")}
                          disabled={updatingId === a.id}
                        >
                          Abgelehnt
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
