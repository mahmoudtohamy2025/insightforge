import { useState, useCallback } from "react";

const TOUR_PREFIX = "tour_completed_";

export function useTour(tourId: string) {
  const storageKey = `${TOUR_PREFIX}${tourId}`;

  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const isComplete = useCallback(() => {
    return localStorage.getItem(storageKey) === "true";
  }, [storageKey]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const completeTour = useCallback(() => {
    localStorage.setItem(storageKey, "true");
    setIsActive(false);
    setCurrentStep(0);
  }, [storageKey]);

  const dismissTour = useCallback(() => {
    localStorage.setItem(storageKey, "true");
    setIsActive(false);
    setCurrentStep(0);
  }, [storageKey]);

  const nextStep = useCallback((totalSteps: number) => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      completeTour();
    }
  }, [currentStep, completeTour]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(storageKey);
    setCurrentStep(0);
    setIsActive(false);
  }, [storageKey]);

  return {
    isActive,
    currentStep,
    isComplete,
    startTour,
    completeTour,
    dismissTour,
    nextStep,
    prevStep,
    resetTour,
  };
}
