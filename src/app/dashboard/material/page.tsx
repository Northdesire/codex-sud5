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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Info } from "lucide-react";

const KATEGORIEN = [
  { value: "WANDFARBE", label: "Wandfarbe" },
  { value: "GRUNDIERUNG", label: "Grundierung" },
  { value: "SPACHTEL", label: "Spachtel" },
  { value: "LACK", label: "Lack" },
  { value: "VERBRAUCH", label: "Verbrauch" },
  { value: "TAPETE", label: "Tapete" },
  { value: "SONSTIGES", label: "Sonstiges" },
];

const EINHEITEN = ["Liter", "kg", "Rolle", "Kartusche", "Stück", "m²", "lfm"];

interface Material {
  id: string;
  name: string;
  kategorie: string;
  artikelNr: string | null;
  ekPreis: number;
  vkPreis: number;
  einheit: string;
  ergiebigkeit: number | null;
  anstriche: number | null;
  lieferant: string | null;
  lieferantNr: string | null;
  aktiv: boolean;
  notizen: string | null;
}

const emptyMaterial = {
  name: "",
  kategorie: "WANDFARBE",
  artikelNr: "",
  ekPreis: "",
  vkPreis: "",
  einheit: "Liter",
  ergiebigkeit: "",
  anstriche: "",
  lieferant: "",
  lieferantNr: "",
  notizen: "",
};

export default function MaterialPage() {
  const [materialien, setMaterialien] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALLE");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyMaterial);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const url = filter === "ALLE" ? "/api/material" : `/api/material?kategorie=${filter}`;
    const res = await fetch(url);
    const data = await res.json();
    setMaterialien(data);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openNew() {
    setEditId(null);
    setForm(emptyMaterial);
    setDialogOpen(true);
  }

  function openEdit(m: Material) {
    setEditId(m.id);
    setForm({
      name: m.name,
      kategorie: m.kategorie,
      artikelNr: m.artikelNr ?? "",
      ekPreis: m.ekPreis.toString(),
      vkPreis: m.vkPreis.toString(),
      einheit: m.einheit,
      ergiebigkeit: m.ergiebigkeit?.toString() ?? "",
      anstriche: m.anstriche?.toString() ?? "",
      lieferant: m.lieferant ?? "",
      lieferantNr: m.lieferantNr ?? "",
      notizen: m.notizen ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.ekPreis || !form.vkPreis) {
      toast.error("Name, EK-Preis und VK-Preis sind Pflichtfelder");
      return;
    }
    setSaving(true);

    const url = editId ? `/api/material/${editId}` : "/api/material";
    const method = editId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      toast.success(editId ? "Material aktualisiert" : "Material erstellt");
      setDialogOpen(false);
      loadData();
    } else {
      toast.error("Fehler beim Speichern");
    }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" wirklich löschen?`)) return;

    const res = await fetch(`/api/material/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Material gelöscht");
      loadData();
    } else {
      toast.error("Fehler beim Löschen");
    }
  }

  function formatEuro(n: number) {
    return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  }

  function marge(ek: number, vk: number) {
    if (ek === 0) return "–";
    return ((((vk - ek) / ek) * 100).toFixed(0)) + "%";
  }

  const katLabel = (k: string) =>
    KATEGORIEN.find((x) => x.value === k)?.label ?? k;

  return (
    <>
      <Header
        title="Material & Preise"
        description="Einkaufs- und Verkaufspreise, Ergiebigkeit, Lieferanten"
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Neues Material
          </Button>
        }
      />
      <div className="p-8 space-y-4">
        <Alert className="border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription>
            Wenn du den EK bei deinem Grosshändler änderst, rechnen alle
            zukünftigen Angebote automatisch korrekt.
          </AlertDescription>
        </Alert>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filter === "ALLE" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("ALLE")}
          >
            Alle
          </Button>
          {KATEGORIEN.map((k) => (
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
        ) : materialien.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">Noch keine Materialien angelegt</p>
            <p className="text-sm mt-1">Klicke auf &ldquo;Neues Material&rdquo; um zu starten</p>
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Art.Nr.</TableHead>
                  <TableHead>Lieferant</TableHead>
                  <TableHead className="text-right">EK</TableHead>
                  <TableHead className="text-right">VK</TableHead>
                  <TableHead className="text-right">Marge</TableHead>
                  <TableHead>Ergiebigkeit</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialien.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{katLabel(m.kategorie)}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {m.artikelNr || "–"}
                    </TableCell>
                    <TableCell className="text-sm">{m.lieferant || "–"}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatEuro(m.ekPreis)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatEuro(m.vkPreis)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={
                          parseFloat(marge(m.ekPreis, m.vkPreis)) > 30
                            ? "text-emerald-600 border-emerald-200"
                            : "text-amber-600 border-amber-200"
                        }
                      >
                        {marge(m.ekPreis, m.vkPreis)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.ergiebigkeit
                        ? `${m.ergiebigkeit} m²/${m.einheit}`
                        : "–"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(m)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(m.id, m.name)}
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

      {/* Dialog: Neues Material / Bearbeiten */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Material bearbeiten" : "Neues Material"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Caparol CapaMaxx"
                />
              </div>
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
                    {KATEGORIEN.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>EK-Preis (EUR) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.ekPreis}
                  onChange={(e) => setForm({ ...form, ekPreis: e.target.value })}
                  placeholder="12.50"
                />
              </div>
              <div className="space-y-2">
                <Label>VK-Preis (EUR) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.vkPreis}
                  onChange={(e) => setForm({ ...form, vkPreis: e.target.value })}
                  placeholder="18.90"
                />
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
                <Label>Ergiebigkeit (m² pro Einheit)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.ergiebigkeit}
                  onChange={(e) =>
                    setForm({ ...form, ergiebigkeit: e.target.value })
                  }
                  placeholder="7.0"
                />
              </div>
              <div className="space-y-2">
                <Label>Anstriche</Label>
                <Input
                  type="number"
                  value={form.anstriche}
                  onChange={(e) =>
                    setForm({ ...form, anstriche: e.target.value })
                  }
                  placeholder="2"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Art.Nr.</Label>
                <Input
                  value={form.artikelNr}
                  onChange={(e) =>
                    setForm({ ...form, artikelNr: e.target.value })
                  }
                  placeholder="CAP-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Lieferant</Label>
                <Input
                  value={form.lieferant}
                  onChange={(e) =>
                    setForm({ ...form, lieferant: e.target.value })
                  }
                  placeholder="Brillux Emden"
                />
              </div>
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
