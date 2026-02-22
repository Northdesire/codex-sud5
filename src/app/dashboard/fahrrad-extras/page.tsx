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

const EINHEITEN = ["pauschal", "pro Tag", "pro Person", "pro Tag/Person"];

interface FahrradExtra {
  id: string;
  name: string;
  preis: number;
  einheit: string;
  aktiv: boolean;
}

const emptyForm = {
  name: "",
  preis: "",
  einheit: "pauschal",
  aktiv: true,
};

export default function FahrradExtrasPage() {
  const [extras, setExtras] = useState<FahrradExtra[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const res = await fetch("/api/fahrrad-extras");
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

  function openEdit(e: FahrradExtra) {
    setEditId(e.id);
    setForm({
      name: e.name,
      preis: e.preis.toString(),
      einheit: e.einheit,
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

    const url = editId ? `/api/fahrrad-extras/${editId}` : "/api/fahrrad-extras";
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
    const res = await fetch(`/api/fahrrad-extras/${id}`, { method: "DELETE" });
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
        description="Zusatzleistungen wie Helm, Kindersitz, Koffertransport"
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
            <p className="text-sm mt-1">Typische Extras: Helm, Kindersitz, Schloss, Koffertransport, Versicherung</p>
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Preis</TableHead>
                  <TableHead>Einheit</TableHead>
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
                placeholder="Helm"
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
                  placeholder="5.00"
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
