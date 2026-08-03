"use client";

import { Suspense, useState, type ReactNode } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { UserIdentity } from "@/components/ui/UserIdentity";
import { MobileNavigationDrawer } from "./MobileNavigationDrawer";
import { Sidebar } from "./Sidebar";
import { SidebarFallback } from "./SidebarFallback";
import { TopHeader } from "./TopHeader";

interface AppShellProps {
  breadcrumbs?: BreadcrumbItem[];
  children: ReactNode;
}

export function AppShell({ breadcrumbs = [], children }: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isTabletSidebarCollapsed, setIsTabletSidebarCollapsed] = useState(false);

  const tabletSidebarWidth = isTabletSidebarCollapsed
    ? "var(--spacing-sidebar-collapsed)"
    : "var(--spacing-sidebar-expanded)";

  return (
    <div className="h-screen overflow-hidden bg-page-background">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <div className="flex h-screen overflow-hidden">
        <div className="hidden h-screen shrink-0 overflow-hidden lg:block lg:w-[var(--spacing-sidebar-expanded)]">
          <Suspense fallback={<SidebarFallback collapsed={false} />}>
            <Sidebar collapsed={false} />
          </Suspense>
        </div>

        <div
          className="hidden h-screen shrink-0 overflow-hidden md:block lg:hidden"
          style={{ width: tabletSidebarWidth }}
        >
          <Suspense fallback={<SidebarFallback collapsed={isTabletSidebarCollapsed} />}>
            <Sidebar collapsed={isTabletSidebarCollapsed} id="sidebar-navigation" />
          </Suspense>
        </div>

        <MobileNavigationDrawer
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 md:hidden">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-expanded={isMobileNavOpen}
                aria-controls="mobile-navigation"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-border text-text-primary transition-hover hover:bg-surface-subtle"
                onClick={() => setIsMobileNavOpen((open) => !open)}
              >
                <Menu aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
                <span className="sr-only">Open navigation menu</span>
              </button>
              <span className="text-card-title text-text-primary">Rami</span>
            </div>
            <UserIdentity compact />
          </div>

          <div className="hidden shrink-0 items-center justify-end border-b border-border bg-surface px-4 py-2 md:flex lg:hidden">
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-2 rounded-control px-3 text-small text-text-secondary transition-hover hover:bg-surface-subtle"
              onClick={() => setIsTabletSidebarCollapsed((collapsed) => !collapsed)}
              aria-expanded={!isTabletSidebarCollapsed}
              aria-controls="sidebar-navigation"
            >
              {isTabletSidebarCollapsed ? (
                <PanelLeftOpen aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
              ) : (
                <PanelLeftClose aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
              )}
              {isTabletSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            </button>
          </div>

          <TopHeader breadcrumbs={breadcrumbs} />

          <main id="main-content" className="flex-1 overflow-y-auto px-4 py-6 md:px-6 md:py-8 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
