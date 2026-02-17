"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App Fehler:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Etwas ging schief</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {error.message || "Ein Fehler ist aufgetreten."}
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" size="sm" onClick={() => window.location.href = "/app"}>
            <Home className="h-4 w-4 mr-1" />
            Start
          </Button>
          <Button size="sm" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Nochmal
          </Button>
        </div>
      </div>
    </div>
  );
}
