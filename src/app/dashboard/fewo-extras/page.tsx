"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

const EINHEITEN = ["pauschal", "pro Nacht", "pro Person", "pro Nacht/Person"];

const TYP_OPTIONS = [
  { value: "EINZELZIMMER", label: "Einzelzimmer" },
  { value: "DOPPELZIMMER", label: "Doppelzimmer" },
  { value: "SUITE", label: "Suite" },
  { value: "FERIENWOHNUNG", label: "Ferienwohnung" },
  { value: "BENUTZERDEFINIERT", label: "Sonstige" },
];

interface FewoExtra {
  id: string;
  name: string;
  preis: number;
  einheit: string;
  unterkunftTypen: string[];
  aktiv: boolean;
}

const emptyForm = {
  name: "",
  preis: "",
  einheit: "pauschal",
  unterkunftTypen: [] as string[],
  aktiv: true,
};

export default function FewoExtrasPage() {
  const [extras, setExtras] = useState<FewoExtra[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const res = await fetch("/api/fewo-extras");
    const data = await res.json();
    if (Array.isArray(data)) setExtras(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openNew() {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(e: FewoExtra) {
    setEditId(e.id);
    setForm({
      name: e.name,
      preis: e.preis.toString(),
      einheit: e.einheit,
      unterkunftTypen: e.unterkunftTypen ?? [],
      aktiv: e.aktiv,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.preis) {
      toast.error("Name und Preis sind Pflichtfelder");
      return;
    }
    setSaving(true);

    const url = editId ? `/api/fewo-extras/${editId}` : "/api/fewo-extras";
    const method = editId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      toast.success(editId ? "Extra aktualisiert" : "Extra erstellt");
      setDialogOpen(false);
      loadData();
    } else {
      toast.error("Fehler beim Speichern");
    }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" wirklich löschen?`)) return;
    const res = await fetch(`/api/fewo-extras/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Extra gelöscht");
      loadData();
    } else {
      toast.error("Fehler beim Löschen");
    }
  }

  function formatEuro(n: number) {
    return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  }

  return (
    <>
      <Header
        title="Extras"
        description="Zusatzleistungen wie Hund, Endreinigung, Frühstück"
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Neues Extra
          </Button>
        }
      />
      <div className="p-8 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : extras.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">Noch keine Extras angelegt</p>
            <p className="text-sm mt-1">Typische Extras: Hund, Endreinigung, Frühstück, Parkplatz, Bettwäsche</p>
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Preis</TableHead>
                  <TableHead>Einheit</TableHead>
                  <TableHead>Gilt für</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extras.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatEuro(e.preis)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{e.einheit}</Badge>
                    </TableCell>
                    <TableCell>
                      {e.unterkunftTypen.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Alle</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {e.unterkunftTypen.map((t) => (
                            <Badge key={t} variant="outline" className="text-xs">
                              {TYP_OPTIONS.find((o) => o.value === t)?.label ?? t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.aktiv ? "default" : "secondary"}>
                        {e.aktiv ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id, e.name)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Extra bearbeiten" : "Neues Extra"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Endreinigung"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preis (EUR) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.preis}
                  onChange={(e) => setForm({ ...form, preis: e.target.value })}
                  placeholder="45.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Einheit</Label>
                <select
                  value={form.einheit}
                  onChange={(e) => setForm({ ...form, einheit: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {EINHEITEN.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Unterkunft-Typen */}
            <div className="space-y-2">
              <Label>Gilt für welche Unterkünfte?</Label>
              <p className="text-xs text-muted-foreground">Nichts auswählen = gilt für alle Typen</p>
              <div className="grid grid-cols-2 gap-2">
                {TYP_OPTIONS.map((t) => {
                  const checked = form.unterkunftTypen.includes(t.value);
                  return (
                    <label
                      key={t.value}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                        checked ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => {
                          const updated = checked
                            ? form.unterkunftTypen.filter((v) => v !== t.value)
                            : [...form.unterkunftTypen, t.value];
                          setForm({ ...form, unterkunftTypen: updated });
                        }}
                      />
                      <span className="text-sm">{t.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editId ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
