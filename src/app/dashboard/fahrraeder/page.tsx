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
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

interface FahrradPreis {
  id: string;
  tag: number;
  gesamtpreis: number;
}

interface Fahrrad {
  id: string;
  name: string;
  kategorie: string;
  beschreibung: string | null;
  aktiv: boolean;
  preise: FahrradPreis[];
}

const TAGE = Array.from({ length: 14 }, (_, i) => i + 1);

const emptyForm = {
  name: "",
  kategorie: "",
  beschreibung: "",
  aktiv: true,
  preise: {} as Record<number, string>,
};

export default function FahrraederPage() {
  const [fahrraeder, setFahrraeder] = useState<Fahrrad[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");

  const loadData = useCallback(async () => {
    const res = await fetch("/api/fahrraeder");
    const data = await res.json();
    if (Array.isArray(data)) setFahrraeder(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openNew() {
    setEditId(null);
    setForm({ ...emptyForm, preise: {} });
    setDialogOpen(true);
  }

  function openEdit(f: Fahrrad) {
    setEditId(f.id);
    const preise: Record<number, string> = {};
    for (const p of f.preise) {
      preise[p.tag] = p.gesamtpreis.toString();
    }
    setForm({
      name: f.name,
      kategorie: f.kategorie,
      beschreibung: f.beschreibung || "",
      aktiv: f.aktiv,
      preise,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name) {
      toast.error("Name ist ein Pflichtfeld");
      return;
    }
    setSaving(true);

    const preise = TAGE
      .filter((tag) => form.preise[tag] && parseFloat(form.preise[tag]) > 0)
      .map((tag) => ({
        tag,
        gesamtpreis: parseFloat(form.preise[tag]),
      }));

    const url = editId ? `/api/fahrraeder/${editId}` : "/api/fahrraeder";
    const method = editId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, preise }),
    });

    if (res.ok) {
      toast.success(editId ? "Fahrrad aktualisiert" : "Fahrrad erstellt");
      setDialogOpen(false);
      loadData();
    } else {
      toast.error("Fehler beim Speichern");
    }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" wirklich löschen?`)) return;
    const res = await fetch(`/api/fahrraeder/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Fahrrad gelöscht");
      loadData();
    } else {
      toast.error("Fehler beim Löschen");
    }
  }

  function formatEuro(n: number) {
    return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  }

  function getPreis(f: Fahrrad, tag: number): number | null {
    const p = f.preise.find((p) => p.tag === tag);
    return p ? p.gesamtpreis : null;
  }

  const kategorien = [...new Set(fahrraeder.map((f) => f.kategorie).filter(Boolean))];
  const filtered = filter
    ? fahrraeder.filter((f) => f.kategorie === filter)
    : fahrraeder;

  return (
    <>
      <Header
        title="Fahrräder"
        description="Fahrradkatalog mit Mietpreisen (1–14 Tage)"
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Neues Fahrrad
          </Button>
        }
      />
      <div className="p-8 space-y-4">
        {kategorien.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filter === "" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("")}
            >
              Alle
            </Button>
            {kategorien.map((k) => (
              <Button
                key={k}
                variant={filter === k ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(k)}
              >
                {k}
              </Button>
            ))}
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : fahrraeder.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">Noch keine Fahrräder angelegt</p>
            <p className="text-sm mt-1">Legen Sie Ihren Fahrradkatalog an: E-Bikes, Citybikes, Kinderräder, ...</p>
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead className="text-right">1 Tag</TableHead>
                  <TableHead className="text-right">7 Tage</TableHead>
                  <TableHead className="text-right">14 Tage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{f.kategorie}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {getPreis(f, 1) != null ? formatEuro(getPreis(f, 1)!) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {getPreis(f, 7) != null ? formatEuro(getPreis(f, 7)!) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {getPreis(f, 14) != null ? formatEuro(getPreis(f, 14)!) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={f.aktiv ? "default" : "secondary"}>
                        {f.aktiv ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(f)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id, f.name)}>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Fahrrad bearbeiten" : "Neues Fahrrad"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="E-Bike Standard"
                />
              </div>
              <div className="space-y-2">
                <Label>Kategorie *</Label>
                <Input
                  value={form.kategorie}
                  onChange={(e) => setForm({ ...form, kategorie: e.target.value })}
                  placeholder="E-Bike"
                  list="kategorie-suggestions"
                />
                {kategorien.length > 0 && (
                  <datalist id="kategorie-suggestions">
                    {kategorien.map((k) => (
                      <option key={k} value={k} />
                    ))}
                  </datalist>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Input
                value={form.beschreibung}
                onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
                placeholder="Optional: kurze Beschreibung"
              />
            </div>
            <div className="space-y-2">
              <Label>Mietpreise (Gesamtpreis in EUR)</Label>
              <p className="text-xs text-muted-foreground">
                Gesamtpreis pro Mietdauer — nicht pro Tag. Leere Felder werden ignoriert.
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {TAGE.map((tag) => (
                  <div key={tag} className="flex items-center gap-2">
                    <span className="text-sm w-14 shrink-0 text-right tabular-nums">
                      {tag} {tag === 1 ? "Tag" : "Tage"}
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.preise[tag] || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          preise: { ...form.preise, [tag]: e.target.value },
                        })
                      }
                      placeholder="—"
                      className="h-9"
                    />
                  </div>
                ))}
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
