"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

interface Unterkunft {
  id: string;
  name: string;
  beschreibung: string | null;
  kapazitaet: number;
  preisProNacht: number;
  aktiv: boolean;
}

const emptyForm = {
  name: "",
  beschreibung: "",
  kapazitaet: "4",
  preisProNacht: "",
  aktiv: true,
};

export default function UnterkuenftePage() {
  const [unterkuenfte, setUnterkuenfte] = useState<Unterkunft[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const res = await fetch("/api/unterkuenfte");
    const data = await res.json();
    if (Array.isArray(data)) setUnterkuenfte(data);
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

  function openEdit(u: Unterkunft) {
    setEditId(u.id);
    setForm({
      name: u.name,
      beschreibung: u.beschreibung ?? "",
      kapazitaet: u.kapazitaet.toString(),
      preisProNacht: u.preisProNacht.toString(),
      aktiv: u.aktiv,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.preisProNacht) {
      toast.error("Name und Preis/Nacht sind Pflichtfelder");
      return;
    }
    setSaving(true);

    const url = editId ? `/api/unterkuenfte/${editId}` : "/api/unterkuenfte";
    const method = editId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      toast.success(editId ? "Unterkunft aktualisiert" : "Unterkunft erstellt");
      setDialogOpen(false);
      loadData();
    } else {
      toast.error("Fehler beim Speichern");
    }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" wirklich löschen?`)) return;
    const res = await fetch(`/api/unterkuenfte/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Unterkunft gelöscht");
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
        title="Unterkünfte"
        description="Ferienwohnungen, Zimmer und Apartments verwalten"
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Neue Unterkunft
          </Button>
        }
      />
      <div className="p-8 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : unterkuenfte.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">Noch keine Unterkünfte angelegt</p>
            <p className="text-sm mt-1">Klicke auf &ldquo;Neue Unterkunft&rdquo; um loszulegen</p>
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kapazität</TableHead>
                  <TableHead className="text-right">Preis/Nacht</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unterkuenfte.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{u.name}</p>
                        {u.beschreibung && (
                          <p className="text-xs text-muted-foreground">{u.beschreibung}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{u.kapazitaet} Pers.</TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatEuro(u.preisProNacht)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.aktiv ? "default" : "secondary"}>
                        {u.aktiv ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id, u.name)}>
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
            <DialogTitle>{editId ? "Unterkunft bearbeiten" : "Neue Unterkunft"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ferienwohnung Seeblick"
              />
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Textarea
                value={form.beschreibung}
                onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
                placeholder="65m², Balkon, Meerblick, 2 Schlafzimmer"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max. Personen *</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.kapazitaet}
                  onChange={(e) => setForm({ ...form, kapazitaet: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Preis/Nacht (EUR) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.preisProNacht}
                  onChange={(e) => setForm({ ...form, preisProNacht: e.target.value })}
                  placeholder="85.00"
                />
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
