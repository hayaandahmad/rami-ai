"use client";

import { useCallback, useState } from "react";
import type { SaveState } from "@/types/interview";

const MOCK_SAVE_DURATION_MS = 400;
const SAVED_VISIBLE_DURATION_MS = 2000;

/**
 * Simulates a save lifecycle for the demo interview.
 *
 * triggerSave(onSave) transitions: idle → saving → saved (or error).
 * The "saved" state is visible for SAVED_VISIBLE_DURATION_MS before
 * returning to idle automatically.
 *
 * onSave is expected to be synchronous; wrap async logic with care.
 */
export function useSaveStatus() {
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const triggerSave = useCallback((onSave: () => void): void => {
    setSaveState("saving");

    setTimeout(() => {
      try {
        onSave();
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), SAVED_VISIBLE_DURATION_MS);
      } catch {
        setSaveState("error");
      }
    }, MOCK_SAVE_DURATION_MS);
  }, []);

  const clearError = useCallback((): void => {
    setSaveState("idle");
  }, []);

  return { saveState, triggerSave, clearError };
}
