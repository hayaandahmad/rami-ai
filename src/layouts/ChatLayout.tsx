/**
 * ChatLayout — full-height layout for the Rami conversational workspace.
 * Same sidebar as AppShell but main area has no padding — the chat fills it entirely.
 * This is intentional: the chat manages its own internal spacing.
 */

'use client';

import { Suspense, useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { useDesktopSidebarCollapsed } from '@/hooks/useDesktopSidebarCollapsed';
import { MobileNavigationDrawer } from '@/layouts/AppShell/MobileNavigationDrawer';
import { Sidebar } from '@/layouts/AppShell/Sidebar';
import { SidebarFallback } from '@/layouts/AppShell/SidebarFallback';
import { UserIdentity } from '@/components/ui/UserIdentity';

interface ChatLayoutProps {
  children: ReactNode;
}

export function ChatLayout({ children }: ChatLayoutProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { collapsed: desktopCollapsed, toggle: toggleDesktopSidebar, ready } =
    useDesktopSidebarCollapsed();

  const desktopSidebarWidth = desktopCollapsed
    ? 'var(--spacing-sidebar-collapsed)'
    : 'var(--spacing-sidebar-expanded)';

  return (
    <div className="h-screen overflow-hidden bg-page-background">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <div className="flex h-screen overflow-hidden">
        <div
          className="hidden h-screen shrink-0 overflow-hidden transition-[width] duration-200 ease-out lg:block"
          style={{
            width: ready ? desktopSidebarWidth : 'var(--spacing-sidebar-expanded)',
          }}
        >
          <Suspense fallback={<SidebarFallback collapsed={desktopCollapsed} />}>
            <Sidebar
              collapsed={desktopCollapsed}
              onToggleCollapse={toggleDesktopSidebar}
              showCollapseControl
            />
          </Suspense>
        </div>

        <div className="hidden h-screen shrink-0 overflow-hidden md:block md:w-[var(--spacing-sidebar-collapsed)] lg:hidden">
          <Suspense fallback={<SidebarFallback collapsed />}>
            <Sidebar collapsed id="sidebar-navigation" />
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

          <main
            id="main-content"
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
