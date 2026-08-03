"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DocumentFilterBar } from "@/components/workspace/DocumentFilterBar";
import { DocumentGrid } from "@/components/workspace/DocumentGrid";
import { DocumentSearchField } from "@/components/workspace/DocumentSearchField";
import { DocumentTypeGrid } from "@/components/workspace/DocumentTypeGrid";
import { RecentDocumentsPanel } from "@/components/workspace/RecentDocumentsPanel";
import { WorkspaceHero } from "@/components/workspace/WorkspaceHero";
import { WorkspaceSummary } from "@/components/workspace/WorkspaceSummary";
import { DOCUMENT_TYPE_LABELS } from "@/data/documentTypes";
import { useDocumentStore } from "@/hooks/useDocumentStore";
import { useWorkspaceFilters } from "@/hooks/useWorkspaceFilters";
import { deriveWorkspaceMetrics, matchesWorkspaceFilter } from "@/utils/workspaceMetrics";

function matchesSearchQuery(
  title: string,
  beneficiary: string,
  documentTypeLabel: string,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [title, beneficiary, documentTypeLabel].some((value) =>
    value.toLowerCase().includes(normalizedQuery),
  );
}

function DocumentWorkspaceContent() {
  const { documents } = useDocumentStore();
  const { filter, setFilter, clearFilter } = useWorkspaceFilters();
  const [searchQuery, setSearchQuery] = useState("");

  const metrics = useMemo(() => deriveWorkspaceMetrics(documents), [documents]);

  const continueDocument = useMemo(
    () =>
      documents.find((document) => document.nextAction === "continue-interview") ??
      documents[0],
    [documents],
  );

  const filteredDocuments = useMemo(
    () =>
      documents.filter((document) => {
        if (!matchesWorkspaceFilter(document, filter)) {
          return false;
        }

        return matchesSearchQuery(
          document.title,
          document.beneficiary,
          DOCUMENT_TYPE_LABELS[document.documentType],
          searchQuery,
        );
      }),
    [documents, filter, searchQuery],
  );

  function handleClearFilters() {
    clearFilter();
    setSearchQuery("");
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <WorkspaceHero continueDocument={continueDocument} />

      <WorkspaceSummary metrics={metrics} />

      <DocumentTypeGrid />

      <RecentDocumentsPanel
        searchField={
          <DocumentSearchField value={searchQuery} onChange={setSearchQuery} />
        }
        filterBar={
          <DocumentFilterBar activeFilter={filter} onFilterChange={setFilter} />
        }
      >
        {filteredDocuments.length > 0 ? (
          <DocumentGrid documents={filteredDocuments} />
        ) : (
          <EmptyState
            title="No documents match this view"
            description="Try adjusting your search or filter to find the document you need."
            secondaryAction={
              <Button variant="secondary" onClick={handleClearFilters}>
                Clear filters
              </Button>
            }
            primaryAction={
              <Link href="/documents/new">
                <Button>Create New Document</Button>
              </Link>
            }
          />
        )}
      </RecentDocumentsPanel>
    </div>
  );
}

function DocumentWorkspaceFallback() {
  return (
    <div className="space-y-8">
      <div className="rounded-panel border border-border bg-hero-surface p-8 shadow-card">
        <p className="text-page-title text-text-primary">Document Workspace</p>
        <p className="mt-2 text-body text-text-muted">Loading workspace...</p>
      </div>
    </div>
  );
}

export function DocumentWorkspacePage() {
  return (
    <Suspense fallback={<DocumentWorkspaceFallback />}>
      <DocumentWorkspaceContent />
    </Suspense>
  );
}
