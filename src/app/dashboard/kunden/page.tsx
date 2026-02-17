"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Kunde {
  id: string;
  name: string;
  typ: string;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  email: string | null;
  telefon: string | null;
  notizen: string | null;
  _count: { angebote: number };
}

const KundenTypLabels: Record<string, string> = {
  PRIVAT: "Privat",
  GEWERBE: "Gewerbe",
  HAUSVERWALTUNG: "Hausverwaltung",
};

export default function KundenPage() {
  const router = useRouter();
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Kunde | null>(null);
  const [form, setForm] = useState({
    name: "",
    typ: "PRIVAT",
    strasse: "",
    plz: "",
    ort: "",
    email: "",
    telefon: "",
    notizen: "",
  });

  useEffect(() => {
    fetch("/api/kunden")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setKunden(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function openNew() {
    setEditing(null);
    setForm({ name: "", typ: "PRIVAT", strasse: "", plz: "", ort: "", email: "", telefon: "", notizen: "" });
    setDialogOpen(true);
  }

  function openEdit(k: Kunde) {
    setEditing(k);
    setForm({
      name: k.name, typ: k.typ, strasse: k.strasse || "", plz: k.plz || "",
      ort: k.ort || "", email: k.email || "", telefon: k.telefon || "", notizen: k.notizen || "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Name ist erforderlich"); return; }
    try {
      if (editing) {
        const res = await fetch(`/api/kunden/${editing.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
        const updated = await res.json();
        setKunden((prev) => prev.map((k) => k.id === editing.id ? { ...updated, _count: k._count } : k));
        toast.success("Kunde aktualisiert");
      } else {
        const res = await fetch("/api/kunden", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
        const created = await res.json();
        setKunden((prev) => [...prev, { ...created, _count: { angebote: 0 } }]);
        toast.success("Kunde erstellt");
      }
      setDialogOpen(false);
    } catch { toast.error("Fehler beim Speichern"); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Kunde wirklich löschen?")) return;
    try {
      await fetch(`/api/kunden/${id}`, { method: "DELETE" });
      setKunden((prev) => prev.filter((k) => k.id !== id));
      toast.success("Kunde gelöscht");
    } catch { toast.error("Fehler beim Löschen"); }
  }

  const filtered = kunden.filter((k) =>
    !search ||
    k.name.toLowerCase().includes(search.toLowerCase()) ||
    k.ort?.toLowerCase().includes(search.toLowerCase()) ||
    k.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Header
        title="Kunden"
        description={`${kunden.length} Kunden im Stamm`}
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Neuer Kunde
          </Button>
        }
      />
      <div className="p-8">
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Suche nach Name, Ort, E-Mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed p-12 text-center">
            <p className="text-muted-foreground">{search ? "Keine Kunden gefunden" : "Noch keine Kunden — werden automatisch beim Angebot-Erstellen angelegt"}</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-sm">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Typ</th>
                  <th className="text-left px-4 py-3 font-medium">Ort</th>
                  <th className="text-left px-4 py-3 font-medium">Kontakt</th>
                  <th className="text-right px-4 py-3 font-medium">Angebote</th>
                  <th className="text-right px-4 py-3 font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((k) => (
                  <tr key={k.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{k.name}</p>
                      {k.strasse && <p className="text-xs text-muted-foreground">{k.strasse}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">{KundenTypLabels[k.typ] || k.typ}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{k.plz} {k.ort}</td>
                    <td className="px-4 py-3">
                      {k.email && <p className="text-xs text-muted-foreground">{k.email}</p>}
                      {k.telefon && <p className="text-xs text-muted-foreground">{k.telefon}</p>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant="secondary" className="text-xs">{k._count.angebote}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" title="Details" onClick={() => router.push(`/dashboard/kunden/${k.id}`)}><ExternalLink className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" title="Bearbeiten" onClick={() => openEdit(k)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" title="Löschen" onClick={() => handleDelete(k.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Kunde bearbeiten" : "Neuer Kunde"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Typ</Label>
              <select className="w-full h-9 rounded-md border px-3 text-sm" value={form.typ} onChange={(e) => setForm({ ...form, typ: e.target.value })}>
                <option value="PRIVAT">Privat</option>
                <option value="GEWERBE">Gewerbe</option>
                <option value="HAUSVERWALTUNG">Hausverwaltung</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>E-Mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefon</Label><Input value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} /></div>
            </div>
            <div><Label>Straße</Label><Input value={form.strasse} onChange={(e) => setForm({ ...form, strasse: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>PLZ</Label><Input value={form.plz} onChange={(e) => setForm({ ...form, plz: e.target.value })} /></div>
              <div className="col-span-2"><Label>Ort</Label><Input value={form.ort} onChange={(e) => setForm({ ...form, ort: e.target.value })} /></div>
            </div>
            <Button className="w-full" onClick={handleSave}>{editing ? "Speichern" : "Erstellen"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
