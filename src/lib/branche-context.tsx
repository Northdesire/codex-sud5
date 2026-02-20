"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Branche } from "@/lib/branche-config";

interface BrancheContextValue {
  branche: Branche | null;
  loading: boolean;
}

const BrancheContext = createContext<BrancheContextValue>({
  branche: null,
  loading: true,
});

export function BrancheProvider({ children }: { children: ReactNode }) {
  const [branche, setBranche] = useState<Branche | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/firma/branche")
      .then((r) => r.json())
      .then((data) => setBranche(data.branche || "MALER"))
      .catch(() => setBranche("MALER"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <BrancheContext.Provider value={{ branche, loading }}>
      {children}
    </BrancheContext.Provider>
  );
}

export function useBranche(): Branche {
  const { branche } = useContext(BrancheContext);
  return branche ?? "MALER";
}

export function useBrancheLoading(): boolean {
  const { loading } = useContext(BrancheContext);
  return loading;
}
