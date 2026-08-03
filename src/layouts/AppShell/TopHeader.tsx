import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { UserIdentity } from "@/components/ui/UserIdentity";

interface TopHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
}

export function TopHeader({ breadcrumbs = [] }: TopHeaderProps) {
  return (
    <header className="flex h-header shrink-0 items-center gap-4 border-b border-border bg-surface px-4 md:px-6 lg:px-8">
      <div className="min-w-0 flex-1">
        {breadcrumbs.length > 0 ? (
          <Breadcrumbs items={breadcrumbs} />
        ) : (
          <span className="text-small text-text-muted">Rami Document Assistant</span>
        )}
      </div>
      <UserIdentity />
    </header>
  );
}
