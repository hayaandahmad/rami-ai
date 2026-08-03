"use client";

import { Suspense } from "react";
import { Sidebar } from "./Sidebar";
import { SidebarFallback } from "./SidebarFallback";

interface MobileNavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNavigationDrawer({
  isOpen,
  onClose,
}: MobileNavigationDrawerProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <button
        type="button"
        aria-label="Close navigation menu"
        className="absolute inset-0 bg-black/40 transition-drawer"
        onClick={onClose}
      />
      <div
        id="mobile-navigation"
        className="relative z-50 h-full w-[min(100vw-2rem,16rem)] shadow-modal transition-drawer"
      >
        <Suspense fallback={<SidebarFallback collapsed={false} />}>
          <Sidebar collapsed={false} onNavigate={onClose} />
        </Suspense>
      </div>
    </div>
  );
}
