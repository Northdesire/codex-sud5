"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/dashboard/header";
import { Loader2, Sun, Umbrella, CloudSun } from "lucide-react";
import { toast } from "sonner";

const SAISON_TYPEN = [
  { name: "Hauptsaison", icon: Sun, color: "border-orange-300 bg-orange-50 text-orange-700", activeColor: "border-orange-400 bg-orange-100 ring-2 ring-orange-400" },
  { name: "Hochsaison", icon: Umbrella, color: "border-red-300 bg-red-50 text-red-700", activeColor: "border-red-400 bg-red-100 ring-2 ring-red-400" },
  { name: "Nebensaison", icon: CloudSun, color: "border-blue-300 bg-blue-50 text-blue-700", activeColor: "border-blue-400 bg-blue-100 ring-2 ring-blue-400" },
];

interface Saison {
  id: string;
  name: string;
}

export default function SaisonsPage() {
  const [saisons, setSaisons] = useState<Saison[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const res = await fetch("/api/saisons");
    const data = await res.json();
    if (Array.isArray(data)) setSaisons(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function isActive(name: string) {
    return saisons.some((s) => s.name === name);
  }

  function getSaisonId(name: string) {
    return saisons.find((s) => s.name === name)?.id;
  }

  async function toggle(name: string) {
    setToggling(name);
    if (isActive(name)) {
      // Deactivate → delete
      const id = getSaisonId(name);
      if (!id) return;
      const res = await fetch(`/api/saisons/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`${name} entfernt`);
        loadData();
      } else {
        toast.error("Fehler");
      }
    } else {
      // Activate → create
      const res = await fetch("/api/saisons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, von: "2000-01-01", bis: "2099-12-31", faktor: "1.0" }),
      });
      if (res.ok) {
        toast.success(`${name} aktiviert`);
        loadData();
      } else {
        toast.error("Fehler");
      }
    }
    setToggling(null);
  }

  return (
    <>
      <Header
        title="Saisons"
        description="Welche Saisontypen nutzen Sie?"
      />
      <div className="p-8 space-y-6">
        <div className="rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Wählen Sie die Saisons, die Sie verwenden. Preise pro Zimmer und Saison legen Sie auf der <a href="/dashboard/unterkuenfte" className="underline font-medium text-foreground hover:text-primary">Unterkünfte-Seite</a> fest.
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SAISON_TYPEN.map((typ) => {
              const active = isActive(typ.name);
              const Icon = typ.icon;
              const isLoading = toggling === typ.name;
              return (
                <button
                  key={typ.name}
                  onClick={() => toggle(typ.name)}
                  disabled={isLoading}
                  className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all cursor-pointer ${
                    active ? typ.activeColor : "border-muted bg-card text-muted-foreground hover:border-muted-foreground/30"
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    <Icon className="h-8 w-8" />
                  )}
                  <span className="text-base font-semibold">{typ.name}</span>
                  <span className="text-xs">
                    {active ? "Aktiv — klicken zum Entfernen" : "Klicken zum Aktivieren"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
