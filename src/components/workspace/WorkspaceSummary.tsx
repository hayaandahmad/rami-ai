import type { WorkspaceMetrics } from "@/utils/workspaceMetrics";
import { WorkspaceSummaryCard } from "./WorkspaceSummaryCard";

interface WorkspaceSummaryProps {
  metrics: WorkspaceMetrics;
}

const summaryItems: Array<{ key: keyof WorkspaceMetrics; label: string }> = [
  { key: "totalDocuments", label: "Total Documents" },
  { key: "inProgress", label: "In Progress" },
  { key: "needsClarification", label: "Needs Clarification" },
  { key: "draftsGenerated", label: "Drafts Generated" },
];

export function WorkspaceSummary({ metrics }: WorkspaceSummaryProps) {
  return (
    <section aria-labelledby="workspace-summary-heading">
      <h2 id="workspace-summary-heading" className="sr-only">
        Workspace summary
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryItems.map((item) => (
          <WorkspaceSummaryCard
            key={item.key}
            metricKey={item.key}
            label={item.label}
            value={metrics[item.key]}
          />
        ))}
      </div>
    </section>
  );
}
