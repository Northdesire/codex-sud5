"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Download,
  Loader2,
  Copy,
  Mail,
  Search,
  Pencil,
  Trash2,
  Send,
  Plus,
  Minus,
  X,
  Receipt,
} from "lucide-react";
import { formatEuro } from "@/lib/kalkulation";
import { toast } from "sonner";
import Link from "next/link";

interface Position {
  id?: string;
  posNr: number;
  typ: string;
  bezeichnung: string;
  menge: number;
  einheit: string;
  einzelpreis: number;
  gesamtpreis: number;
  raumName?: string | null;
}

interface Angebot {
  id: string;
  nummer: string;
  datum: string;
  status: string;
  kundeName: string;
  kundeEmail: string | null;
  kundeStrasse: string | null;
  kundePlz: string | null;
  kundeOrt: string | null;
  kundeTelefon: string | null;
  materialNetto: number;
  arbeitsNetto: number;
  anfahrt: number;
  zuschlagNetto: number;
  rabattNetto: number;
  netto: number;
  mwstBetrag: number;
  brutto: number;
  mwstSatz?: number;
  einleitungsText?: string | null;
  schlussText?: string | null;
  positionen: Position[];
  firma?: {
    firmenname: string;
    inhaberName: string;
    inhaberTitel: string | null;
    strasse: string;
    plz: string;
    ort: string;
    telefon: string;
    email: string;
    iban: string | null;
    bic: string | null;
    bankname: string | null;
    zahlungsziel: number;
    mwstSatz: number;
    steuernummer?: string | null;
    ustIdNr?: string | null;
    agbText?: string | null;
  };
  gueltigBis: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  ENTWURF: { label: "Entwurf", color: "bg-gray-100 text-gray-700" },
  OFFEN: { label: "Offen", color: "bg-blue-100 text-blue-700" },
  ANGENOMMEN: { label: "Angenommen", color: "bg-green-100 text-green-700" },
  ABGELEHNT: { label: "Abgelehnt", color: "bg-red-100 text-red-700" },
  ABGELAUFEN: { label: "Abgelaufen", color: "bg-yellow-100 text-yellow-700" },
};

const STATUS_OPTIONS = ["ALLE", "ENTWURF", "OFFEN", "ANGENOMMEN", "ABGELEHNT", "ABGELAUFEN"];

export function AngeboteTable() {
  const router = useRouter();
  const [angebote, setAngebote] = useState<Angebot[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [branche, setBranche] = useState<string>("MALER");

  // Rechnung-IDs pro Angebot (nach Auto-Erstellung)
  const [rechnungMap, setRechnungMap] = useState<Record<string, { id: string; nummer: string }>>({});

  // Search & Filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALLE");

  // Email dialog
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAngebot, setEmailAngebot] = useState<Angebot | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editAngebot, setEditAngebot] = useState<Angebot | null>(null);
  const [editPositionen, setEditPositionen] = useState<Position[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  const loadAngebote = useCallback(async () => {
    try {
      const res = await fetch("/api/angebote");
      const data = await res.json();
      if (Array.isArray(data)) setAngebote(data);
    } catch (error) {
      console.error("Laden Fehler:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAngebote();
    fetch("/api/firma/branche")
      .then((r) => r.json())
      .then((d) => setBranche(d.branche || "MALER"))
      .catch(() => {});
  }, [loadAngebote]);

  // Filtered angebote
  const filtered = angebote.filter((a) => {
    const matchesSearch =
      !search ||
      a.kundeName.toLowerCase().includes(search.toLowerCase()) ||
      a.nummer.toLowerCase().includes(search.toLowerCase()) ||
      a.kundeEmail?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALLE" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/angebote/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setAngebote((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status } : a))
        );
        toast.success(`Status auf "${statusConfig[status]?.label}" gesetzt`);

        // SHOP: Auto-Rechnung erstellen bei ANGENOMMEN
        if (status === "ANGENOMMEN" && branche === "SHOP") {
          try {
            const rRes = await fetch("/api/rechnungen/aus-angebot", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ angebotId: id }),
            });
            if (rRes.ok) {
              const rData = await rRes.json();
              setRechnungMap((prev) => ({ ...prev, [id]: { id: rData.id, nummer: rData.nummer } }));
              toast.success(`Rechnung ${rData.nummer} automatisch erstellt`);
            }
          } catch {
            // Rechnung-Erstellung still optional
          }
        }
      }
    } catch (error) {
      console.error("Status update Fehler:", error);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handlePDF(angebot: Angebot) {
    try {
      const { generateAngebotPDF } = await import("@/lib/pdf");
      const mwstSatz = angebot.mwstSatz ?? angebot.firma?.mwstSatz ?? 19;
      const blob = generateAngebotPDF({
        nummer: angebot.nummer,
        datum: new Date(angebot.datum),
        gueltigBis: new Date(angebot.gueltigBis),
        kunde: {
          name: angebot.kundeName,
          strasse: angebot.kundeStrasse || undefined,
          plz: angebot.kundePlz || undefined,
          ort: angebot.kundeOrt || undefined,
          email: angebot.kundeEmail || undefined,
        },
        firma: angebot.firma || null,
        positionen: angebot.positionen,
        materialNetto: angebot.materialNetto,
        arbeitsNetto: angebot.arbeitsNetto,
        anfahrt: angebot.anfahrt,
        zuschlagNetto: angebot.zuschlagNetto,
        rabattNetto: angebot.rabattNetto,
        netto: angebot.netto,
        mwstSatz,
        mwstBetrag: angebot.mwstBetrag,
        brutto: angebot.brutto,
        einleitungsText: angebot.einleitungsText,
        schlussText: angebot.schlussText,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${angebot.nummer}_${angebot.kundeName.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF Fehler:", error);
      toast.error("Fehler beim PDF-Erstellen");
    }
  }

  async function handleDuplicate(angebot: Angebot) {
    setUpdatingId(angebot.id);
    try {
      const res = await fetch(`/api/angebote/${angebot.id}/duplizieren`, {
        method: "POST",
      });
      if (res.ok) {
        const newAngebot = await res.json();
        toast.success(`Dupliziert als ${newAngebot.nummer}`);
        loadAngebote();
      } else {
        toast.error("Fehler beim Duplizieren");
      }
    } catch {
      toast.error("Fehler beim Duplizieren");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(angebot: Angebot) {
    if (!confirm(`Angebot ${angebot.nummer} wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/angebote/${angebot.id}`, { method: "DELETE" });
      if (res.ok) {
        setAngebote((prev) => prev.filter((a) => a.id !== angebot.id));
        toast.success("Angebot gelöscht");
      }
    } catch {
      toast.error("Fehler beim Löschen");
    }
  }

  // Email
  function openEmailDialog(angebot: Angebot) {
    setEmailAngebot(angebot);
    setEmailTo(angebot.kundeEmail || "");
    setEmailDialogOpen(true);
  }

  async function handleSendEmail() {
    if (!emailAngebot || !emailTo) return;
    setEmailSending(true);
    try {
      const res = await fetch(`/api/angebote/${emailAngebot.id}/senden`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("E-Mail gesendet");
        setEmailDialogOpen(false);
        // Update status locally
        if (emailAngebot.status === "ENTWURF") {
          setAngebote((prev) =>
            prev.map((a) =>
              a.id === emailAngebot.id ? { ...a, status: "OFFEN" } : a
            )
          );
        }
      } else {
        const err = await res.json();
        toast.error(err.error || "Fehler beim Senden");
      }
    } catch {
      toast.error("Fehler beim Senden");
    } finally {
      setEmailSending(false);
    }
  }

  // Edit
  function openEditDialog(angebot: Angebot) {
    setEditAngebot({ ...angebot });
    setEditPositionen(
      angebot.positionen.map((p) => ({ ...p }))
    );
    setEditDialogOpen(true);
  }

  function updatePosition(index: number, field: keyof Position, value: string | number) {
    setEditPositionen((prev) => {
      const updated = [...prev];
      const pos = { ...updated[index], [field]: value };
      if (field === "menge" || field === "einzelpreis") {
        pos.gesamtpreis = Math.round((pos.menge as number) * (pos.einzelpreis as number) * 100) / 100;
      }
      updated[index] = pos;
      return updated;
    });
  }

  function isShopAngebot(positionen: Position[]) {
    return positionen.some((p) => p.typ === "PRODUKT");
  }

  function addPosition() {
    const maxPosNr = editPositionen.reduce((max, p) => Math.max(max, p.posNr), 0);
    const isShop = isShopAngebot(editPositionen);
    setEditPositionen((prev) => [
      ...prev,
      {
        posNr: maxPosNr + 1,
        typ: isShop ? "PRODUKT" : "LEISTUNG",
        bezeichnung: "",
        menge: 1,
        einheit: isShop ? "Stk." : "m²",
        einzelpreis: 0,
        gesamtpreis: 0,
      },
    ]);
  }

  function removePosition(index: number) {
    setEditPositionen((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleEditSave() {
    if (!editAngebot) return;
    setEditSaving(true);

    // Recalculate totals
    const isShop = isShopAngebot(editPositionen);
    const leistungen = editPositionen.filter((p) => p.typ === "LEISTUNG");
    const materialien = editPositionen.filter((p) => p.typ === "MATERIAL");
    const produktePos = editPositionen.filter((p) => p.typ === "PRODUKT" || p.typ === "VERSAND");
    const zuschlaege = editPositionen.filter((p) => p.typ === "ZUSCHLAG");
    const rabatte = editPositionen.filter((p) => p.typ === "RABATT");
    const anfahrtPos = editPositionen.find((p) => p.typ === "ANFAHRT");

    const produkteNetto = produktePos.reduce((s, p) => s + p.gesamtpreis, 0);
    const arbeitsNetto = isShop ? produkteNetto : leistungen.reduce((s, p) => s + p.gesamtpreis, 0);
    const materialNetto = isShop ? 0 : materialien.reduce((s, p) => s + p.gesamtpreis, 0);
    const zuschlagNetto = zuschlaege.reduce((s, p) => s + p.gesamtpreis, 0);
    const rabattNetto = rabatte.reduce((s, p) => s + Math.abs(p.gesamtpreis), 0);
    const anfahrt = anfahrtPos?.gesamtpreis || 0;
    const netto = arbeitsNetto + materialNetto + zuschlagNetto - rabattNetto + anfahrt;
    const mwstSatz = editAngebot.mwstSatz ?? editAngebot.firma?.mwstSatz ?? 19;
    const mwstBetrag = Math.round(netto * (mwstSatz / 100) * 100) / 100;
    const brutto = Math.round((netto + mwstBetrag) * 100) / 100;

    try {
      const res = await fetch(`/api/angebote/${editAngebot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionen: editPositionen.map((p) => ({
            posNr: p.posNr,
            typ: p.typ,
            bezeichnung: p.bezeichnung,
            menge: p.menge,
            einheit: p.einheit,
            einzelpreis: p.einzelpreis,
            gesamtpreis: p.gesamtpreis,
            raumName: p.raumName || null,
          })),
          kundeName: editAngebot.kundeName,
          kundeEmail: editAngebot.kundeEmail,
          kundeStrasse: editAngebot.kundeStrasse,
          kundePlz: editAngebot.kundePlz,
          kundeOrt: editAngebot.kundeOrt,
          kundeTelefon: editAngebot.kundeTelefon,
          materialNetto,
          arbeitsNetto,
          anfahrt,
          zuschlagNetto,
          rabattNetto,
          netto,
          mwstBetrag,
          brutto,
          einleitungsText: editAngebot.einleitungsText,
          schlussText: editAngebot.schlussText,
        }),
      });

      if (res.ok) {
        toast.success("Angebot aktualisiert");
        setEditDialogOpen(false);
        loadAngebote();
      } else {
        toast.error("Fehler beim Speichern");
      }
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setEditSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (angebote.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 p-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          Noch keine Angebote erstellt
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Erstelle Angebote über die Mobile-App (AI-Eingabe)
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suche nach Kunde, Nummer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTIONS.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s === "ALLE" ? "Alle" : statusConfig[s]?.label || s}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            Keine Angebote gefunden
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 text-sm">
                <th className="text-left px-4 py-3 font-medium">Nummer</th>
                <th className="text-left px-4 py-3 font-medium">Kunde</th>
                <th className="text-left px-4 py-3 font-medium">Datum</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Brutto</th>
                <th className="text-right px-4 py-3 font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const cfg = statusConfig[a.status] || statusConfig.ENTWURF;
                return (
                  <tr
                    key={a.id}
                    className="border-t hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-sm">{a.nummer}</td>
                    <td className="px-4 py-3">
                      <p
                        className="font-medium text-sm hover:underline cursor-pointer"
                        onClick={() => {
                          // Navigate to Kunde if exists
                          if (a.kundeEmail || a.kundeName) {
                            // Just show info for now
                          }
                        }}
                      >
                        {a.kundeName}
                      </p>
                      {a.kundeEmail && (
                        <p className="text-xs text-muted-foreground">
                          {a.kundeEmail}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(a.datum).toLocaleDateString("de-DE")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${cfg.color} border-0 text-xs`}>
                        {cfg.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-medium">
                      {formatEuro(a.brutto)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {/* PDF Download */}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="PDF herunterladen"
                          onClick={() => handlePDF(a)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {/* Edit */}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Bearbeiten"
                          onClick={() => openEditDialog(a)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {/* Duplicate */}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Duplizieren"
                          onClick={() => handleDuplicate(a)}
                          disabled={updatingId === a.id}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {/* Email */}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Per E-Mail senden"
                          onClick={() => openEmailDialog(a)}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        {/* Status actions */}
                        {(a.status === "ENTWURF" || a.status === "OFFEN") && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-700 border-green-200 hover:bg-green-50"
                              onClick={() => updateStatus(a.id, "ANGENOMMEN")}
                              disabled={updatingId === a.id}
                            >
                              Angenommen
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-700 border-red-200 hover:bg-red-50"
                              onClick={() => updateStatus(a.id, "ABGELEHNT")}
                              disabled={updatingId === a.id}
                            >
                              Abgelehnt
                            </Button>
                          </>
                        )}
                        {/* Rechnung-Link (SHOP) */}
                        {a.status === "ANGENOMMEN" && branche === "SHOP" && rechnungMap[a.id] && (
                          <Link href={`/dashboard/rechnungen`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-orange-700 border-orange-200 hover:bg-orange-50"
                            >
                              <Receipt className="h-3.5 w-3.5 mr-1" />
                              {rechnungMap[a.id].nummer}
                            </Button>
                          </Link>
                        )}
                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Löschen"
                          onClick={() => handleDelete(a)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Angebot per E-Mail senden
            </DialogTitle>
          </DialogHeader>
          {emailAngebot && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm font-medium">
                  {emailAngebot.nummer} — {emailAngebot.kundeName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatEuro(emailAngebot.brutto)} Brutto
                </p>
              </div>
              <div className="space-y-2">
                <Label>E-Mail-Adresse</Label>
                <Input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="kunde@beispiel.de"
                />
                {!emailTo && (
                  <p className="text-xs text-destructive">
                    Keine E-Mail-Adresse hinterlegt
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Das Angebot wird als PDF-Anhang versendet. Der Status wird
                automatisch auf &ldquo;Offen&rdquo; gesetzt.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={emailSending || !emailTo}
            >
              {emailSending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Angebot {editAngebot?.nummer} bearbeiten
            </DialogTitle>
          </DialogHeader>
          {editAngebot && (
            <div className="space-y-4">
              {/* Kunde */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Kunde</Label>
                  <Input
                    value={editAngebot.kundeName}
                    onChange={(e) =>
                      setEditAngebot({ ...editAngebot, kundeName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">E-Mail</Label>
                  <Input
                    value={editAngebot.kundeEmail || ""}
                    onChange={(e) =>
                      setEditAngebot({ ...editAngebot, kundeEmail: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Texte */}
              <div className="space-y-1">
                <Label className="text-xs">Einleitungstext</Label>
                <Textarea
                  value={editAngebot.einleitungsText || ""}
                  onChange={(e) =>
                    setEditAngebot({ ...editAngebot, einleitungsText: e.target.value })
                  }
                  rows={2}
                />
              </div>

              {/* Positionen */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Positionen</Label>
                  <Button variant="outline" size="sm" onClick={addPosition}>
                    <Plus className="h-3 w-3 mr-1" /> Position
                  </Button>
                </div>
                <div className="space-y-2">
                  {editPositionen.map((pos, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[60px_auto_60px_1fr_70px_60px_70px_32px] gap-2 items-center"
                    >
                      <select
                        className="h-8 rounded border px-1 text-xs"
                        value={pos.typ}
                        onChange={(e) => updatePosition(i, "typ", e.target.value)}
                      >
                        {isShopAngebot(editPositionen) ? (
                          <>
                            <option value="PRODUKT">Produkt</option>
                            <option value="VERSAND">Versand</option>
                          </>
                        ) : (
                          <>
                            <option value="LEISTUNG">Leist.</option>
                            <option value="MATERIAL">Mat.</option>
                            <option value="ZUSCHLAG">Zuschl.</option>
                            <option value="RABATT">Rabatt</option>
                            <option value="ANFAHRT">Anf.</option>
                          </>
                        )}
                      </select>
                      <Input
                        className="h-8 text-xs"
                        value={pos.bezeichnung}
                        onChange={(e) =>
                          updatePosition(i, "bezeichnung", e.target.value)
                        }
                        placeholder="Bezeichnung"
                      />
                      <Input
                        className="h-8 text-xs text-right"
                        type="number"
                        step="0.1"
                        value={pos.menge}
                        onChange={(e) =>
                          updatePosition(i, "menge", parseFloat(e.target.value) || 0)
                        }
                      />
                      <Input
                        className="h-8 text-xs"
                        value={pos.einheit}
                        onChange={(e) =>
                          updatePosition(i, "einheit", e.target.value)
                        }
                        placeholder="m²"
                      />
                      <Input
                        className="h-8 text-xs text-right"
                        type="number"
                        step="0.01"
                        value={pos.einzelpreis}
                        onChange={(e) =>
                          updatePosition(
                            i,
                            "einzelpreis",
                            parseFloat(e.target.value) || 0
                          )
                        }
                      />
                      <p className="text-xs text-right font-mono">
                        {pos.gesamtpreis.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-muted-foreground text-right">EUR</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removePosition(i)}
                      >
                        <X className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Schlusstext */}
              <div className="space-y-1">
                <Label className="text-xs">Schlusstext</Label>
                <Textarea
                  value={editAngebot.schlussText || ""}
                  onChange={(e) =>
                    setEditAngebot({ ...editAngebot, schlussText: e.target.value })
                  }
                  rows={2}
                />
              </div>

              {/* Summen Preview */}
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Positionen:</span>
                  <span className="font-mono">
                    {formatEuro(
                      editPositionen.reduce((s, p) => s + p.gesamtpreis, 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
