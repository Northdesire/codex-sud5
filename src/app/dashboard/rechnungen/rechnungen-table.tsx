"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download,
  Loader2,
  Mail,
  Search,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatEuro } from "@/lib/kalkulation";
import { toast } from "sonner";

interface Rechnung {
  id: string;
  nummer: string;
  datum: string;
  faelligAm: string;
  status: string;
  bezahltAm: string | null;
  kundeName: string;
  kundeEmail: string | null;
  netto: number;
  mwstSatz: number;
  mwstBetrag: number;
  brutto: number;
  einleitungsText?: string | null;
  schlussText?: string | null;
  positionen: Array<{
    posNr: number;
    typ: string;
    bezeichnung: string;
    menge: number;
    einheit: string;
    einzelpreis: number;
    gesamtpreis: number;
  }>;
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
    mwstSatz: number;
    steuernummer?: string | null;
    ustIdNr?: string | null;
    agbText?: string | null;
    logoUrl?: string | null;
  };
}

const statusConfig: Record<string, { label: string; color: string }> = {
  ENTWURF: { label: "Entwurf", color: "bg-gray-100 text-gray-700" },
  OFFEN: { label: "Offen", color: "bg-blue-100 text-blue-700" },
  BEZAHLT: { label: "Bezahlt", color: "bg-green-100 text-green-700" },
  STORNIERT: { label: "Storniert", color: "bg-red-100 text-red-700" },
};

const STATUS_OPTIONS = ["ALLE", "ENTWURF", "OFFEN", "BEZAHLT", "STORNIERT"];

export function RechnungenTable() {
  const [rechnungen, setRechnungen] = useState<Rechnung[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALLE");

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailRechnung, setEmailRechnung] = useState<Rechnung | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  const loadRechnungen = useCallback(async () => {
    try {
      const res = await fetch("/api/rechnungen");
      const data = await res.json();
      if (Array.isArray(data)) setRechnungen(data);
    } catch (error) {
      console.error("Laden Fehler:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRechnungen();
  }, [loadRechnungen]);

  const filtered = rechnungen.filter((r) => {
    const matchesSearch =
      !search ||
      r.kundeName.toLowerCase().includes(search.toLowerCase()) ||
      r.nummer.toLowerCase().includes(search.toLowerCase()) ||
      r.kundeEmail?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALLE" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/rechnungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        loadRechnungen();
        toast.success(`Status auf "${statusConfig[status]?.label}" gesetzt`);
      }
    } catch {
      toast.error("Fehler beim Status-Update");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handlePDF(rechnung: Rechnung) {
    try {
      const { generateRechnungPDF } = await import("@/lib/pdf");
      const blob = generateRechnungPDF({
        nummer: rechnung.nummer,
        datum: new Date(rechnung.datum),
        faelligAm: new Date(rechnung.faelligAm),
        kunde: {
          name: rechnung.kundeName,
          strasse: undefined,
          plz: undefined,
          ort: undefined,
        },
        firma: rechnung.firma || null,
        positionen: rechnung.positionen,
        netto: rechnung.netto,
        mwstSatz: rechnung.mwstSatz,
        mwstBetrag: rechnung.mwstBetrag,
        brutto: rechnung.brutto,
        einleitungsText: rechnung.einleitungsText,
        schlussText: rechnung.schlussText,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${rechnung.nummer}_${rechnung.kundeName.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Fehler beim PDF-Erstellen");
    }
  }

  async function handleDelete(rechnung: Rechnung) {
    if (!confirm(`Rechnung ${rechnung.nummer} wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/rechnungen/${rechnung.id}`, { method: "DELETE" });
      if (res.ok) {
        setRechnungen((prev) => prev.filter((r) => r.id !== rechnung.id));
        toast.success("Rechnung gelöscht");
      }
    } catch {
      toast.error("Fehler beim Löschen");
    }
  }

  function openEmailDialog(rechnung: Rechnung) {
    setEmailRechnung(rechnung);
    setEmailTo(rechnung.kundeEmail || "");
    setEmailDialogOpen(true);
  }

  async function handleSendEmail() {
    if (!emailRechnung || !emailTo) return;
    setEmailSending(true);
    try {
      const res = await fetch(`/api/rechnungen/${emailRechnung.id}/senden`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("E-Mail gesendet");
        setEmailDialogOpen(false);
        loadRechnungen();
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rechnungen.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 p-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          Noch keine Rechnungen erstellt
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Erstelle Rechnungen aus angenommenen Angeboten in der Mobile-App
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
          <p className="text-muted-foreground">Keine Rechnungen gefunden</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 text-sm">
                <th className="text-left px-4 py-3 font-medium">Nummer</th>
                <th className="text-left px-4 py-3 font-medium">Kunde</th>
                <th className="text-left px-4 py-3 font-medium">Datum</th>
                <th className="text-left px-4 py-3 font-medium">Fällig am</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Brutto</th>
                <th className="text-right px-4 py-3 font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const cfg = statusConfig[r.status] || statusConfig.ENTWURF;
                return (
                  <tr
                    key={r.id}
                    className="border-t hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-sm">{r.nummer}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{r.kundeName}</p>
                      {r.kundeEmail && (
                        <p className="text-xs text-muted-foreground">{r.kundeEmail}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(r.datum).toLocaleDateString("de-DE")}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(r.faelligAm).toLocaleDateString("de-DE")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${cfg.color} border-0 text-xs`}>
                        {cfg.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-medium">
                      {formatEuro(r.brutto)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="PDF herunterladen"
                          onClick={() => handlePDF(r)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Per E-Mail senden"
                          onClick={() => openEmailDialog(r)}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        {r.status === "OFFEN" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-700 border-green-200 hover:bg-green-50"
                              onClick={() => updateStatus(r.id, "BEZAHLT")}
                              disabled={updatingId === r.id}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              Bezahlt
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-700 border-red-200 hover:bg-red-50"
                              onClick={() => updateStatus(r.id, "STORNIERT")}
                              disabled={updatingId === r.id}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Storniert
                            </Button>
                          </>
                        )}
                        {r.status === "ENTWURF" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(r.id, "OFFEN")}
                            disabled={updatingId === r.id}
                          >
                            Freigeben
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Löschen"
                          onClick={() => handleDelete(r)}
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
              Rechnung per E-Mail senden
            </DialogTitle>
          </DialogHeader>
          {emailRechnung && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm font-medium">
                  {emailRechnung.nummer} — {emailRechnung.kundeName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatEuro(emailRechnung.brutto)} Brutto
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
                Die Rechnung wird als PDF-Anhang versendet. Bei Entwurf-Status wird
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
    </>
  );
}
