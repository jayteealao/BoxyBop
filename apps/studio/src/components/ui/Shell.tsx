/**
 * App Shell - Main layout wrapper for Studio.
 *
 * Provides consistent header, navigation, and content area.
 */

import { NavLink, Outlet, useLocation } from "react-router-dom";
import { clsx } from "clsx";

const navItems = [
  { to: "/", label: "Workspace", icon: WorkspaceIcon },
  { to: "/design-systems", label: "Design Systems", icon: DesignSystemsIcon },
];

function WorkspaceIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18M3 9h18" />
    </svg>
  );
}

function DesignSystemsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <path d="M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 bg-gradient-to-br from-accent to-accent-hover rounded-lg" />
        <div className="absolute inset-1 bg-studio-bg rounded-md flex items-center justify-center">
          <span className="font-display font-bold text-accent text-xs">BB</span>
        </div>
      </div>
      <div>
        <span className="font-display font-semibold text-ink-primary tracking-tight">
          BoxyBop
        </span>
        <span className="ml-1.5 text-2xs font-medium text-ink-muted uppercase tracking-wider">
          Studio
        </span>
      </div>
    </div>
  );
}

export function Shell() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-studio-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-studio-border">
        <div className="max-w-[1800px] mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Logo />

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive =
                  item.to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.to);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-studio-surface-raised text-ink-primary shadow-sm"
                        : "text-ink-secondary hover:text-ink-primary hover:bg-studio-surface"
                    )}
                  >
                    <item.icon
                      className={clsx(
                        "w-4 h-4",
                        isActive ? "text-accent" : "text-ink-muted"
                      )}
                    />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-3">
              <span className="text-2xs font-mono text-ink-muted uppercase tracking-wider">
                v0.1.0
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1800px] mx-auto px-6 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-studio-border py-6 mt-auto">
        <div className="max-w-[1800px] mx-auto px-6">
          <div className="flex items-center justify-between text-2xs text-ink-muted">
            <span>BoxyBop Studio</span>
            <span>
              Pipeline:{" "}
              <span className="text-success font-mono">localhost:3001</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
