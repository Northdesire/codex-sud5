"use client";

import { useCallback, useEffect, useRef } from "react";
import { driver, DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HelpTourProps {
  steps: DriveStep[];
  autoStart?: boolean;
}

export function HelpTour({ steps, autoStart }: HelpTourProps) {
  const hasAutoStarted = useRef(false);

  const startTour = useCallback(() => {
    const d = driver({
      showProgress: true,
      animate: true,
      nextBtnText: "Weiter",
      prevBtnText: "Zurück",
      doneBtnText: "Fertig",
      progressText: "{{current}} von {{total}}",
      steps,
    });
    d.drive();
  }, [steps]);

  useEffect(() => {
    if (autoStart && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      const timer = setTimeout(startTour, 600);
      return () => clearTimeout(timer);
    }
  }, [autoStart, startTour]);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={startTour}
      title="Seite erklärt"
      className="h-8 w-8"
    >
      <HelpCircle className="h-4 w-4" />
    </Button>
  );
}
