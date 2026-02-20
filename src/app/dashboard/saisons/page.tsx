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

const SAISON_TYPEN = ["Hauptsaison", "Hochsaison", "Nebensaison"];

const SAISON_COLORS: Record<string, string> = {
  Hauptsaison: "bg-orange-100 text-orange-700 border-orange-200",
  Hochsaison: "bg-red-100 text-red-700 border-red-200",
  Nebensaison: "bg-blue-100 text-blue-700 border-blue-200",
};

interface Saison {
  id: string;
  name: string;
  von: string;
  bis: string;
}

const emptyForm = {
  name: "Hauptsaison",
  von: "",
  bis: "",
};

export default function SaisonsPage() {
  const [saisons, setSaisons] = useState<Saison[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const res = await fetch("/api/saisons");
    const data = await res.json();
    if (Array.isArray(data)) setSaisons(data);
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

  function openEdit(s: Saison) {
    setEditId(s.id);
    setForm({
      name: s.name,
      von: s.von.split("T")[0],
      bis: s.bis.split("T")[0],
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.von || !form.bis) {
      toast.error("Bitte alle Felder ausfüllen");
      return;
    }
    setSaving(true);

    const url = editId ? `/api/saisons/${editId}` : "/api/saisons";
    const method = editId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, faktor: "1.0" }),
    });

    if (res.ok) {
      toast.success(editId ? "Saison aktualisiert" : "Saison erstellt");
      setDialogOpen(false);
      loadData();
    } else {
      toast.error("Fehler beim Speichern");
    }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" wirklich löschen?`)) return;
    const res = await fetch(`/api/saisons/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Saison gelöscht");
      loadData();
    } else {
      toast.error("Fehler beim Löschen");
    }
  }

  return (
    <>
      <Header
        title="Saisons"
        description="Zeiträume mit Saisontyp definieren"
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Neue Saison
          </Button>
        }
      />
      <div className="p-8 space-y-4">
        <div className="rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Preise pro Unterkunft und Saison legen Sie auf der <a href="/dashboard/unterkuenfte" className="underline font-medium text-foreground hover:text-primary">Unterkünfte-Seite</a> fest.
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : saisons.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">Noch keine Saisons angelegt</p>
            <p className="text-sm mt-1">Legen Sie Zeiträume an und ordnen Sie Haupt-, Hoch- oder Nebensaison zu</p>
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>Von</TableHead>
                  <TableHead>Bis</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saisons.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Badge variant="outline" className={SAISON_COLORS[s.name] ?? ""}>
                        {s.name}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(s.von).toLocaleDateString("de-DE")}</TableCell>
                    <TableCell>{new Date(s.bis).toLocaleDateString("de-DE")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id, s.name)}>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Saison bearbeiten" : "Neue Saison"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Saisontyp *</Label>
              <select
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {SAISON_TYPEN.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Von *</Label>
                <Input
                  type="date"
                  value={form.von}
                  onChange={(e) => setForm({ ...form, von: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Bis *</Label>
                <Input
                  type="date"
                  value={form.bis}
                  onChange={(e) => setForm({ ...form, bis: e.target.value })}
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
