/**
 * Empty state component for pages/sections with no data.
 */

import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && (
        <div className="w-16 h-16 mb-6 flex items-center justify-center rounded-2xl bg-studio-surface-raised border border-studio-border text-ink-muted">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-ink-primary mb-2">{title}</h3>
      <p className="text-sm text-ink-secondary max-w-md mb-6">{description}</p>
      {action}
    </div>
  );
}

export function EmptyStateIcon({ children }: { children: ReactNode }) {
  return <div className="w-8 h-8">{children}</div>;
}
