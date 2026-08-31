"use client";

import Link from "next/link";
import { ArrowRight, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { DocumentProject } from "@/types/document";
import { getDocumentActionHref } from "@/utils/documentNavigation";
import { HeroAIBackground } from "./HeroAIBackground";
import { StatusPulseDot } from "./StatusPulseDot";
import { TypewriterText } from "./TypewriterText";

interface WorkspaceHeroProps {
  continueDocument?: DocumentProject;
  loading?: boolean;
}

export function WorkspaceHero({ continueDocument, loading }: WorkspaceHeroProps) {
  const canContinue = Boolean(continueDocument);
  const continueHref = continueDocument
    ? getDocumentActionHref(continueDocument.id, continueDocument.nextAction)
    : "/workspace";

  return (
    <section
      aria-labelledby="workspace-hero-heading"
      className="relative overflow-hidden rounded-panel border border-[var(--color-primary-100)] bg-hero-surface p-6 shadow-card md:p-8"
    >
      <HeroAIBackground />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-pill border border-[var(--color-primary-100)] bg-surface/90 px-3 py-1.5 text-caption font-medium text-action-primary backdrop-blur-sm">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Rami — AI Document Assistant</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-pill bg-[var(--color-success-100)]/95 px-2.5 py-1 text-caption font-medium text-[var(--color-success-700)] backdrop-blur-sm">
              <StatusPulseDot />
              Structured RFP analysis
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-small font-medium text-text-muted">Welcome back</p>
            <h1 id="workspace-hero-heading" className="text-page-title text-text-primary">
              Document Workspace
            </h1>
          </div>

          <TypewriterText />
        </div>

        <div className="flex w-full shrink-0 flex-col gap-3 md:w-auto md:flex-row md:items-stretch lg:pt-1">
          <Link href="/documents/new" className="w-full md:w-auto">
            <Button
              className="h-11 w-full whitespace-nowrap px-5 transition-elevate hover-elevate md:min-w-[12.5rem]"
              aria-label="Create New Document"
            >
              <Plus aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              Create New Document
            </Button>
          </Link>
          {canContinue ? (
            <Link href={continueHref} className="w-full md:w-auto">
              <Button
                variant="secondary"
                className="h-11 w-full whitespace-nowrap px-5 transition-elevate hover-elevate md:min-w-[12.5rem]"
                aria-label={`Continue working on ${continueDocument?.title ?? "recent project"}`}
              >
                Continue Working
                <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              </Button>
            </Link>
          ) : (
            <Button
              variant="secondary"
              className="h-11 w-full whitespace-nowrap px-5 md:min-w-[12.5rem]"
              disabled
              aria-disabled
              aria-label="Continue Working — no active project yet"
            >
              Continue Working
              <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="relative z-10 mt-4 text-caption text-text-muted">Loading projects…</p>
      ) : null}
    </section>
  );
}
