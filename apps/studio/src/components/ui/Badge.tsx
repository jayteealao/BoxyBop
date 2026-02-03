/**
 * Badge component for status indicators and counts.
 */

import { clsx } from "clsx";
import type { ReactNode } from "react";

type BadgeVariant = "default" | "accent" | "success" | "warning" | "danger";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variantClasses: Record<BadgeVariant, string> = {
    default: "badge-default",
    accent: "badge-accent",
    success: "badge-success",
    warning: "badge-warning",
    danger: "badge-danger",
  };

  return (
    <span className={clsx(variantClasses[variant], className)}>{children}</span>
  );
}

interface StatusBadgeProps {
  status: "ready" | "generating" | "error" | "pending";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<
    StatusBadgeProps["status"],
    { variant: BadgeVariant; label: string }
  > = {
    ready: { variant: "success", label: "Ready" },
    generating: { variant: "accent", label: "Generating" },
    error: { variant: "danger", label: "Error" },
    pending: { variant: "warning", label: "Pending" },
  };

  const { variant, label } = config[status];

  return (
    <Badge variant={variant} className="flex items-center gap-1.5">
      <span
        className={clsx(
          "w-1.5 h-1.5 rounded-full",
          status === "ready" && "bg-success",
          status === "generating" && "bg-accent animate-pulse",
          status === "error" && "bg-danger",
          status === "pending" && "bg-warning"
        )}
      />
      {label}
    </Badge>
  );
}
