"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Files, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  match: (pathname: string, view: string | null) => boolean;
}

const navItems: NavItem[] = [
  {
    label: "Dashboard / Workspace",
    href: "/workspace",
    icon: LayoutDashboard,
    match: (pathname, view) => pathname === "/workspace" && view !== "all",
  },
  {
    label: "My Documents",
    href: "/workspace?view=all",
    icon: Files,
    match: (pathname, view) => pathname === "/workspace" && view === "all",
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onNavigate?: () => void;
  id?: string;
  onToggleCollapse?: () => void;
  showCollapseControl?: boolean;
}

export function Sidebar({
  collapsed = false,
  onNavigate,
  id = 'sidebar-navigation',
  onToggleCollapse,
  showCollapseControl = false,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const collapseLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar';

  return (
    <aside
      id={id}
      aria-label="Main navigation"
      className={`sidebar-shell h-full border-r border-sidebar-border transition-panel ${
        collapsed ? "w-[var(--spacing-sidebar-collapsed)]" : "w-[var(--spacing-sidebar-expanded)]"
      }`}
    >
      <div aria-hidden="true" className="sidebar-gradient-layer" />
      <div className="sidebar-gradient-content">
      <div className={`border-b border-sidebar-border ${collapsed ? "px-2 py-3" : "px-4 py-4"}`}>
        <div
          className={`flex items-start gap-2 ${
            collapsed ? 'flex-col items-center' : 'justify-between'
          }`}
        >
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'min-w-0 flex-1'}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-sidebar-border bg-sidebar-accent text-sidebar-text-primary shadow-card">
              <Sparkles aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="text-card-title text-sidebar-text-primary">Rami</p>
                <p className="text-caption text-sidebar-text-secondary">Document Assistant</p>
              </div>
            ) : null}
          </div>

          {showCollapseControl && onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-expanded={!collapsed}
              aria-controls={id}
              aria-label={collapseLabel}
              title={collapseLabel}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-sidebar-text-secondary transition-hover hover:bg-sidebar-hover hover:text-sidebar-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sidebar-accent-bar"
            >
              {collapsed ? (
                <PanelLeftOpen aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <PanelLeftClose aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>
          ) : null}
        </div>
        {!collapsed ? (
          <p className="mt-3 inline-flex rounded-pill border border-sidebar-border bg-sidebar-hover px-2.5 py-1 text-caption font-medium text-sidebar-text-secondary">
            Demo Environment
          </p>
        ) : null}
      </div>

      <nav className={`flex-1 overflow-y-auto ${collapsed ? "px-2 py-4" : "px-3 py-5"}`}>
        <ul className="space-y-1.5">
          {!collapsed ? (
            <li className="px-3 pb-2">
              <p className="text-caption font-medium tracking-wide text-sidebar-text-muted uppercase">
                Navigation
              </p>
            </li>
          ) : null}
          {navItems.map((item) => {
            const isActive = item.match(pathname, view);
            const Icon = item.icon;
            const isMyDocuments = item.label === "My Documents";

            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  onClick={onNavigate}
                  className={`relative flex min-h-11 items-center rounded-control text-small transition-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sidebar-accent-bar ${
                    collapsed ? "justify-center px-2" : "gap-3 px-3"
                  } ${
                    isActive
                      ? "bg-sidebar-active font-semibold text-sidebar-text-primary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                      : "text-sidebar-text-secondary hover:bg-sidebar-hover hover:text-sidebar-text-primary"
                  } ${isMyDocuments && !isActive ? "hover:pl-3.5" : ""}`}
                >
                  {isActive ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 left-0 h-7 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-accent-bar"
                    />
                  ) : null}
                  <Icon
                    aria-hidden="true"
                    className={`h-5 w-5 shrink-0 transition-hover ${
                      isActive
                        ? "text-sidebar-text-primary"
                        : isMyDocuments
                          ? "text-sidebar-text-secondary group-hover:text-sidebar-text-primary"
                          : ""
                    }`}
                    strokeWidth={isActive ? 2 : 1.75}
                  />
                  {!collapsed ? (
                    <span className={isMyDocuments ? "tracking-tight" : ""}>{item.label}</span>
                  ) : null}
                  {collapsed ? <span className="sr-only">{item.label}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      </div>
    </aside>
  );
}
