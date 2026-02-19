"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { BRANCHE_CONFIG, type Branche, type SidebarItem } from "@/lib/branche-config";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [navItems, setNavItems] = useState<SidebarItem[]>(BRANCHE_CONFIG.MALER.sidebarItems);
  const [beschreibung, setBeschreibung] = useState("Malerbetrieb-Software");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/firma/branche")
      .then((r) => r.json())
      .then((data) => {
        const branche: Branche = data.branche || "MALER";
        const config = BRANCHE_CONFIG[branche];
        if (config) {
          setNavItems(config.sidebarItems);
          setBeschreibung(config.beschreibung);
        }
      })
      .catch(() => {
        // Fallback: MALER config already set
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Abgemeldet");
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
          AI
        </div>
        <div>
          <h1 className="text-lg font-bold text-sidebar-foreground leading-none">
            AIngebot
          </h1>
          <p className="text-xs text-muted-foreground">{beschreibung}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                {item.label}
              </Link>
            );
          })
        )}
      </nav>

      {/* Logout */}
      <div className="border-t p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Abmelden
        </Button>
      </div>
    </aside>
  );
}
