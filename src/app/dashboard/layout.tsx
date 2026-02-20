"use client";

import { Sidebar } from "@/components/dashboard/sidebar";
import { ErrorBoundary } from "@/components/error-boundary";
import { BrancheProvider } from "@/lib/branche-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BrancheProvider>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </BrancheProvider>
  );
}
