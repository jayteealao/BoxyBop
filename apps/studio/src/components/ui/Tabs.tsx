/**
 * Tab navigation component.
 */

import { clsx } from "clsx";
import type { ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="border-b border-studio-border">
      <nav className="flex gap-1 -mb-px" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onChange(tab.id)}
            className={clsx(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-150",
              activeTab === tab.id
                ? "text-accent border-accent"
                : "text-ink-muted border-transparent hover:text-ink-primary hover:border-studio-border-accent"
            )}
          >
            {tab.icon && (
              <span
                className={clsx(
                  "w-4 h-4",
                  activeTab === tab.id ? "text-accent" : "text-ink-muted"
                )}
              >
                {tab.icon}
              </span>
            )}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={clsx(
                  "ml-1 px-1.5 py-0.5 text-2xs font-mono rounded",
                  activeTab === tab.id
                    ? "bg-accent/10 text-accent"
                    : "bg-studio-surface-raised text-ink-muted"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

interface TabPanelProps {
  children: ReactNode;
  className?: string;
}

export function TabPanel({ children, className }: TabPanelProps) {
  return (
    <div role="tabpanel" className={clsx("py-6", className)}>
      {children}
    </div>
  );
}
