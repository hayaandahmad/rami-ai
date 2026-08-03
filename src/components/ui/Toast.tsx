"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

export type ToastVariant = "success" | "error" | "info" | "warning";

interface ToastProps {
  message: ReactNode;
  variant?: ToastVariant;
  onDismiss?: () => void;
}

const variantStyles: Record<ToastVariant, string> = {
  success:
    "border-[var(--color-success-100)] bg-[var(--color-success-100)] text-[var(--color-success-700)]",
  error:
    "border-[var(--color-error-100)] bg-[var(--color-error-100)] text-[var(--color-error-700)]",
  info: "border-[var(--color-info-100)] bg-[var(--color-info-100)] text-[var(--color-info-700)]",
  warning:
    "border-[var(--color-warning-100)] bg-[var(--color-warning-100)] text-[var(--color-warning-700)]",
};

export function Toast({ message, variant = "info", onDismiss }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-card border px-4 py-3 text-small shadow-card-elevated ${variantStyles[variant]}`}
    >
      <span className="flex-1">{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 opacity-70 hover:opacity-100"
        >
          <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}
