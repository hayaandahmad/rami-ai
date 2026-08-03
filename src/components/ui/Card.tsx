import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
  tinted?: boolean;
}

export function Card({
  children,
  interactive = false,
  tinted = false,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-card border p-5 shadow-card md:p-6 ${
        tinted
          ? "border-[var(--color-primary-100)] bg-[var(--color-primary-50)]/40"
          : "border-border bg-surface"
      } ${
        interactive
          ? "transition-elevate hover-elevate hover:border-border-strong hover:shadow-card-elevated"
          : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
