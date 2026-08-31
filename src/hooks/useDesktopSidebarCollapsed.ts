'use client';

import { useCallback, useEffect, useState } from 'react';

export const SIDEBAR_COLLAPSED_KEY = 'rami-sidebar-collapsed-v1';

export function useDesktopSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (raw === '1') setCollapsed(true);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const setCollapsedPersisted = useCallback((value: boolean) => {
    setCollapsed(value);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  return { collapsed, toggle, setCollapsed: setCollapsedPersisted, ready };
}
