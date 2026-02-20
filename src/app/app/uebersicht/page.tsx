"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, FileText, CheckCircle, XCircle, ArrowRight, Receipt } from "lucide-react";
import { formatEuro } from "@/lib/kalkulation";
import { toast } from "sonner";

interface Angebot {
  id: string;
  nummer: string;
  datum: string;
  status: string;
  kundeName: string;
  brutto: number;
  createdAt: string;
  rechnung?: { id: string; nummer: string } | null;
}

interface Rechnung {
  id: string;
  nummer: string;
  datum: string;
  faelligAm: string;
  status: string;
  kundeName: string;
  brutto: number;
}

const angebotStatusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  ENTWURF: { label: "Entwurf", variant: "secondary" },
  OFFEN: { label: "Offen", variant: "default" },
  ANGENOMMEN: { label: "Angenommen", variant: "outline" },
  ABGELEHNT: { label: "Abgelehnt", variant: "destructive" },
  ABGELAUFEN: { label: "Abgelaufen", variant: "secondary" },
};

const rechnungStatusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  ENTWURF: { label: "Entwurf", variant: "secondary" },
  OFFEN: { label: "Offen", variant: "default" },
  BEZAHLT: { label: "Bezahlt", variant: "outline" },
  STORNIERT: { label: "Storniert", variant: "destructive" },
};

type Tab = "angebote" | "rechnungen";

export default function UebersichtPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("angebote");
  const [angebote, setAngebote] = useState<Angebot[]>([]);
  const [rechnungen, setRechnungen] = useState<Rechnung[]>([]);
  const [branche, setBranche] = useState<string>("MALER");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isShop = branche === "SHOP";

  useEffect(() => {
    Promise.all([
      fetch("/api/angebote").then((r) => r.json()),
      fetch("/api/firma/branche").then((r) => r.json()),
    ])
      .then(([angeboteData, brancheData]) => {
        if (Array.isArray(angeboteData)) setAngebote(angeboteData);
        setBranche(brancheData.branche || "MALER");

        // Load rechnungen if SHOP
        if (brancheData.branche === "SHOP") {
          fetch("/api/rechnungen")
            .then((r) => r.json())
            .then((data) => {
              if (Array.isArray(data)) setRechnungen(data);
            })
            .catch(console.error);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleStatus(angebotId: string, status: "ANGENOMMEN" | "ABGELEHNT") {
    if (updatingId) return;
    setUpdatingId(angebotId);
    try {
      const res = await fetch(`/api/angebote/${angebotId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();

      // Update local state
      setAngebote((prev) =>
        prev.map((a) => (a.id === angebotId ? { ...a, status } : a))
      );
      toast.success(status === "ANGENOMMEN" ? "Angenommen" : "Abgelehnt");

      // SHOP + ANGENOMMEN: Auto-Rechnung erstellen
      if (status === "ANGENOMMEN" && isShop) {
        try {
          const rRes = await fetch("/api/rechnungen/aus-angebot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ angebotId }),
          });
          if (rRes.ok) {
            const rData = await rRes.json();
            toast.success(`Rechnung ${rData.nummer} erstellt`);
            // Update angebot with rechnung reference
            setAngebote((prev) =>
              prev.map((a) =>
                a.id === angebotId
                  ? { ...a, rechnung: { id: rData.id, nummer: rData.nummer } }
                  : a
              )
            );
            // Add to rechnungen list
            setRechnungen((prev) => [rData, ...prev]);
          }
        } catch {
          // Auto-Rechnung optional
        }
      }
    } catch {
      toast.error("Fehler beim Status-Update");
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="px-5 pt-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-5 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {tab === "angebote" ? "Angebote" : "Rechnungen"}
        </h1>
        {tab === "angebote" && (
          <Button size="sm" onClick={() => router.push("/app/ai")}>
            <Plus className="h-4 w-4 mr-1" />
            Neu
          </Button>
        )}
      </div>

      {/* Tab-Filter (nur SHOP bekommt beides) */}
      {isShop && (
        <div className="flex rounded-lg border bg-muted p-1 gap-1">
          <button
            className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
              tab === "angebote"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("angebote")}
          >
            Angebote
          </button>
          <button
            className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
              tab === "rechnungen"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("rechnungen")}
          >
            Rechnungen
          </button>
        </div>
      )}

      {/* Angebote Tab */}
      {tab === "angebote" && (
        <>
          {angebote.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Noch keine Angebote</p>
              <p className="text-sm text-muted-foreground mt-1">
                Erstelle dein erstes Angebot über die AI-Eingabe
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push("/app/ai")}
              >
                Jetzt starten
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {angebote.map((a) => {
                const cfg = angebotStatusConfig[a.status] || angebotStatusConfig.ENTWURF;
                const showActions = a.status === "ENTWURF" || a.status === "OFFEN";
                const showRechnungLink = a.status === "ANGENOMMEN" && isShop && a.rechnung;

                return (
                  <Card key={a.id} className="transition-colors">
                    <CardContent className="p-4">
                      <div
                        className="flex justify-between items-start cursor-pointer"
                        onClick={() => router.push(`/app/uebersicht/${a.id}`)}
                      >
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{a.kundeName}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.nummer} &middot;{" "}
                            {new Date(a.datum).toLocaleDateString("de-DE")}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <Badge variant={cfg.variant} className="text-xs">
                            {cfg.label}
                          </Badge>
                          <p className="font-mono text-sm font-medium">
                            {formatEuro(a.brutto)}
                          </p>
                        </div>
                      </div>

                      {/* Inline-Buttons: Angenommen / Abgelehnt */}
                      {showActions && (
                        <div className="flex gap-2 mt-3 pt-3 border-t">
                          <Button
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700 h-8"
                            disabled={updatingId === a.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatus(a.id, "ANGENOMMEN");
                            }}
                          >
                            {updatingId === a.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                Angenommen
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1 h-8"
                            disabled={updatingId === a.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatus(a.id, "ABGELEHNT");
                            }}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Abgelehnt
                          </Button>
                        </div>
                      )}

                      {/* Rechnung-Link für ANGENOMMEN + SHOP */}
                      {showRechnungLink && a.rechnung && (
                        <div className="mt-3 pt-3 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/app/rechnungen/${a.rechnung!.id}`);
                            }}
                          >
                            <ArrowRight className="h-3.5 w-3.5 mr-1" />
                            {a.rechnung.nummer}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Rechnungen Tab */}
      {tab === "rechnungen" && (
        <>
          {rechnungen.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Noch keine Rechnungen</p>
              <p className="text-sm text-muted-foreground mt-1">
                Erstelle Rechnungen aus angenommenen Angeboten
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {rechnungen.map((r) => {
                const cfg = rechnungStatusConfig[r.status] || rechnungStatusConfig.ENTWURF;
                return (
                  <Card
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/app/rechnungen/${r.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{r.kundeName}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.nummer} &middot;{" "}
                            {new Date(r.datum).toLocaleDateString("de-DE")}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <Badge variant={cfg.variant} className="text-xs">
                            {cfg.label}
                          </Badge>
                          <p className="font-mono text-sm font-medium">
                            {formatEuro(r.brutto)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
