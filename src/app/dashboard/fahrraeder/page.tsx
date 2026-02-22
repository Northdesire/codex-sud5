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

interface StaffelPreis {
  id: string;
  staffelId: string;
  preisProTag: number;
  staffel: MietdauerStaffel;
}

interface MietdauerStaffel {
  id: string;
  name: string;
  bisTag: number;
}

interface Fahrrad {
  id: string;
  name: string;
  kategorie: string;
  beschreibung: string | null;
  preisProTag: number;
  aktiv: boolean;
  staffelPreise: StaffelPreis[];
}

const emptyForm = {
  name: "",
  kategorie: "",
  beschreibung: "",
  preisProTag: "",
  aktiv: true,
  staffelPreise: {} as Record<string, string>,
};

export default function FahrraederPage() {
  const [fahrraeder, setFahrraeder] = useState<Fahrrad[]>([]);
  const [staffeln, setStaffeln] = useState<MietdauerStaffel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");

  const loadData = useCallback(async () => {
    const [fRes, sRes] = await Promise.all([
      fetch("/api/fahrraeder"),
      fetch("/api/mietdauer-staffeln"),
    ]);
    const fData = await fRes.json();
    const sData = await sRes.json();
    if (Array.isArray(fData)) setFahrraeder(fData);
    if (Array.isArray(sData)) setStaffeln(sData);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openNew() {
    setEditId(null);
    setForm({ ...emptyForm, staffelPreise: {} });
    setDialogOpen(true);
  }

  function openEdit(f: Fahrrad) {
    setEditId(f.id);
    const sp: Record<string, string> = {};
    for (const p of f.staffelPreise) {
      sp[p.staffelId] = p.preisProTag.toString();
    }
    setForm({
      name: f.name,
      kategorie: f.kategorie,
      beschreibung: f.beschreibung || "",
      preisProTag: f.preisProTag.toString(),
      aktiv: f.aktiv,
      staffelPreise: sp,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.preisProTag) {
      toast.error("Name und Basispreis sind Pflichtfelder");
      return;
    }
    setSaving(true);

    const staffelPreise = Object.entries(form.staffelPreise)
      .filter(([, v]) => v && parseFloat(v) > 0)
      .map(([staffelId, preisProTag]) => ({
        staffelId,
        preisProTag: parseFloat(preisProTag),
      }));

    const url = editId ? `/api/fahrraeder/${editId}` : "/api/fahrraeder";
    const method = editId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, staffelPreise }),
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

  const kategorien = [...new Set(fahrraeder.map((f) => f.kategorie).filter(Boolean))];
  const filtered = filter
    ? fahrraeder.filter((f) => f.kategorie === filter)
    : fahrraeder;

  return (
    <>
      <Header
        title="Fahrräder"
        description="Fahrradkatalog mit Tagespreisen und Staffelpreisen"
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
        {staffeln.length > 0 && (
          <div className="rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            Staffelpreise pro Fahrrad werden hier beim Bearbeiten gesetzt. Staffeln verwalten Sie auf der{" "}
            <a href="/dashboard/mietdauer" className="underline font-medium text-foreground hover:text-primary">
              Mietdauer-Staffeln-Seite
            </a>.
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
                  <TableHead className="text-right">Basispreis/Tag</TableHead>
                  {staffeln.map((s) => (
                    <TableHead key={s.id} className="text-right text-xs">
                      {s.name}
                    </TableHead>
                  ))}
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
                      {formatEuro(f.preisProTag)}
                    </TableCell>
                    {staffeln.map((s) => {
                      const sp = f.staffelPreise.find((p) => p.staffelId === s.id);
                      return (
                        <TableCell key={s.id} className="text-right font-mono text-sm">
                          {sp ? formatEuro(sp.preisProTag) : "—"}
                        </TableCell>
                      );
                    })}
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
        <DialogContent className="max-w-lg">
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
              <Label>Basispreis pro Tag (EUR) *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.preisProTag}
                onChange={(e) => setForm({ ...form, preisProTag: e.target.value })}
                placeholder="15.00"
              />
              <p className="text-xs text-muted-foreground">Fallback-Preis, wenn keine Staffel passt</p>
            </div>
            {staffeln.length > 0 && (
              <div className="space-y-2">
                <Label>Staffelpreise pro Tag</Label>
                <div className="space-y-2">
                  {staffeln.map((s) => (
                    <div key={s.id} className="flex items-center gap-3">
                      <span className="text-sm w-32 shrink-0">{s.name}</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.staffelPreise[s.id] || ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            staffelPreise: { ...form.staffelPreise, [s.id]: e.target.value },
                          })
                        }
                        placeholder="—"
                        className="h-9"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
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
