interface SidebarFallbackProps {
  collapsed?: boolean;
}

export function SidebarFallback({ collapsed = false }: SidebarFallbackProps) {
  return (
    <aside
      aria-hidden="true"
      className={`sidebar-shell flex h-full flex-col border-r border-sidebar-border ${
        collapsed ? "w-[var(--spacing-sidebar-collapsed)]" : "w-[var(--spacing-sidebar-expanded)]"
      }`}
    />
  );
}
