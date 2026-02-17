"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

interface Zuschlag {
  id: string;
  name: string;
  typ: "PROZENT" | "PAUSCHAL";
  wert: number;
  proEinheit: string | null;
  automatisch: boolean;
  bedingung: string | null;
  aktiv: boolean;
}

interface Rabatt {
  id: string;
  name: string;
  typ: "PROZENT" | "PAUSCHAL";
  wert: number;
  bedingung: string | null;
  automatisch: boolean;
  aktiv: boolean;
}

type FormMode = "zuschlag" | "rabatt";

export default function ZuschlaeagePage() {
  const [zuschlaege, setZuschlaege] = useState<Zuschlag[]>([]);
  const [rabatte, setRabatte] = useState<Rabatt[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("zuschlag");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    typ: "PROZENT" as "PROZENT" | "PAUSCHAL",
    wert: 0,
    bedingung: "",
    automatisch: false,
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/zuschlaege").then((r) => r.json()),
      fetch("/api/rabatte").then((r) => r.json()),
    ])
      .then(([z, r]) => {
        if (Array.isArray(z)) setZuschlaege(z);
        if (Array.isArray(r)) setRabatte(r);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function openNew(mode: FormMode) {
    setFormMode(mode);
    setEditingId(null);
    setForm({ name: "", typ: "PROZENT", wert: 0, bedingung: "", automatisch: false });
    setDialogOpen(true);
  }

  function openEdit(item: Zuschlag | Rabatt, mode: FormMode) {
    setFormMode(mode);
    setEditingId(item.id);
    setForm({
      name: item.name,
      typ: item.typ,
      wert: item.wert,
      bedingung: item.bedingung || "",
      automatisch: item.automatisch,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Name ist erforderlich");
      return;
    }
    if (form.wert <= 0) {
      toast.error("Wert muss größer als 0 sein");
      return;
    }

    const endpoint = formMode === "zuschlag" ? "/api/zuschlaege" : "/api/rabatte";

    try {
      if (editingId) {
        const res = await fetch(`${endpoint}/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
        const updated = await res.json();

        if (formMode === "zuschlag") {
          setZuschlaege((prev) => prev.map((z) => (z.id === editingId ? updated : z)));
        } else {
          setRabatte((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
        }
        toast.success("Aktualisiert");
      } else {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
        const created = await res.json();

        if (formMode === "zuschlag") {
          setZuschlaege((prev) => [...prev, created]);
        } else {
          setRabatte((prev) => [...prev, created]);
        }
        toast.success("Erstellt");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Fehler beim Speichern");
    }
  }

  async function handleDelete(id: string, mode: FormMode) {
    if (!confirm("Wirklich löschen?")) return;
    const endpoint = mode === "zuschlag" ? "/api/zuschlaege" : "/api/rabatte";
    try {
      await fetch(`${endpoint}/${id}`, { method: "DELETE" });
      if (mode === "zuschlag") {
        setZuschlaege((prev) => prev.filter((z) => z.id !== id));
      } else {
        setRabatte((prev) => prev.filter((r) => r.id !== id));
      }
      toast.success("Gelöscht");
    } catch {
      toast.error("Fehler beim Löschen");
    }
  }

  async function toggleAktiv(item: Zuschlag | Rabatt, mode: FormMode) {
    const endpoint = mode === "zuschlag" ? "/api/zuschlaege" : "/api/rabatte";
    try {
      const res = await fetch(`${endpoint}/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktiv: !item.aktiv }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      if (mode === "zuschlag") {
        setZuschlaege((prev) => prev.map((z) => (z.id === item.id ? updated : z)));
      } else {
        setRabatte((prev) => prev.map((r) => (r.id === item.id ? updated : r)));
      }
    } catch {
      toast.error("Fehler");
    }
  }

  function renderItem(item: Zuschlag | Rabatt, mode: FormMode) {
    return (
      <div
        key={item.id}
        className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
          !item.aktiv ? "opacity-50" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          <button onClick={() => toggleAktiv(item, mode)}>
            <div className={`h-3 w-3 rounded-full ${item.aktiv ? "bg-green-500" : "bg-gray-300"}`} />
          </button>
          <div>
            <p className="font-medium text-sm">{item.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-xs">
                {item.typ === "PROZENT" ? `${item.wert}%` : `${item.wert.toFixed(2)} €`}
              </Badge>
              {item.automatisch && (
                <Badge variant="secondary" className="text-xs">Auto</Badge>
              )}
              {item.bedingung && (
                <span className="text-xs text-muted-foreground">{item.bedingung}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(item, mode)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id, mode)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header
        title="Zuschläge & Rabatte"
        description="Automatische und manuelle Aufschläge und Nachlässe"
      />
      <div className="p-8 max-w-3xl space-y-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Zuschläge */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                  <h2 className="font-semibold">Zuschläge</h2>
                  <Badge variant="secondary" className="text-xs">{zuschlaege.length}</Badge>
                </div>
                <Button size="sm" variant="outline" onClick={() => openNew("zuschlag")}>
                  <Plus className="h-4 w-4 mr-1" /> Zuschlag
                </Button>
              </div>
              {zuschlaege.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Noch keine Zuschläge — z.B. Höhenzuschlag, Kleinfläche, Wochenende
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {zuschlaege.map((z) => renderItem(z, "zuschlag"))}
                </div>
              )}
            </div>

            {/* Rabatte */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-green-500" />
                  <h2 className="font-semibold">Rabatte</h2>
                  <Badge variant="secondary" className="text-xs">{rabatte.length}</Badge>
                </div>
                <Button size="sm" variant="outline" onClick={() => openNew("rabatt")}>
                  <Plus className="h-4 w-4 mr-1" /> Rabatt
                </Button>
              </div>
              {rabatte.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Noch keine Rabatte — z.B. Stammkunden-Rabatt, Mengenrabatt
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rabatte.map((r) => renderItem(r, "rabatt"))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? `${formMode === "zuschlag" ? "Zuschlag" : "Rabatt"} bearbeiten`
                : `Neuer ${formMode === "zuschlag" ? "Zuschlag" : "Rabatt"}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={formMode === "zuschlag" ? "z.B. Höhenzuschlag" : "z.B. Stammkunden-Rabatt"}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Typ</Label>
                <select
                  className="w-full h-9 rounded-md border px-3 text-sm"
                  value={form.typ}
                  onChange={(e) => setForm({ ...form, typ: e.target.value as "PROZENT" | "PAUSCHAL" })}
                >
                  <option value="PROZENT">Prozent (%)</option>
                  <option value="PAUSCHAL">Pauschal (€)</option>
                </select>
              </div>
              <div>
                <Label>Wert</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step={form.typ === "PROZENT" ? "1" : "0.01"}
                    min="0"
                    value={form.wert}
                    onChange={(e) => setForm({ ...form, wert: parseFloat(e.target.value) || 0 })}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {form.typ === "PROZENT" ? "%" : "€"}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <Label>Bedingung (optional)</Label>
              <Input
                value={form.bedingung}
                onChange={(e) => setForm({ ...form, bedingung: e.target.value })}
                placeholder="z.B. Ab 4m Deckenhöhe, Aufträge unter 200€"
              />
              <p className="text-xs text-muted-foreground mt-1">Beschreibung wann der {formMode === "zuschlag" ? "Zuschlag" : "Rabatt"} gilt</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setForm({ ...form, automatisch: !form.automatisch })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.automatisch ? "bg-primary" : "bg-muted"
                }`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  form.automatisch ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
              <Label>Automatisch anwenden</Label>
            </div>
            <Button className="w-full" onClick={handleSave}>
              {editingId ? "Speichern" : "Erstellen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
