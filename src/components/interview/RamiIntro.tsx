"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const INTRO_TEXT =
  "I'll guide you through a structured interview and organize your answers into the document as we continue.";

const TYPING_SPEED_MS = 22;

interface RamiIntroProps {
  /** Called once when the typing animation finishes. */
  onComplete?: () => void;
}

export function RamiIntro({ onComplete }: RamiIntroProps) {
  const reducedMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState(reducedMotion ? INTRO_TEXT : "");
  const [done, setDone] = useState(reducedMotion);
  const completedRef = useRef(false);

  useEffect(() => {
    if (reducedMotion) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
      return;
    }

    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(INTRO_TEXT.slice(0, i));
      if (i >= INTRO_TEXT.length) {
        clearInterval(interval);
        setDone(true);
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
      }
    }, TYPING_SPEED_MS);

    return () => clearInterval(interval);
    // Run only once on mount — reducedMotion is read once via the hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-control border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] px-4 py-3.5">
      {/* Screen reader sees the full text immediately */}
      <p className="sr-only">{INTRO_TEXT}</p>

      <p
        aria-hidden="true"
        className="text-small leading-relaxed text-[var(--color-primary-800)]"
      >
        {displayed}
        {!done ? (
          <span className="intro-cursor" aria-hidden="true">
            |
          </span>
        ) : null}
      </p>
    </div>
  );
}
