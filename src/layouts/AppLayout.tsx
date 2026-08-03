import type { ReactNode } from "react";
import type { BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { AppShell } from "@/layouts/AppShell";

interface AppLayoutProps {
  breadcrumbs?: BreadcrumbItem[];
  children: ReactNode;
}

export function AppLayout({ breadcrumbs, children }: AppLayoutProps) {
  return <AppShell breadcrumbs={breadcrumbs}>{children}</AppShell>;
}
