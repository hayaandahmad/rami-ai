"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveState } from "@/types/interview";

const SAVED_VISIBLE_DURATION_MS = 2000;

/**
 * Drives the real async save lifecycle for the interview.
 *
 * triggerSave(save) awaits `save` (expected to perform the actual
 * persistence request) and transitions: idle -> saving -> saved | error.
 *
 * "saved" is visible for SAVED_VISIBLE_DURATION_MS before returning to
 * idle automatically — this is purely a display timing, not a mock
 * save duration. "error" persists until clearError() is called (e.g.
 * via the existing "Try again" action), so a failed save stays visibly
 * failed until the user retries.
 *
 * Returns whether the save succeeded, so callers can decide whether to
 * advance the interview.
 */
export function useSaveStatus() {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  const triggerSave = useCallback(
    async (save: () => Promise<void>): Promise<boolean> => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
        savedTimeoutRef.current = null;
      }

      setSaveState("saving");

      try {
        await save();
        setSaveState("saved");
        savedTimeoutRef.current = setTimeout(() => {
          setSaveState("idle");
        }, SAVED_VISIBLE_DURATION_MS);
        return true;
      } catch {
        setSaveState("error");
        return false;
      }
    },
    [],
  );

  const clearError = useCallback((): void => {
    setSaveState("idle");
  }, []);

  return { saveState, triggerSave, clearError };
}
