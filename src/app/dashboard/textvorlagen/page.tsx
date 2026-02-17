"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  FileText,
  Mail,
  Star,
  Copy,
} from "lucide-react";

const TYPEN = [
  { value: "ANGEBOT_INTRO", label: "Angebots-Einleitung", icon: FileText, color: "bg-blue-100 text-blue-700" },
  { value: "ANGEBOT_SCHLUSS", label: "Angebots-Schlusstext", icon: FileText, color: "bg-blue-100 text-blue-700" },
  { value: "FOLLOWUP_TAG3", label: "Follow-up (3 Tage)", icon: Mail, color: "bg-amber-100 text-amber-700" },
  { value: "FOLLOWUP_TAG7", label: "Follow-up (7 Tage)", icon: Mail, color: "bg-amber-100 text-amber-700" },
  { value: "FOLLOWUP_TAG12", label: "Follow-up (12 Tage)", icon: Mail, color: "bg-amber-100 text-amber-700" },
  { value: "GOOGLE_BEWERTUNG", label: "Google-Bewertung", icon: Star, color: "bg-green-100 text-green-700" },
  { value: "SONSTIGE", label: "Sonstige", icon: FileText, color: "bg-gray-100 text-gray-700" },
];

const VARIABLEN = [
  { key: "{KUNDE}", desc: "Kundenname" },
  { key: "{FIRMA}", desc: "Firmenname" },
  { key: "{INHABER}", desc: "Inhabername" },
  { key: "{NUMMER}", desc: "Angebotsnr." },
  { key: "{BRUTTO}", desc: "Bruttobetrag" },
  { key: "{DATUM}", desc: "Angebotsdatum" },
  { key: "{GUELTIG}", desc: "Gültig bis" },
];

interface TextVorlage {
  id: string;
  name: string;
  typ: string;
  betreff: string | null;
  text: string;
  aktiv: boolean;
}

const emptyForm = {
  name: "",
  typ: "ANGEBOT_INTRO",
  betreff: "",
  text: "",
};

export default function TextvorlagenPage() {
  const [vorlagen, setVorlagen] = useState<TextVorlage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const res = await fetch("/api/textvorlagen");
    const data = await res.json();
    if (Array.isArray(data)) setVorlagen(data);
    setLoading(false);
  }

  function openNew() {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(v: TextVorlage) {
    setEditId(v.id);
    setForm({
      name: v.name,
      typ: v.typ,
      betreff: v.betreff || "",
      text: v.text,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.text) {
      toast.error("Name und Text sind Pflichtfelder");
      return;
    }
    setSaving(true);

    const url = editId ? `/api/textvorlagen/${editId}` : "/api/textvorlagen";
    const method = editId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      toast.success(editId ? "Vorlage aktualisiert" : "Vorlage erstellt");
      setDialogOpen(false);
      loadData();
    } else {
      toast.error("Fehler beim Speichern");
    }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" wirklich löschen?`)) return;
    const res = await fetch(`/api/textvorlagen/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Vorlage gelöscht");
      loadData();
    } else {
      toast.error("Fehler beim Löschen");
    }
  }

  function insertVariable(variable: string) {
    setForm((prev) => ({ ...prev, text: prev.text + variable }));
  }

  const typConfig = (typ: string) => TYPEN.find((t) => t.value === typ) || TYPEN[6];

  // Group by type category
  const angebotVorlagen = vorlagen.filter((v) =>
    v.typ === "ANGEBOT_INTRO" || v.typ === "ANGEBOT_SCHLUSS"
  );
  const followUpVorlagen = vorlagen.filter((v) =>
    v.typ.startsWith("FOLLOWUP_") || v.typ === "GOOGLE_BEWERTUNG"
  );
  const sonstigeVorlagen = vorlagen.filter((v) => v.typ === "SONSTIGE");

  function renderVorlagenGroup(title: string, description: string, items: TextVorlage[]) {
    if (items.length === 0) return null;
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((v) => {
            const cfg = typConfig(v.typ);
            return (
              <div
                key={v.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{v.name}</p>
                    <Badge className={`${cfg.color} border-0 text-[10px]`}>
                      {cfg.label}
                    </Badge>
                  </div>
                  {v.betreff && (
                    <p className="text-xs text-muted-foreground mb-1">
                      Betreff: {v.betreff}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {v.text}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(v)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(v.id, v.name)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Header
        title="Textvorlagen"
        description="Angebotstexte, Follow-up E-Mails, Bewertungsanfragen"
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Neue Vorlage
          </Button>
        }
      />
      <div className="p-8 max-w-4xl space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : vorlagen.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium text-muted-foreground">
                Noch keine Textvorlagen
              </p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Erstelle Vorlagen mit Variablen wie {"{KUNDE}"}, {"{FIRMA}"}, {"{BRUTTO}"}
              </p>
              <Button onClick={openNew}>
                <Plus className="h-4 w-4 mr-2" />
                Erste Vorlage erstellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {renderVorlagenGroup(
              "Angebots-Texte",
              "Einleitung und Schlusstext im PDF",
              angebotVorlagen
            )}
            {renderVorlagenGroup(
              "Follow-up & Bewertung",
              "Automatische Nachfass-E-Mails",
              followUpVorlagen
            )}
            {renderVorlagenGroup(
              "Sonstige",
              "Weitere Textbausteine",
              sonstigeVorlagen
            )}
          </>
        )}

        {/* Variablen-Referenz */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Verfügbare Variablen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {VARIABLEN.map((v) => (
                <Badge key={v.key} variant="outline" className="text-xs cursor-default">
                  <code className="font-mono">{v.key}</code>
                  <span className="ml-1 text-muted-foreground">{v.desc}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Vorlage bearbeiten" : "Neue Vorlage"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Standard-Einleitung"
                />
              </div>
              <div className="space-y-2">
                <Label>Typ</Label>
                <Select
                  value={form.typ}
                  onValueChange={(v) => setForm({ ...form, typ: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPEN.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(form.typ.startsWith("FOLLOWUP_") || form.typ === "GOOGLE_BEWERTUNG") && (
              <div className="space-y-2">
                <Label>E-Mail Betreff</Label>
                <Input
                  value={form.betreff}
                  onChange={(e) => setForm({ ...form, betreff: e.target.value })}
                  placeholder="Ihr Angebot {NUMMER} — {FIRMA}"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Text *</Label>
              <Textarea
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                placeholder="Sehr geehrte(r) {KUNDE},&#10;&#10;vielen Dank für Ihre Anfrage..."
                rows={8}
              />
              <div className="flex flex-wrap gap-1">
                {VARIABLEN.map((v) => (
                  <Button
                    key={v.key}
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => insertVariable(v.key)}
                  >
                    {v.key}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
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
