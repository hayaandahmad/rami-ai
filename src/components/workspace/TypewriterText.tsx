"use client";

import { useEffect, useState } from "react";

export const HERO_TYPEWRITER_LINE_1 =
  "Rami guides you through structured interviews, captures requirements carefully, and prepares professional first drafts — without starting from a blank page.";

export const HERO_ROTATING_MESSAGES = [
  "Building RFP structures...",
  "Reviewing project requirements...",
  "Organizing captured information...",
  "Preparing professional first drafts...",
  "Ready to guide you step by step...",
] as const;

export const HERO_STATIC_SECONDARY_MESSAGE = HERO_ROTATING_MESSAGES[4];

const LINE_1_BASE_MS = 20;
const LINE_2_TYPE_BASE_MS = 52;
const LINE_2_DELETE_BASE_MS = 26;
const LINE_2_PAUSE_MS = 1600;
const ACCENT_START_REM = 1.125;

type Line1Phase = "typing" | "complete";
type Line2Phase = "waiting" | "typing" | "pause" | "deleting";

function getTypingDelay(
  char: string,
  baseMs: number,
  mode: "type" | "delete",
): number {
  if (mode === "delete") {
    if (char === " ") return baseMs * 0.5;
    if (char === ".") return baseMs * 1.15;
    return baseMs;
  }

  if (char === " ") return baseMs * 0.45;
  if (char === ",") return baseMs * 2.2;
  if (char === ".") return baseMs * 2.8;
  if (char === "—") return baseMs * 2.4;
  if (char === ";") return baseMs * 2;
  return baseMs;
}

function getAccentHeight(
  reducedMotion: boolean,
  line1Phase: Line1Phase,
  line1Text: string,
): string {
  if (reducedMotion || line1Phase === "complete") {
    return "100%";
  }

  const progress = Math.min(line1Text.length / HERO_TYPEWRITER_LINE_1.length, 1);
  return `calc(${ACCENT_START_REM}rem + ${progress} * (100% - ${ACCENT_START_REM}rem))`;
}

interface TypewriterTextProps {
  className?: string;
}

export function TypewriterText({ className = "" }: TypewriterTextProps) {
  const [line1Text, setLine1Text] = useState("");
  const [line1Phase, setLine1Phase] = useState<Line1Phase>("typing");
  const [line2Text, setLine2Text] = useState("");
  const [line2Phase, setLine2Phase] = useState<Line2Phase>("waiting");
  const [messageIndex, setMessageIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const currentMessage = HERO_ROTATING_MESSAGES[messageIndex];
  const isSecondaryVisible = reducedMotion || line1Phase === "complete";
  const accentHeight = getAccentHeight(reducedMotion, line1Phase, line1Text);
  const isAccentComplete = reducedMotion || line1Phase === "complete";

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setLine1Text(HERO_TYPEWRITER_LINE_1);
      setLine1Phase("complete");
      setLine2Text(HERO_STATIC_SECONDARY_MESSAGE);
      setLine2Phase("pause");
      return;
    }

    if (line1Phase === "typing") {
      if (line1Text.length >= HERO_TYPEWRITER_LINE_1.length) {
        setLine1Phase("complete");
        setLine2Phase("typing");
        return;
      }

      const nextChar = HERO_TYPEWRITER_LINE_1[line1Text.length];
      const delay = getTypingDelay(nextChar, LINE_1_BASE_MS, "type");

      const timeout = window.setTimeout(() => {
        setLine1Text(HERO_TYPEWRITER_LINE_1.slice(0, line1Text.length + 1));
      }, delay);

      return () => window.clearTimeout(timeout);
    }

    return undefined;
  }, [line1Phase, line1Text, reducedMotion]);

  useEffect(() => {
    if (reducedMotion || line1Phase !== "complete") {
      return;
    }

    if (line2Phase === "typing") {
      if (line2Text.length >= currentMessage.length) {
        setLine2Phase("pause");
        return;
      }

      const nextChar = currentMessage[line2Text.length];
      const delay = getTypingDelay(nextChar, LINE_2_TYPE_BASE_MS, "type");

      const timeout = window.setTimeout(() => {
        setLine2Text(currentMessage.slice(0, line2Text.length + 1));
      }, delay);

      return () => window.clearTimeout(timeout);
    }

    if (line2Phase === "pause") {
      const timeout = window.setTimeout(() => {
        setLine2Phase("deleting");
      }, LINE_2_PAUSE_MS);

      return () => window.clearTimeout(timeout);
    }

    if (line2Phase === "deleting") {
      if (line2Text.length === 0) {
        setMessageIndex((index) => (index + 1) % HERO_ROTATING_MESSAGES.length);
        setLine2Phase("typing");
        return;
      }

      const removedChar = line2Text[line2Text.length - 1];
      const delay = getTypingDelay(removedChar, LINE_2_DELETE_BASE_MS, "delete");

      const timeout = window.setTimeout(() => {
        setLine2Text(line2Text.slice(0, -1));
      }, delay);

      return () => window.clearTimeout(timeout);
    }

    return undefined;
  }, [currentMessage, line1Phase, line2Phase, line2Text, reducedMotion]);

  const showLine1Cursor = !reducedMotion && line1Phase === "typing";
  const showLine2Cursor =
    !reducedMotion &&
    line1Phase === "complete" &&
    (line2Phase === "typing" || line2Phase === "deleting");

  return (
    <div className={`typewriter-display min-h-[7.5rem] md:min-h-[6.75rem] ${className}`}>
      {!reducedMotion ? (
        <p className="sr-only">
          {HERO_TYPEWRITER_LINE_1} {HERO_ROTATING_MESSAGES.join(" ")}
        </p>
      ) : null}

      <div className="typewriter-display__content space-y-2">
        <div
          aria-hidden="true"
          className={`typewriter-display__accent ${
            isAccentComplete ? "typewriter-display__accent--complete" : ""
          }`}
          style={{ height: accentHeight }}
        />

        <p
          className="text-body leading-relaxed text-text-secondary"
          aria-hidden={reducedMotion ? undefined : true}
        >
          <span>{line1Text}</span>
          {showLine1Cursor ? (
            <span className="typewriter-cursor animate-cursor-soft" aria-hidden="true">
              ▌
            </span>
          ) : null}
        </p>

        <div className="typewriter-display__secondary-slot" aria-hidden={!isSecondaryVisible}>
          <div
            className={`typewriter-display__secondary ${
              isSecondaryVisible ? "typewriter-display__secondary--visible" : ""
            }`}
            aria-live={reducedMotion ? undefined : "polite"}
            aria-atomic="true"
          >
            {isSecondaryVisible ? (
              <p className="truncate text-body font-medium tracking-[0.01em] text-[var(--color-primary-800)]">
                <span>{line2Text}</span>
                {showLine2Cursor ? (
                  <span className="typewriter-cursor animate-cursor-soft" aria-hidden="true">
                    ▌
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
