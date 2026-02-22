"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

interface MietdauerStaffel {
  id: string;
  name: string;
  bisTag: number;
}

const emptyForm = {
  name: "",
  bisTag: "",
};

export default function MietdauerPage() {
  const [staffeln, setStaffeln] = useState<MietdauerStaffel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const res = await fetch("/api/mietdauer-staffeln");
    const data = await res.json();
    if (Array.isArray(data)) setStaffeln(data);
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

  function openEdit(s: MietdauerStaffel) {
    setEditId(s.id);
    setForm({
      name: s.name,
      bisTag: s.bisTag.toString(),
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.bisTag) {
      toast.error("Bitte alle Felder ausfüllen");
      return;
    }
    setSaving(true);

    const url = editId ? `/api/mietdauer-staffeln/${editId}` : "/api/mietdauer-staffeln";
    const method = editId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      toast.success(editId ? "Staffel aktualisiert" : "Staffel erstellt");
      setDialogOpen(false);
      loadData();
    } else {
      toast.error("Fehler beim Speichern");
    }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" wirklich löschen?`)) return;
    const res = await fetch(`/api/mietdauer-staffeln/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Staffel gelöscht");
      loadData();
    } else {
      toast.error("Fehler beim Löschen");
    }
  }

  return (
    <>
      <Header
        title="Mietdauer-Staffeln"
        description="Tage-Bereiche für gestaffelte Tagespreise"
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Neue Staffel
          </Button>
        }
      />
      <div className="p-8 space-y-4">
        <div className="rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Preise pro Fahrrad und Staffel legen Sie auf der{" "}
          <a href="/dashboard/fahrraeder" className="underline font-medium text-foreground hover:text-primary">
            Fahrräder-Seite
          </a>{" "}
          fest. Verwenden Sie <strong>9999</strong> als bisTag für offene Staffeln (z.B. &quot;ab 8 Tage&quot;).
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : staffeln.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">Noch keine Staffeln angelegt</p>
            <p className="text-sm mt-1">
              Beispiel: &quot;1–3 Tage&quot; (bisTag: 3), &quot;4–7 Tage&quot; (bisTag: 7), &quot;ab 8 Tage&quot; (bisTag: 9999)
            </p>
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Bis Tag (inkl.)</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffeln.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {s.bisTag >= 9999 ? "∞" : s.bisTag}
                    </TableCell>
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
            <DialogTitle>{editId ? "Staffel bearbeiten" : "Neue Staffel"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="1–3 Tage"
              />
            </div>
            <div className="space-y-2">
              <Label>Bis Tag (inklusiv) *</Label>
              <Input
                type="number"
                min="1"
                value={form.bisTag}
                onChange={(e) => setForm({ ...form, bisTag: e.target.value })}
                placeholder="3"
              />
              <p className="text-xs text-muted-foreground">
                Nutze 9999 für offene Staffeln wie &quot;ab 8 Tage&quot;
              </p>
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
