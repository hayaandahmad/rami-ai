import { Card } from "@/components/ui/Card";
import type { WorkspaceMetrics } from "@/utils/workspaceMetrics";
import {
  SUMMARY_METRIC_ICONS,
  SUMMARY_METRIC_TINTS,
} from "./visualTokens";

interface WorkspaceSummaryCardProps {
  label: string;
  value: number;
  metricKey: keyof WorkspaceMetrics;
}

export function WorkspaceSummaryCard({
  label,
  value,
  metricKey,
}: WorkspaceSummaryCardProps) {
  const Icon = SUMMARY_METRIC_ICONS[metricKey];
  const tint = SUMMARY_METRIC_TINTS[metricKey];

  return (
    <Card interactive tinted className="group border-[var(--color-primary-100)] bg-summary-card-surface p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-caption font-medium tracking-wide text-text-muted uppercase">
            {label}
          </p>
          <p className="text-[1.75rem] font-bold leading-none text-text-primary">{value}</p>
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control-sm transition-elevate group-hover:scale-105 ${tint}`}
        >
          <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
        </div>
      </div>
    </Card>
  );
}
