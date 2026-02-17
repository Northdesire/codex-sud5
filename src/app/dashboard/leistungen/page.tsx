"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

const LEISTUNGS_KATEGORIEN = [
  { value: "STREICHEN", label: "Streichen" },
  { value: "VORBEREITUNG", label: "Vorbereitung" },
  { value: "LACKIEREN", label: "Lackieren" },
  { value: "FASSADE", label: "Fassade" },
  { value: "BODEN", label: "Boden" },
  { value: "TAPEZIEREN", label: "Tapezieren" },
  { value: "TROCKENBAU", label: "Trockenbau" },
  { value: "SONSTIGES", label: "Sonstiges" },
];

const MATERIAL_KATEGORIEN = [
  { value: "", label: "Keine Verknüpfung" },
  { value: "WANDFARBE", label: "Wandfarbe" },
  { value: "GRUNDIERUNG", label: "Grundierung" },
  { value: "SPACHTEL", label: "Spachtel" },
  { value: "LACK", label: "Lack" },
  { value: "TAPETE", label: "Tapete" },
];

const EINHEITEN = ["m²", "lfm", "Stück", "pauschal"];

interface Leistung {
  id: string;
  name: string;
  kategorie: string;
  einheit: string;
  preisProEinheit: number;
  sqmProStunde: number | null;
  materialKat: string | null;
  beschreibung: string | null;
  aktiv: boolean;
}

const emptyForm = {
  name: "",
  kategorie: "STREICHEN",
  einheit: "m²",
  preisProEinheit: "",
  sqmProStunde: "",
  materialKat: "",
  beschreibung: "",
};

export default function LeistungenPage() {
  const [leistungen, setLeistungen] = useState<Leistung[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALLE");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const url =
      filter === "ALLE"
        ? "/api/leistungen"
        : `/api/leistungen?kategorie=${filter}`;
    const res = await fetch(url);
    const data = await res.json();
    setLeistungen(data);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openNew() {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(l: Leistung) {
    setEditId(l.id);
    setForm({
      name: l.name,
      kategorie: l.kategorie,
      einheit: l.einheit,
      preisProEinheit: l.preisProEinheit.toString(),
      sqmProStunde: l.sqmProStunde?.toString() ?? "",
      materialKat: l.materialKat ?? "",
      beschreibung: l.beschreibung ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.preisProEinheit) {
      toast.error("Name und Preis sind Pflichtfelder");
      return;
    }
    setSaving(true);

    const url = editId ? `/api/leistungen/${editId}` : "/api/leistungen";
    const method = editId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      toast.success(editId ? "Leistung aktualisiert" : "Leistung erstellt");
      setDialogOpen(false);
      loadData();
    } else {
      toast.error("Fehler beim Speichern");
    }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" wirklich löschen?`)) return;
    const res = await fetch(`/api/leistungen/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Leistung gelöscht");
      loadData();
    } else {
      toast.error("Fehler beim Löschen");
    }
  }

  const katLabel = (k: string) =>
    LEISTUNGS_KATEGORIEN.find((x) => x.value === k)?.label ?? k;

  const matKatLabel = (k: string | null) =>
    MATERIAL_KATEGORIEN.find((x) => x.value === k)?.label ?? "–";

  return (
    <>
      <Header
        title="Leistungskatalog"
        description="Preise pro Einheit, Material-Verknüpfungen und Zeitkalkulation"
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Neue Leistung
          </Button>
        }
      />
      <div className="p-8 space-y-4">
        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filter === "ALLE" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("ALLE")}
          >
            Alle
          </Button>
          {LEISTUNGS_KATEGORIEN.map((k) => (
            <Button
              key={k.value}
              variant={filter === k.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(k.value)}
            >
              {k.label}
            </Button>
          ))}
        </div>

        {/* Tabelle */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : leistungen.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">Noch keine Leistungen angelegt</p>
            <p className="text-sm mt-1">
              Klicke auf &ldquo;Neue Leistung&rdquo; um zu starten
            </p>
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Einheit</TableHead>
                  <TableHead className="text-right">Preis/Einheit</TableHead>
                  <TableHead className="text-right">m²/Stunde</TableHead>
                  <TableHead>Material-Verknüpfung</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leistungen.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{katLabel(l.kategorie)}</Badge>
                    </TableCell>
                    <TableCell>{l.einheit}</TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {l.preisProEinheit.toLocaleString("de-DE", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.sqmProStunde ? `${l.sqmProStunde} m²/h` : "–"}
                    </TableCell>
                    <TableCell>
                      {l.materialKat ? (
                        <Badge variant="outline" className="text-primary border-primary/30">
                          {matKatLabel(l.materialKat)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(l)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(l.id, l.name)}
                        >
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Leistung bearbeiten" : "Neue Leistung"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Wände streichen (2 Anstriche)"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kategorie</Label>
                <Select
                  value={form.kategorie}
                  onValueChange={(v) => setForm({ ...form, kategorie: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEISTUNGS_KATEGORIEN.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Einheit</Label>
                <Select
                  value={form.einheit}
                  onValueChange={(v) => setForm({ ...form, einheit: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EINHEITEN.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preis pro Einheit (EUR) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.preisProEinheit}
                  onChange={(e) =>
                    setForm({ ...form, preisProEinheit: e.target.value })
                  }
                  placeholder="8.50"
                />
              </div>
              <div className="space-y-2">
                <Label>m² pro Stunde</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.sqmProStunde}
                  onChange={(e) =>
                    setForm({ ...form, sqmProStunde: e.target.value })
                  }
                  placeholder="12.0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Material-Verknüpfung</Label>
              <Select
                value={form.materialKat}
                onValueChange={(v) => setForm({ ...form, materialKat: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Keine Verknüpfung" />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_KATEGORIEN.map((k) => (
                    <SelectItem key={k.value || "none"} value={k.value || "none"}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Verknüpft diese Leistung automatisch mit der entsprechenden
                Material-Kategorie bei der Kalkulation
              </p>
            </div>
            <div className="space-y-2">
              <Label>Beschreibung (für Angebot)</Label>
              <Textarea
                value={form.beschreibung}
                onChange={(e) =>
                  setForm({ ...form, beschreibung: e.target.value })
                }
                placeholder="Beschreibungstext der im Angebot erscheint..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {editId ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
