"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Loader2,
  FileText,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
} from "lucide-react";
import { formatEuro } from "@/lib/kalkulation";

interface KundeAngebot {
  id: string;
  nummer: string;
  datum: string;
  status: string;
  brutto: number;
}

interface KundeDetail {
  id: string;
  name: string;
  typ: string;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  email: string | null;
  telefon: string | null;
  notizen: string | null;
  angebote: KundeAngebot[];
}

const statusConfig: Record<string, { label: string; color: string }> = {
  ENTWURF: { label: "Entwurf", color: "bg-gray-100 text-gray-700" },
  OFFEN: { label: "Offen", color: "bg-blue-100 text-blue-700" },
  ANGENOMMEN: { label: "Angenommen", color: "bg-green-100 text-green-700" },
  ABGELEHNT: { label: "Abgelehnt", color: "bg-red-100 text-red-700" },
  ABGELAUFEN: { label: "Abgelaufen", color: "bg-yellow-100 text-yellow-700" },
};

const KundenTypLabels: Record<string, string> = {
  PRIVAT: "Privat",
  GEWERBE: "Gewerbe",
  HAUSVERWALTUNG: "Hausverwaltung",
};

export default function KundeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [kunde, setKunde] = useState<KundeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    fetch(`/api/kunden/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setKunde(data);
        setForm({
          name: data.name,
          typ: data.typ,
          strasse: data.strasse || "",
          plz: data.plz || "",
          ort: data.ort || "",
          email: data.email || "",
          telefon: data.telefon || "",
          notizen: data.notizen || "",
        });
      })
      .catch(() => {
        toast.error("Kunde nicht gefunden");
        router.push("/dashboard/kunden");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/kunden/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Kunde aktualisiert");
        const updated = await res.json();
        setKunde((prev) => prev ? { ...prev, ...updated } : prev);
      } else {
        toast.error("Fehler beim Speichern");
      }
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Kunde" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!kunde) return null;

  const angenommen = kunde.angebote.filter((a) => a.status === "ANGENOMMEN");
  const umsatz = angenommen.reduce((s, a) => s + a.brutto, 0);

  return (
    <>
      <Header
        title={kunde.name}
        description={`${KundenTypLabels[kunde.typ] || kunde.typ} — ${kunde.angebote.length} Angebote`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/kunden")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Zurück
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Speichern
            </Button>
          </div>
        }
      />
      <div className="p-8 max-w-5xl space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kunde.angebote.length}</p>
                  <p className="text-xs text-muted-foreground">Angebote</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{angenommen.length}</p>
                  <p className="text-xs text-muted-foreground">Angenommen</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-emerald-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatEuro(umsatz)}</p>
                  <p className="text-xs text-muted-foreground">Umsatz</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Kontakt bearbeiten */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kontaktdaten</CardTitle>
              <CardDescription>Stammdaten bearbeiten</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Typ</Label>
                <select
                  className="w-full h-9 rounded-md border px-3 text-sm"
                  value={form.typ}
                  onChange={(e) => setForm({ ...form, typ: e.target.value })}
                >
                  <option value="PRIVAT">Privat</option>
                  <option value="GEWERBE">Gewerbe</option>
                  <option value="HAUSVERWALTUNG">Hausverwaltung</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Mail className="h-3 w-3" /> E-Mail
                  </Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Telefon
                  </Label>
                  <Input
                    value={form.telefon}
                    onChange={(e) => setForm({ ...form, telefon: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Adresse
                </Label>
                <Input
                  value={form.strasse}
                  onChange={(e) => setForm({ ...form, strasse: e.target.value })}
                  placeholder="Straße"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={form.plz}
                  onChange={(e) => setForm({ ...form, plz: e.target.value })}
                  placeholder="PLZ"
                />
                <Input
                  className="col-span-2"
                  value={form.ort}
                  onChange={(e) => setForm({ ...form, ort: e.target.value })}
                  placeholder="Ort"
                />
              </div>
            </CardContent>
          </Card>

          {/* Angebote */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Angebote</CardTitle>
              <CardDescription>
                {kunde.angebote.length} Angebote für diesen Kunden
              </CardDescription>
            </CardHeader>
            <CardContent>
              {kunde.angebote.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Noch keine Angebote
                </p>
              ) : (
                <div className="space-y-2">
                  {kunde.angebote.map((a) => {
                    const cfg = statusConfig[a.status] || statusConfig.ENTWURF;
                    return (
                      <Link
                        key={a.id}
                        href="/dashboard/angebote"
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium font-mono">
                            {a.nummer}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(a.datum).toLocaleDateString("de-DE")}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={`${cfg.color} border-0 text-xs`}>
                            {cfg.label}
                          </Badge>
                          <span className="text-sm font-mono font-medium">
                            {formatEuro(a.brutto)}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
