"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Building2, Copy } from "lucide-react";

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

interface SaisonPreis {
  id: string;
  saisonId: string;
  preisProNacht: number;
  saison: Saison;
}

interface Unterkunft {
  id: string;
  name: string;
  beschreibung: string | null;
  typ: string;
  kapazitaet: number;
  preisProNacht: number;
  aktiv: boolean;
  komplexId: string | null;
  komplex: Komplex | null;
  saisonPreise: SaisonPreis[];
}

interface Komplex {
  id: string;
  name: string;
  beschreibung: string | null;
  unterkuenfte: Unterkunft[];
}

interface Saison {
  id: string;
  name: string;
  von: string;
  bis: string;
  faktor: number;
}

const TYP_OPTIONS = [
  { value: "EINZELZIMMER", label: "EZ" },
  { value: "DOPPELZIMMER", label: "DZ" },
  { value: "SUITE", label: "Suite" },
  { value: "FERIENWOHNUNG", label: "FeWo" },
  { value: "BENUTZERDEFINIERT", label: "Sonstige" },
];

function typLabel(typ: string) {
  return TYP_OPTIONS.find((t) => t.value === typ)?.label ?? typ;
}

function formatEuro(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

// ═══════════════════════════════════════════
// Empty Forms
// ═══════════════════════════════════════════

const emptyUnterkunftForm = {
  name: "",
  beschreibung: "",
  typ: "FERIENWOHNUNG",
  kapazitaet: "4",
  preisProNacht: "",
  aktiv: true,
  komplexId: "",
  saisonPreise: {} as Record<string, string>, // saisonId → preis string
};

const emptyKomplexForm = {
  name: "",
  beschreibung: "",
};

// ═══════════════════════════════════════════
// Component
// ═══════════════════════════════════════════

export default function UnterkuenftePage() {
  const [unterkuenfte, setUnterkuenfte] = useState<Unterkunft[]>([]);
  const [komplexe, setKomplexe] = useState<Komplex[]>([]);
  const [saisons, setSaisons] = useState<Saison[]>([]);
  const [loading, setLoading] = useState(true);

  // Unterkunft Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyUnterkunftForm);
  const [saving, setSaving] = useState(false);

  // Komplex Dialog
  const [komplexDialogOpen, setKomplexDialogOpen] = useState(false);
  const [editKomplexId, setEditKomplexId] = useState<string | null>(null);
  const [komplexForm, setKomplexForm] = useState(emptyKomplexForm);
  const [komplexSaving, setKomplexSaving] = useState(false);

  // Preise kopieren Dialog
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copySourceId, setCopySourceId] = useState("");
  const [copyTargetIds, setCopyTargetIds] = useState<Set<string>>(new Set());
  const [copySaving, setCopySaving] = useState(false);

  // ─── Data Loading ────────────────────────

  const loadData = useCallback(async () => {
    const [uRes, kRes, sRes] = await Promise.all([
      fetch("/api/unterkuenfte"),
      fetch("/api/komplexe"),
      fetch("/api/saisons"),
    ]);
    const [u, k, s] = await Promise.all([uRes.json(), kRes.json(), sRes.json()]);
    if (Array.isArray(u)) setUnterkuenfte(u);
    if (Array.isArray(k)) setKomplexe(k);
    if (Array.isArray(s)) setSaisons(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Unterkunft CRUD ─────────────────────

  function openNewUnterkunft() {
    setEditId(null);
    setForm(emptyUnterkunftForm);
    setDialogOpen(true);
  }

  function openEditUnterkunft(u: Unterkunft) {
    setEditId(u.id);
    const sp: Record<string, string> = {};
    for (const p of u.saisonPreise) {
      sp[p.saisonId] = p.preisProNacht.toString();
    }
    setForm({
      name: u.name,
      beschreibung: u.beschreibung ?? "",
      typ: u.typ,
      kapazitaet: u.kapazitaet.toString(),
      preisProNacht: u.preisProNacht.toString(),
      aktiv: u.aktiv,
      komplexId: u.komplexId ?? "",
      saisonPreise: sp,
    });
    setDialogOpen(true);
  }

  async function handleSaveUnterkunft() {
    if (!form.name || !form.preisProNacht) {
      toast.error("Name und Basispreis/Nacht sind Pflichtfelder");
      return;
    }
    setSaving(true);

    const saisonPreise = Object.entries(form.saisonPreise)
      .filter(([, v]) => v && parseFloat(v) > 0)
      .map(([saisonId, preis]) => ({ saisonId, preisProNacht: parseFloat(preis) }));

    const payload = {
      name: form.name,
      beschreibung: form.beschreibung,
      typ: form.typ,
      kapazitaet: form.kapazitaet,
      preisProNacht: form.preisProNacht,
      aktiv: form.aktiv,
      komplexId: form.komplexId || null,
      saisonPreise,
    };

    const url = editId ? `/api/unterkuenfte/${editId}` : "/api/unterkuenfte";
    const method = editId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

  async function handleDeleteUnterkunft(id: string, name: string) {
    if (!confirm(`"${name}" wirklich löschen?`)) return;
    const res = await fetch(`/api/unterkuenfte/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Unterkunft gelöscht");
      loadData();
    } else {
      toast.error("Fehler beim Löschen");
    }
  }

  // ─── Komplex CRUD ────────────────────────

  function openNewKomplex() {
    setEditKomplexId(null);
    setKomplexForm(emptyKomplexForm);
    setKomplexDialogOpen(true);
  }

  function openEditKomplex(k: Komplex) {
    setEditKomplexId(k.id);
    setKomplexForm({ name: k.name, beschreibung: k.beschreibung ?? "" });
    setKomplexDialogOpen(true);
  }

  async function handleSaveKomplex() {
    if (!komplexForm.name) {
      toast.error("Name ist Pflichtfeld");
      return;
    }
    setKomplexSaving(true);

    const url = editKomplexId ? `/api/komplexe/${editKomplexId}` : "/api/komplexe";
    const method = editKomplexId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(komplexForm),
    });

    if (res.ok) {
      toast.success(editKomplexId ? "Komplex aktualisiert" : "Komplex erstellt");
      setKomplexDialogOpen(false);
      loadData();
    } else {
      toast.error("Fehler beim Speichern");
    }
    setKomplexSaving(false);
  }

  async function handleDeleteKomplex(id: string, name: string) {
    if (!confirm(`Komplex "${name}" wirklich löschen? Unterkünfte bleiben erhalten.`)) return;
    const res = await fetch(`/api/komplexe/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Komplex gelöscht");
      loadData();
    } else {
      toast.error("Fehler beim Löschen");
    }
  }

  // ─── Preise kopieren ─────────────────────

  function openCopyDialog(sourceId: string) {
    setCopySourceId(sourceId);
    setCopyTargetIds(new Set());
    setCopyDialogOpen(true);
  }

  function toggleCopyTarget(id: string) {
    setCopyTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCopyPreise() {
    if (copyTargetIds.size === 0) {
      toast.error("Bitte mindestens eine Ziel-Unterkunft auswählen");
      return;
    }
    setCopySaving(true);
    const res = await fetch("/api/unterkuenfte/kopiere-preise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vonUnterkunftId: copySourceId,
        nachUnterkunftIds: Array.from(copyTargetIds),
      }),
    });
    if (res.ok) {
      toast.success(`Preise auf ${copyTargetIds.size} Unterkunft(e) kopiert`);
      setCopyDialogOpen(false);
      loadData();
    } else {
      toast.error("Fehler beim Kopieren");
    }
    setCopySaving(false);
  }

  // ─── Grouping ────────────────────────────

  const grouped = komplexe.map((k) => ({
    ...k,
    items: unterkuenfte.filter((u) => u.komplexId === k.id),
  }));
  const ungrouped = unterkuenfte.filter((u) => !u.komplexId);

  // ─── Copy target candidates (same komplex preferred) ───

  const copySource = unterkuenfte.find((u) => u.id === copySourceId);
  const copyCandidates = unterkuenfte.filter((u) => u.id !== copySourceId);
  // Sort: same komplex first
  const copyCandidatesSorted = [...copyCandidates].sort((a, b) => {
    const aMatch = copySource?.komplexId && a.komplexId === copySource.komplexId ? 0 : 1;
    const bMatch = copySource?.komplexId && b.komplexId === copySource.komplexId ? 0 : 1;
    return aMatch - bMatch || a.name.localeCompare(b.name);
  });

  // ─── Render helpers ──────────────────────

  function renderUnterkunftRow(u: Unterkunft) {
    return (
      <TableRow key={u.id}>
        <TableCell>
          <div>
            <p className="font-medium">{u.name}</p>
            {u.beschreibung && (
              <p className="text-xs text-muted-foreground">{u.beschreibung}</p>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline">{typLabel(u.typ)}</Badge>
        </TableCell>
        <TableCell>{u.kapazitaet} Pers.</TableCell>
        <TableCell className="text-right font-mono font-medium">
          {formatEuro(u.preisProNacht)}
        </TableCell>
        {saisons.map((s) => {
          const sp = u.saisonPreise.find((p) => p.saisonId === s.id);
          return (
            <TableCell key={s.id} className="text-right font-mono text-sm">
              {sp ? formatEuro(sp.preisProNacht) : <span className="text-muted-foreground">—</span>}
            </TableCell>
          );
        })}
        <TableCell>
          <Badge variant={u.aktiv ? "default" : "secondary"}>
            {u.aktiv ? "Aktiv" : "Inaktiv"}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => openEditUnterkunft(u)} title="Bearbeiten">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => openCopyDialog(u.id)} title="Preise kopieren">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDeleteUnterkunft(u.id, u.name)} title="Löschen">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  function renderTable(items: Unterkunft[]) {
    if (items.length === 0) return null;
    return (
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Kapazität</TableHead>
              <TableHead className="text-right">Basis/Nacht</TableHead>
              {saisons.map((s) => (
                <TableHead key={s.id} className="text-right">{s.name}</TableHead>
              ))}
              <TableHead>Status</TableHead>
              <TableHead className="w-[120px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{items.map(renderUnterkunftRow)}</TableBody>
        </Table>
      </div>
    );
  }

  // ─── Render ──────────────────────────────

  return (
    <>
      <Header
        title="Unterkünfte"
        description="Komplexe, Zimmer und Ferienwohnungen verwalten"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={openNewKomplex}>
              <Building2 className="h-4 w-4 mr-2" />
              Neuer Komplex
            </Button>
            <Button onClick={openNewUnterkunft}>
              <Plus className="h-4 w-4 mr-2" />
              Neue Unterkunft
            </Button>
          </div>
        }
      />
      <div className="p-8 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : unterkuenfte.length === 0 && komplexe.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">Noch keine Unterkünfte angelegt</p>
            <p className="text-sm mt-1">Erstellen Sie zuerst einen Komplex (optional) und dann Unterkünfte</p>
          </div>
        ) : (
          <>
            {/* Grouped by Komplex */}
            {grouped.map((g) => (
              <Card key={g.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {g.name}
                      <Badge variant="secondary" className="ml-1">{g.items.length} Einheit(en)</Badge>
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditKomplex(g)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteKomplex(g.id, g.name)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {g.beschreibung && (
                    <p className="text-sm text-muted-foreground">{g.beschreibung}</p>
                  )}
                </CardHeader>
                <CardContent>
                  {g.items.length > 0 ? renderTable(g.items) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Noch keine Unterkünfte in diesem Komplex
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Ungrouped */}
            {ungrouped.length > 0 && (
              <div className="space-y-2">
                {komplexe.length > 0 && (
                  <h3 className="text-sm font-medium text-muted-foreground">Ohne Komplex</h3>
                )}
                {renderTable(ungrouped)}
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ Unterkunft Create/Edit Dialog ═══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Unterkunft bearbeiten" : "Neue Unterkunft"}</DialogTitle>
            <DialogDescription>
              {editId ? "Änderungen an der Unterkunft vornehmen" : "Neue Unterkunft anlegen"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Komplex */}
            <div className="space-y-2">
              <Label>Komplex (optional)</Label>
              <select
                value={form.komplexId}
                onChange={(e) => setForm({ ...form, komplexId: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Kein Komplex</option>
                {komplexe.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </div>

            {/* Typ */}
            <div className="space-y-2">
              <Label>Typ</Label>
              <select
                value={form.typ}
                onChange={(e) => setForm({ ...form, typ: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {TYP_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ferienwohnung Seeblick"
              />
            </div>

            {/* Beschreibung */}
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Textarea
                value={form.beschreibung}
                onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
                placeholder="65m², Balkon, Meerblick, 2 Schlafzimmer"
                rows={2}
              />
            </div>

            {/* Kapazität + Basispreis */}
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
                <Label>Basispreis/Nacht (EUR) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.preisProNacht}
                  onChange={(e) => setForm({ ...form, preisProNacht: e.target.value })}
                  placeholder="85.00"
                />
              </div>
            </div>

            {/* Saisonpreise */}
            {saisons.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Saisonpreise (EUR/Nacht)</Label>
                <p className="text-xs text-muted-foreground">
                  Wenn gesetzt, wird dieser Preis statt Basispreis × Faktor verwendet
                </p>
                <div className="space-y-2">
                  {saisons.map((s) => (
                    <div key={s.id} className="flex items-center gap-3">
                      <span className="text-sm w-32 shrink-0">{s.name}:</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={form.preisProNacht ? formatEuro(parseFloat(form.preisProNacht) * s.faktor) : "—"}
                        value={form.saisonPreise[s.id] ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            saisonPreise: { ...form.saisonPreise, [s.id]: e.target.value },
                          })
                        }
                        className="h-9"
                      />
                      <span className="text-xs text-muted-foreground shrink-0">EUR/Nacht</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSaveUnterkunft} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editId ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Komplex Create/Edit Dialog ═══ */}
      <Dialog open={komplexDialogOpen} onOpenChange={setKomplexDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editKomplexId ? "Komplex bearbeiten" : "Neuer Komplex"}</DialogTitle>
            <DialogDescription>
              {editKomplexId ? "Komplex-Daten ändern" : "Neuen Komplex (Hotel, Ferienhaus, etc.) anlegen"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={komplexForm.name}
                onChange={(e) => setKomplexForm({ ...komplexForm, name: e.target.value })}
                placeholder="Hotel Kaap2"
              />
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Textarea
                value={komplexForm.beschreibung}
                onChange={(e) => setKomplexForm({ ...komplexForm, beschreibung: e.target.value })}
                placeholder="Direkt am Deich, 14 Zimmer"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKomplexDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSaveKomplex} disabled={komplexSaving}>
              {komplexSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editKomplexId ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Preise kopieren Dialog ═══ */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preise kopieren</DialogTitle>
            <DialogDescription>
              Basis- und Saisonpreise von <strong>{copySource?.name}</strong> übernehmen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm">Preise übernehmen auf:</Label>
            {copyCandidatesSorted.map((u) => (
              <label
                key={u.id}
                className={`flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors ${
                  copyTargetIds.has(u.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <Checkbox
                  checked={copyTargetIds.has(u.id)}
                  onCheckedChange={() => toggleCopyTarget(u.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {typLabel(u.typ)} — {formatEuro(u.preisProNacht)}/Nacht
                    {u.komplex && ` — ${u.komplex.name}`}
                  </p>
                </div>
              </label>
            ))}
            {copyCandidatesSorted.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Keine weiteren Unterkünfte vorhanden
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCopyPreise} disabled={copySaving || copyTargetIds.size === 0}>
              {copySaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Preise übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
