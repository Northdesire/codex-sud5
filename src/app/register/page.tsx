"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      firmenname: formData.get("firmenname") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    // 1. Supabase Auth User erstellen
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (authError) {
      toast.error("Registrierung fehlgeschlagen", { description: authError.message });
      setLoading(false);
      return;
    }

    // 2. Firma + User in unserer DB erstellen
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error("Fehler beim Erstellen der Firma", { description: err.error });
      setLoading(false);
      return;
    }

    toast.success("Willkommen bei AIngebot!", {
      description: "Dein Konto wurde erfolgreich erstellt.",
    });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl">
            AI
          </div>
          <CardTitle className="text-2xl">Konto erstellen</CardTitle>
          <CardDescription>
            Starte jetzt mit intelligenten Angeboten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Dein Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Thomas Schneider"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firmenname">Firmenname</Label>
              <Input
                id="firmenname"
                name="firmenname"
                placeholder="Malerbetrieb Schneider"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="info@maler-schneider.de"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Mindestens 6 Zeichen"
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Wird erstellt..." : "Kostenlos registrieren"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Bereits ein Konto?{" "}
            <Link href="/login" className="text-primary underline">
              Anmelden
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
