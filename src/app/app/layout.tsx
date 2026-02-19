"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Brain, FileText, FileSpreadsheet, BarChart3, Receipt } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
}

const baseNavItems: NavItem[] = [
  { href: "/app", icon: Home, label: "Start" },
  { href: "/app/ai", icon: Brain, label: "AI-Eingabe" },
  { href: "/app/formular", icon: FileText, label: "Formular" },
  { href: "/app/angebot", icon: FileSpreadsheet, label: "Angebot" },
  { href: "/app/uebersicht", icon: BarChart3, label: "Übersicht" },
];

const shopNavItems: NavItem[] = [
  { href: "/app", icon: Home, label: "Start" },
  { href: "/app/ai", icon: Brain, label: "AI-Eingabe" },
  { href: "/app/rechnungen", icon: Receipt, label: "Rechnungen" },
  { href: "/app/angebot", icon: FileSpreadsheet, label: "Angebot" },
  { href: "/app/uebersicht", icon: BarChart3, label: "Übersicht" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [branche, setBranche] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/firma/branche")
      .then((res) => res.json())
      .then((data) => setBranche(data.branche || "MALER"))
      .catch(() => setBranche("MALER"));
  }, []);

  const navItems = branche === "SHOP" ? shopNavItems : baseNavItems;

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto bg-background">
      <main className="flex-1 overflow-y-auto pb-20">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-sm safe-area-bottom">
        <div className="max-w-lg mx-auto flex justify-around py-2 px-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/app" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[56px]",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
