"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface AccordionItem {
  id: string;
  trigger: ReactNode;
  content: ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  defaultOpenId?: string;
  className?: string;
}

export function Accordion({ items, defaultOpenId, className = "" }: AccordionProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? null);

  return (
    <div className={`divide-y divide-border rounded-card border border-border ${className}`}>
      {items.map((item) => {
        const isOpen = openId === item.id;
        const triggerId = `accordion-trigger-${item.id}`;
        const panelId = `accordion-panel-${item.id}`;

        return (
          <div key={item.id}>
            <button
              id={triggerId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-small font-medium text-text-primary transition-hover hover:bg-surface-subtle"
            >
              <span>{item.trigger}</span>
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 text-text-muted transition-panel ${isOpen ? "rotate-180" : ""}`}
                strokeWidth={1.75}
              />
            </button>

            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              hidden={!isOpen}
            >
              <div className="px-4 pb-4 pt-1">{item.content}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
