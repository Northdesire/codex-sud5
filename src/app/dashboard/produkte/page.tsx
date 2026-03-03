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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { AICatalogUpload } from "@/components/dashboard/ai-catalog-upload";

const EINHEITEN = ["Stk.", "kg", "Liter", "m", "m²", "Paar", "Set", "Rolle", "Karton", "pauschal"];

interface Produkt {
  id: string;
  name: string;
  kategorie: string;
  artikelNr: string | null;
  beschreibung: string | null;
  ekPreis: number;
  vkPreis: number;
  einheit: string;
  aktiv: boolean;
}

const emptyForm = {
  name: "",
  kategorie: "",
  artikelNr: "",
  beschreibung: "",
  ekPreis: "",
  vkPreis: "",
  einheit: "Stk.",
};

export default function ProduktePage() {
  const [produkte, setProdukte] = useState<Produkt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALLE");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [alleProdukte, setAlleProdukte] = useState<Produkt[]>([]);

  const loadData = useCallback(async () => {
    const res = await fetch("/api/produkte");
    const data = await res.json();
    if (Array.isArray(data)) {
      setAlleProdukte(data);
      setProdukte(filter === "ALLE" ? data : data.filter((p: Produkt) => p.kategorie === filter));
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Alle vorhandenen Kategorien ermitteln
  const kategorien = [...new Set(alleProdukte.map((p) => p.kategorie))].sort();

  function openNew() {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(p: Produkt) {
    setEditId(p.id);
    setForm({
      name: p.name,
      kategorie: p.kategorie,
      artikelNr: p.artikelNr ?? "",
      beschreibung: p.beschreibung ?? "",
      ekPreis: p.ekPreis.toString(),
      vkPreis: p.vkPreis.toString(),
      einheit: p.einheit,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.kategorie || !form.ekPreis || !form.vkPreis) {
      toast.error("Name, Kategorie, EK-Preis und VK-Preis sind Pflichtfelder");
      return;
    }
    setSaving(true);

    const url = editId ? `/api/produkte/${editId}` : "/api/produkte";
    const method = editId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      toast.success(editId ? "Produkt aktualisiert" : "Produkt erstellt");
      setDialogOpen(false);
      loadData();
    } else {
      toast.error("Fehler beim Speichern");
    }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" wirklich löschen?`)) return;

    const res = await fetch(`/api/produkte/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Produkt gelöscht");
      loadData();
    } else {
      toast.error("Fehler beim Löschen");
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === produkte.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(produkte.map((p) => p.id)));
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} Produkt${selected.size > 1 ? "e" : ""} wirklich löschen?`)) return;
    setDeleting(true);
    let deleted = 0;
    for (const id of selected) {
      const res = await fetch(`/api/produkte/${id}`, { method: "DELETE" });
      if (res.ok) deleted++;
    }
    toast.success(`${deleted} Produkt${deleted > 1 ? "e" : ""} gelöscht`);
    setSelected(new Set());
    setDeleting(false);
    loadData();
  }

  function formatEuro(n: number) {
    return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  }

  function marge(ek: number, vk: number) {
    if (ek === 0) return "-";
    return ((((vk - ek) / ek) * 100).toFixed(0)) + "%";
  }

  return (
    <>
      <Header
        title="Produkte"
        description="Produktkatalog mit Einkaufs- und Verkaufspreisen"
        actions={
          <div className="flex gap-2">
            {selected.size > 0 && (
              <Button variant="destructive" onClick={handleBulkDelete} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                {selected.size} löschen
              </Button>
            )}
            <AICatalogUpload filterTyp="produkt" onImported={loadData} />
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Neues Produkt
            </Button>
          </div>
        }
      />
      <div className="p-8 space-y-4">
        {/* Kategorie-Filter */}
        {kategorien.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filter === "ALLE" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("ALLE")}
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

        {/* Tabelle */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : produkte.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">Noch keine Produkte angelegt</p>
            <p className="text-sm mt-1">Klicke auf &ldquo;Neues Produkt&rdquo; oder nutze den &ldquo;AI-Import&rdquo; um Produkte aus Rechnungen, Katalogen oder Preislisten zu importieren</p>
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={produkte.length > 0 && selected.size === produkte.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Art.Nr.</TableHead>
                  <TableHead>Einheit</TableHead>
                  <TableHead className="text-right">EK</TableHead>
                  <TableHead className="text-right">VK</TableHead>
                  <TableHead className="text-right">Marge</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produkte.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggleSelect(p.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{p.kategorie}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.artikelNr || "-"}
                    </TableCell>
                    <TableCell className="text-sm">{p.einheit}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatEuro(p.ekPreis)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatEuro(p.vkPreis)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={
                          parseFloat(marge(p.ekPreis, p.vkPreis)) > 30
                            ? "text-emerald-600 border-emerald-200"
                            : "text-amber-600 border-amber-200"
                        }
                      >
                        {marge(p.ekPreis, p.vkPreis)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(p.id, p.name)}
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

      {/* Dialog: Neues Produkt / Bearbeiten */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Produkt bearbeiten" : "Neues Produkt"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Laptop Dell XPS 15"
                />
              </div>
              <div className="space-y-2">
                <Label>Kategorie *</Label>
                <Input
                  value={form.kategorie}
                  onChange={(e) => setForm({ ...form, kategorie: e.target.value })}
                  placeholder="Computer"
                  list="kategorie-list"
                />
                <datalist id="kategorie-list">
                  {kategorien.map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
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
                  placeholder="900.00"
                />
              </div>
              <div className="space-y-2">
                <Label>VK-Preis (EUR) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.vkPreis}
                  onChange={(e) => setForm({ ...form, vkPreis: e.target.value })}
                  placeholder="1299.00"
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
            <div className="space-y-2">
              <Label>Art.Nr.</Label>
              <Input
                value={form.artikelNr}
                onChange={(e) => setForm({ ...form, artikelNr: e.target.value })}
                placeholder="DELL-XPS-15"
              />
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Textarea
                value={form.beschreibung}
                onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
                placeholder="Optionale Beschreibung des Produkts"
                rows={2}
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
