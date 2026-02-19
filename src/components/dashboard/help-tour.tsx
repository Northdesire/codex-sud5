"use client";

import { useCallback } from "react";
import { driver, DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HelpTourProps {
  steps: DriveStep[];
}

export function HelpTour({ steps }: HelpTourProps) {
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
