"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Receipt } from "lucide-react";
import { formatEuro } from "@/lib/kalkulation";

interface Rechnung {
  id: string;
  nummer: string;
  datum: string;
  faelligAm: string;
  status: string;
  kundeName: string;
  brutto: number;
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

export default function RechnungenPage() {
  const router = useRouter();
  const [rechnungen, setRechnungen] = useState<Rechnung[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/rechnungen")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setRechnungen(data);
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
      <h1 className="text-xl font-bold">Rechnungen</h1>

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
            const cfg = statusConfig[r.status] || statusConfig.ENTWURF;
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
    </div>
  );
}
