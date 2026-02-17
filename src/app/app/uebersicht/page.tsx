"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, FileText } from "lucide-react";
import { formatEuro } from "@/lib/kalkulation";

interface Angebot {
  id: string;
  nummer: string;
  datum: string;
  status: string;
  kundeName: string;
  brutto: number;
  createdAt: string;
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

export default function UebersichtPage() {
  const router = useRouter();
  const [angebote, setAngebote] = useState<Angebot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/angebote")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAngebote(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
        <h1 className="text-xl font-bold">Angebote</h1>
        <Button size="sm" onClick={() => router.push("/app/ai")}>
          <Plus className="h-4 w-4 mr-1" />
          Neu
        </Button>
      </div>

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
            const cfg = statusConfig[a.status] || statusConfig.ENTWURF;
            return (
              <Card
                key={a.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => router.push(`/app/uebersicht/${a.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
