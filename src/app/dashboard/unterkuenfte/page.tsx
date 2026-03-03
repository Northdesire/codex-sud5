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
  gastPreise: Record<string, number> | null;
  saison: Saison;
}

interface Unterkunft {
  id: string;
  name: string;
  beschreibung: string | null;
  typ: string;
  kapazitaet: number;
  preisProNacht: number;
  gastPreise: Record<string, number> | null;
  aktiv: boolean;
  komplexId: string | null;
  komplex: Komplex | null;
  saisonPreise: SaisonPreis[];
  icalUrl: string | null;
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
  hatHausname: false,
  hausname: "",
  saisonPreise: {} as Record<string, string>, // saisonId → preis string
  icalUrl: "",
  hatGastPreise: false,
  gastPreise: {} as Record<string, string>, // "1" → "50", "2" → "65"
  saisonGastPreise: {} as Record<string, Record<string, string>>, // saisonId → {"1": "60"}
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
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // ─── Unterkunft CRUD ─────────────────────

  function openNewUnterkunft(forKomplex?: Komplex) {
    setEditId(null);
    setForm({
      ...emptyUnterkunftForm,
      hatHausname: !!forKomplex,
      hausname: forKomplex?.name ?? "",
    });
    setDialogOpen(true);
  }

  function openEditUnterkunft(u: Unterkunft) {
    setEditId(u.id);
    const sp: Record<string, string> = {};
    for (const p of u.saisonPreise) {
      sp[p.saisonId] = p.preisProNacht.toString();
    }
    // Load gastPreise (basis)
    const gp: Record<string, string> = {};
    if (u.gastPreise) {
      for (const [k, v] of Object.entries(u.gastPreise)) {
        gp[k] = String(v);
      }
    }
    // Load saisonGastPreise
    const sgp: Record<string, Record<string, string>> = {};
    for (const p of u.saisonPreise) {
      if (p.gastPreise) {
        sgp[p.saisonId] = {};
        for (const [k, v] of Object.entries(p.gastPreise)) {
          sgp[p.saisonId][k] = String(v);
        }
      }
    }
    setForm({
      name: u.name,
      beschreibung: u.beschreibung ?? "",
      typ: u.typ,
      kapazitaet: u.kapazitaet.toString(),
      preisProNacht: u.preisProNacht.toString(),
      aktiv: u.aktiv,
      hatHausname: !!u.komplex,
      hausname: u.komplex?.name ?? "",
      saisonPreise: sp,
      icalUrl: u.icalUrl ?? "",
      hatGastPreise: !!u.gastPreise && Object.keys(u.gastPreise).length > 0,
      gastPreise: gp,
      saisonGastPreise: sgp,
    });
    setDialogOpen(true);
  }

  async function handleSaveUnterkunft() {
    if (!form.name || !form.preisProNacht) {
      toast.error("Name und Basispreis/Nacht sind Pflichtfelder");
      return;
    }
    if (form.hatHausname && !form.hausname.trim()) {
      toast.error("Bitte Hausnamen eingeben oder 'Nein' wählen");
      return;
    }
    setSaving(true);

    try {
      // Resolve hausname → komplexId
      let komplexId: string | null = null;
      if (form.hatHausname && form.hausname.trim()) {
        const existing = komplexe.find(
          (k) => k.name.toLowerCase() === form.hausname.trim().toLowerCase()
        );
        if (existing) {
          komplexId = existing.id;
        } else {
          // Create new Komplex
          const kRes = await fetch("/api/komplexe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: form.hausname.trim() }),
          });
          if (!kRes.ok) {
            toast.error("Fehler beim Anlegen des Hauses");
            setSaving(false);
            return;
          }
          const newKomplex = await kRes.json();
          komplexId = newKomplex.id;
        }
      }

      // Build gastPreise (basis)
      let gastPreise: Record<string, number> | null = null;
      if (form.hatGastPreise) {
        const gp: Record<string, number> = {};
        for (const [k, v] of Object.entries(form.gastPreise)) {
          const num = parseFloat(v);
          if (num > 0) gp[k] = num;
        }
        if (Object.keys(gp).length > 0) gastPreise = gp;
      }

      const saisonPreise = Object.entries(form.saisonPreise)
        .filter(([, v]) => v && parseFloat(v) > 0)
        .map(([saisonId, preis]) => {
          // Build saison-specific gastPreise
          let saisonGP: Record<string, number> | null = null;
          if (form.hatGastPreise && form.saisonGastPreise[saisonId]) {
            const sgp: Record<string, number> = {};
            for (const [k, v] of Object.entries(form.saisonGastPreise[saisonId])) {
              const num = parseFloat(v);
              if (num > 0) sgp[k] = num;
            }
            if (Object.keys(sgp).length > 0) saisonGP = sgp;
          }
          return { saisonId, preisProNacht: parseFloat(preis), gastPreise: saisonGP };
        });

      const payload = {
        name: form.name,
        beschreibung: form.beschreibung,
        typ: form.typ,
        kapazitaet: form.kapazitaet,
        preisProNacht: form.preisProNacht,
        gastPreise,
        aktiv: form.aktiv,
        komplexId,
        saisonPreise,
        icalUrl: form.icalUrl || null,
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
    } catch {
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

  async function handleDeleteKomplex(id: string, name: string) {
    if (!confirm(`Haus/Hotel "${name}" wirklich löschen?`)) return;
    const res = await fetch(`/api/komplexe/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Haus/Hotel gelöscht");
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
        {[...new Set(saisons.map((s) => s.name))].map((saisonName) => {
          const matchingSaisonIds = saisons.filter((s) => s.name === saisonName).map((s) => s.id);
          const sp = u.saisonPreise.find((p) => matchingSaisonIds.includes(p.saisonId));
          return (
            <TableCell key={saisonName} className="text-right font-mono text-sm">
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
              {[...new Set(saisons.map((s) => s.name))].map((saisonName) => (
                <TableHead key={saisonName} className="text-right">{saisonName}</TableHead>
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
        description="Zimmer und Ferienwohnungen verwalten"
        actions={
          <Button onClick={() => openNewUnterkunft()}>
            <Plus className="h-4 w-4 mr-2" />
            Neue Unterkunft
          </Button>
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
            <p className="text-sm mt-1">Klicken Sie auf &ldquo;Neue Unterkunft&rdquo; um loszulegen</p>
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
                    <div className="flex gap-2">
                      {g.items.length === 0 && (
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteKomplex(g.id, g.name)} title="Leeres Haus löschen">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => openNewUnterkunft(g)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Zimmer / Wohnung
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
                      Noch keine Zimmer/Wohnungen — klicken Sie oben auf &ldquo;Zimmer / Wohnung&rdquo;
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
            {/* Hausname */}
            <div className="space-y-2">
              <Label>Gehört zu einem Haus / Hotel?</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={form.hatHausname ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm({ ...form, hatHausname: true })}
                >
                  Ja
                </Button>
                <Button
                  type="button"
                  variant={!form.hatHausname ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm({ ...form, hatHausname: false, hausname: "" })}
                >
                  Nein
                </Button>
              </div>
              {form.hatHausname && (
                <Input
                  value={form.hausname}
                  onChange={(e) => setForm({ ...form, hausname: e.target.value })}
                  placeholder="z.B. Hotel Kaap2, Haus Schwabenland"
                  list="hausname-suggestions"
                />
              )}
              {form.hatHausname && komplexe.length > 0 && (
                <datalist id="hausname-suggestions">
                  {komplexe.map((k) => (
                    <option key={k.id} value={k.name} />
                  ))}
                </datalist>
              )}
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

            {/* Preis nach Personenzahl */}
            <div className="space-y-2">
              <Label>Preis nach Personenzahl?</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={form.hatGastPreise ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm({ ...form, hatGastPreise: true })}
                >
                  Ja
                </Button>
                <Button
                  type="button"
                  variant={!form.hatGastPreise ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm({ ...form, hatGastPreise: false })}
                >
                  Nein
                </Button>
              </div>
              {form.hatGastPreise && parseInt(form.kapazitaet) > 0 && (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Basispreise pro Personenzahl (EUR/Nacht)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: parseInt(form.kapazitaet) || 1 }, (_, i) => i + 1).map((n) => (
                      <div key={n} className="flex items-center gap-2">
                        <span className="text-sm w-16 shrink-0">{n} {n === 1 ? "Gast" : "Gäste"}:</span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={form.preisProNacht || "—"}
                          value={form.gastPreise[String(n)] ?? ""}
                          onChange={(e) => {
                            const updated = { ...form.gastPreise, [String(n)]: e.target.value };
                            setForm({ ...form, gastPreise: updated });
                          }}
                          className="h-8"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Saisonpreise — gruppiert nach Name (ein Preis pro Saisontyp) */}
            {saisons.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Saisonpreise (EUR/Nacht)</Label>
                <p className="text-xs text-muted-foreground">
                  Optional — wenn leer, gilt der Basispreis
                </p>
                <div className="space-y-2">
                  {[...new Set(saisons.map((s) => s.name))].map((saisonName) => {
                    // Use the first saison with this name as key for the form value
                    const firstSaison = saisons.find((s) => s.name === saisonName)!;
                    const saisonPreisValue = form.saisonPreise[firstSaison.id] ?? "";
                    const hasSaisonPreis = saisonPreisValue && parseFloat(saisonPreisValue) > 0;
                    return (
                      <div key={saisonName} className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm w-32 shrink-0">{saisonName}:</span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="—"
                            value={saisonPreisValue}
                            onChange={(e) => {
                              // Set same price for ALL saisons with this name
                              const updated = { ...form.saisonPreise };
                              for (const s of saisons) {
                                if (s.name === saisonName) {
                                  updated[s.id] = e.target.value;
                                }
                              }
                              setForm({ ...form, saisonPreise: updated });
                            }}
                            className="h-9"
                          />
                          <span className="text-xs text-muted-foreground shrink-0">EUR/Nacht</span>
                        </div>
                        {form.hatGastPreise && hasSaisonPreis && parseInt(form.kapazitaet) > 0 && (
                          <div className="ml-32 pl-3 border-l-2 space-y-1">
                            <p className="text-xs text-muted-foreground">{saisonName} — Staffel pro Personenzahl</p>
                            <div className="grid grid-cols-2 gap-1">
                              {Array.from({ length: parseInt(form.kapazitaet) || 1 }, (_, i) => i + 1).map((n) => (
                                <div key={n} className="flex items-center gap-2">
                                  <span className="text-xs w-14 shrink-0">{n} {n === 1 ? "Gast" : "Gäste"}:</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder={saisonPreisValue || "—"}
                                    value={form.saisonGastPreise[firstSaison.id]?.[String(n)] ?? ""}
                                    onChange={(e) => {
                                      const updated = { ...form.saisonGastPreise };
                                      // Set for ALL saisons with this name
                                      for (const s of saisons) {
                                        if (s.name === saisonName) {
                                          updated[s.id] = { ...(updated[s.id] || {}), [String(n)]: e.target.value };
                                        }
                                      }
                                      setForm({ ...form, saisonGastPreise: updated });
                                    }}
                                    className="h-7 text-xs"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* iCal URL */}
            <div className="space-y-2">
              <Label>iCal-URL (optional)</Label>
              <Input
                value={form.icalUrl}
                onChange={(e) => setForm({ ...form, icalUrl: e.target.value })}
                placeholder="https://www.airbnb.com/calendar/ical/12345.ics"
              />
              <p className="text-xs text-muted-foreground">
                Kalender-URL z.B. von Airbnb oder Booking.com zur Verfügbarkeitsprüfung
              </p>
            </div>
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
