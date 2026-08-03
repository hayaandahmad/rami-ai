import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-action-primary text-text-inverse hover:bg-[var(--color-action-primary-hover)] active:bg-[var(--color-action-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "border border-border bg-surface text-text-primary hover:bg-surface-subtle hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-50",
  ghost:
    "bg-transparent text-text-secondary hover:bg-surface-subtle hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "border border-[var(--color-error-700)] bg-[var(--color-error-100)] text-[var(--color-error-700)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-10 px-3 text-small",
  md: "min-h-11 px-5 text-small",
  lg: "min-h-11 px-5 text-body",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-control font-medium transition-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
