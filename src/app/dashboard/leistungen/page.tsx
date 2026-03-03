"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
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
import { Plus, Pencil, Trash2, Loader2, CheckSquare, X } from "lucide-react";
import { AICatalogUpload } from "@/components/dashboard/ai-catalog-upload";
import { HelpTour } from "@/components/dashboard/help-tour";

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
  return <Suspense><LeistungenContent /></Suspense>;
}

function LeistungenContent() {
  const searchParams = useSearchParams();
  const guideMode = searchParams.get("guide") === "1";
  const guideTriggered = useRef(false);

  const [leistungen, setLeistungen] = useState<Leistung[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALLE");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkKatDialogOpen, setBulkKatDialogOpen] = useState(false);
  const [bulkKategorie, setBulkKategorie] = useState("STREICHEN");

  const loadData = useCallback(async () => {
    const url =
      filter === "ALLE"
        ? "/api/leistungen"
        : `/api/leistungen?kategorie=${filter}`;
    const res = await fetch(url);
    const data = await res.json();
    if (Array.isArray(data)) setLeistungen(data);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
      setSelected(new Set());
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Guide-Modus: Dialog auto-öffnen wenn leer
  useEffect(() => {
    if (!loading && guideMode && leistungen.length === 0 && !guideTriggered.current) {
      const timer = setTimeout(() => {
        guideTriggered.current = true;
        setEditId(null);
        setForm(emptyForm);
        setDialogOpen(true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [loading, guideMode, leistungen.length]);

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

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === leistungen.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leistungen.map((l) => l.id)));
    }
  }

  async function handleBulkDelete() {
    const count = selected.size;
    if (!confirm(`${count} Leistung${count > 1 ? "en" : ""} wirklich löschen?`)) return;

    const res = await fetch("/api/leistungen/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });

    if (res.ok) {
      const data = await res.json();
      toast.success(`${data.deleted} Leistung${data.deleted > 1 ? "en" : ""} gelöscht`);
      setSelected(new Set());
      loadData();
    } else {
      toast.error("Fehler beim Löschen");
    }
  }

  async function handleBulkKategorie() {
    const res = await fetch("/api/leistungen/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), kategorie: bulkKategorie }),
    });

    if (res.ok) {
      const data = await res.json();
      toast.success(`${data.updated} Leistung${data.updated > 1 ? "en" : ""} aktualisiert`);
      setSelected(new Set());
      setBulkKatDialogOpen(false);
      loadData();
    } else {
      toast.error("Fehler beim Aktualisieren");
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
          <div className="flex gap-2">
            <HelpTour
              steps={[
                { element: "[data-tour='filter']", popover: { title: "Kategorie-Filter", description: "Filtere nach Kategorie: STREICHEN für Wände/Decke, VORBEREITUNG für Grundierung/Spachteln, TAPEZIEREN für Tapezierarbeiten." } },
                { element: "[data-tour='neue-leistung']", popover: { title: "Neue Leistung", description: "Erstelle eine neue Leistung mit Name, Preis pro m² und Kategorie. Tipp: Lege Standard- und Premium-Varianten an (z.B. 'Wände streichen Standard' und 'Wände streichen Premium')." } },
                { element: "[data-tour='tabelle']", popover: { title: "Leistungskatalog", description: "Alle Leistungen mit Preisen. Die Material-Verknüpfung bestimmt, welches Material automatisch berechnet wird." } },
              ]}
            />
            <AICatalogUpload filterTyp="leistung" onImported={loadData} />
            <Button data-tour="neue-leistung" onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Neue Leistung
            </Button>
          </div>
        }
      />
      <div className="p-8 space-y-4">
        {/* Filter */}
        <div data-tour="filter" className="flex gap-2 flex-wrap">
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

        {/* Bulk-Aktionen */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {selected.size} ausgewählt
            </span>
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkKatDialogOpen(true)}
              >
                Kategorie ändern
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Löschen
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

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
          <div data-tour="tabelle" className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <input
                      type="checkbox"
                      checked={leistungen.length > 0 && selected.size === leistungen.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </TableHead>
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
                  <TableRow key={l.id} className={selected.has(l.id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.has(l.id)}
                        onChange={() => toggleSelect(l.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </TableCell>
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
            {guideMode && !editId && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm space-y-1.5 mt-2">
                <p className="font-medium text-primary">Tipps zum Anlegen:</p>
                <ul className="text-muted-foreground space-y-1 text-xs list-disc pl-4">
                  <li><strong>Name</strong>: Am besten mit Qualität, z.B. &quot;Wände streichen Standard&quot; und &quot;Wände streichen Premium&quot; — das System erkennt Standard/Premium automatisch</li>
                  <li><strong>Kategorie</strong>: STREICHEN = Wand/Decke, VORBEREITUNG = Grundierung/Spachteln, TAPEZIEREN = Tapezierarbeiten</li>
                  <li><strong>Preis pro Einheit</strong>: Dein Arbeitspreis pro m² (ohne Material). z.B. 8,50 €/m² Standard, 12 €/m² Premium</li>
                  <li><strong>Material-Verknüpfung</strong>: Verbindet die Leistung mit der passenden Material-Kategorie. Wandfarbe bei Streicharbeiten, Grundierung bei Grundierarbeit</li>
                </ul>
              </div>
            )}
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

      {/* Dialog: Bulk Kategorie ändern */}
      <Dialog open={bulkKatDialogOpen} onOpenChange={setBulkKatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Kategorie ändern ({selected.size} Leistung{selected.size > 1 ? "en" : ""})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Neue Kategorie</Label>
            <Select value={bulkKategorie} onValueChange={setBulkKategorie}>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkKatDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleBulkKategorie}>
              Ändern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
