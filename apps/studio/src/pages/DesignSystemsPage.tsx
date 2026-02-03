/**
 * Design Systems Index Page.
 *
 * Lists all generated UI packages with search, filtering, and quick actions.
 */

import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import {
  Card,
  SearchInput,
  Badge,
  StatusBadge,
  EmptyState,
  TableSkeleton,
} from "../components/ui";
import { fetchUIPackages, type UIPackage } from "../lib/api";

type SortField = "generatedAt" | "setSlug" | "components";
type SortOrder = "asc" | "desc";

function DesignSystemIcon() {
  return (
    <svg
      className="w-8 h-8"
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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DesignSystemsPage() {
  const [packages, setPackages] = useState<UIPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("generatedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    async function loadPackages() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchUIPackages();
        setPackages(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load packages");
      } finally {
        setIsLoading(false);
      }
    }

    loadPackages();
  }, []);

  const filteredPackages = useMemo(() => {
    let result = [...packages];

    // Filter by search
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(
        (pkg) =>
          pkg.setSlug.toLowerCase().includes(lowerSearch) ||
          pkg.groupings.some((g: string) => g.toLowerCase().includes(lowerSearch))
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "generatedAt":
          comparison =
            new Date(a.generatedAt).getTime() -
            new Date(b.generatedAt).getTime();
          break;
        case "setSlug":
          comparison = a.setSlug.localeCompare(b.setSlug);
          break;
        case "components":
          comparison = a.counts.components - b.counts.components;
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [packages, search, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink-primary">
            Design Systems
          </h1>
          <p className="mt-1 text-ink-secondary">
            Browse and inspect generated component libraries.
          </p>
        </div>
        <Link to="/" className="btn-primary">
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          New Library
        </Link>
      </div>

      {/* Intro card */}
      {packages.length === 0 && !isLoading && !error && (
        <Card className="bg-gradient-to-br from-studio-surface to-studio-surface-raised">
          <div className="flex items-start gap-6">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <DesignSystemIcon />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-ink-primary mb-2">
                What are Design Systems?
              </h3>
              <p className="text-sm text-ink-secondary mb-4">
                Design Systems in BoxyBop are generated UI packages created from
                screenshot analysis. Each system includes:
              </p>
              <ul className="text-sm text-ink-secondary space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-token-color" />
                  <strong>Tokens:</strong> Colors, typography, spacing, shadows
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-token-typography" />
                  <strong>Components:</strong> shadcn-style React components
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-token-spacing" />
                  <strong>Stories:</strong> Storybook stories for each component
                </li>
              </ul>
              <p className="text-sm text-ink-muted mt-4">
                To generate a new system, go to{" "}
                <Link to="/" className="text-accent hover:underline">
                  Workspace
                </Link>{" "}
                and upload screenshots.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Search and filters */}
      {(packages.length > 0 || search) && (
        <div className="flex items-center gap-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or group..."
            className="w-80"
          />
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <span>Sort:</span>
            <button
              onClick={() => handleSort("generatedAt")}
              className={clsx(
                "px-2 py-1 rounded",
                sortField === "generatedAt"
                  ? "bg-studio-surface-raised text-ink-primary"
                  : "hover:text-ink-primary"
              )}
            >
              Recent
              {sortField === "generatedAt" && (
                <span className="ml-1">{sortOrder === "desc" ? "↓" : "↑"}</span>
              )}
            </button>
            <button
              onClick={() => handleSort("setSlug")}
              className={clsx(
                "px-2 py-1 rounded",
                sortField === "setSlug"
                  ? "bg-studio-surface-raised text-ink-primary"
                  : "hover:text-ink-primary"
              )}
            >
              Name
              {sortField === "setSlug" && (
                <span className="ml-1">{sortOrder === "desc" ? "↓" : "↑"}</span>
              )}
            </button>
            <button
              onClick={() => handleSort("components")}
              className={clsx(
                "px-2 py-1 rounded",
                sortField === "components"
                  ? "bg-studio-surface-raised text-ink-primary"
                  : "hover:text-ink-primary"
              )}
            >
              Components
              {sortField === "components" && (
                <span className="ml-1">{sortOrder === "desc" ? "↓" : "↑"}</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && <TableSkeleton rows={4} />}

      {/* Error state */}
      {error && (
        <Card className="bg-danger/5 border-danger/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-danger/10 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-danger"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-danger">Failed to load packages</h3>
              <p className="text-sm text-ink-secondary mt-1">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="btn-secondary mt-3 text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !error && packages.length === 0 && (
        <EmptyState
          icon={<DesignSystemIcon />}
          title="No design systems yet"
          description="Generate your first component library by uploading screenshots in the Workspace."
          action={
            <Link to="/" className="btn-primary">
              Go to Workspace
            </Link>
          }
        />
      )}

      {/* Search empty state */}
      {!isLoading && !error && packages.length > 0 && filteredPackages.length === 0 && (
        <EmptyState
          icon={
            <svg
              className="w-8 h-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
          }
          title="No matching systems"
          description={`No design systems match "${search}". Try a different search term.`}
          action={
            <button onClick={() => setSearch("")} className="btn-secondary">
              Clear search
            </button>
          }
        />
      )}

      {/* Package list */}
      {!isLoading && !error && filteredPackages.length > 0 && (
        <div className="space-y-3">
          {filteredPackages.map((pkg) => (
            <Link
              key={pkg.setSlug}
              to={`/design-systems/${pkg.setSlug}`}
              className="block"
            >
              <Card className="hover:border-studio-border-accent transition-colors group">
                <div className="flex items-center gap-6">
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center border border-accent/10 group-hover:border-accent/30 transition-colors">
                    <span className="font-display font-bold text-accent text-lg">
                      {pkg.setSlug.slice(0, 2).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-ink-primary group-hover:text-accent transition-colors">
                        ui-{pkg.setSlug}
                      </h3>
                      <StatusBadge status="ready" />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-ink-muted">
                      <span>{formatDate(pkg.generatedAt)}</span>
                      <span className="text-ink-disabled">•</span>
                      <span>{pkg.counts.components} components</span>
                      <span className="text-ink-disabled">•</span>
                      <span>{pkg.counts.tokens} tokens</span>
                    </div>
                    {pkg.groupings.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        {pkg.groupings.slice(0, 4).map((group: string) => (
                          <Badge key={group} variant="default">
                            {group}
                          </Badge>
                        ))}
                        {pkg.groupings.length > 4 && (
                          <span className="text-2xs text-ink-muted">
                            +{pkg.groupings.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Hash */}
                  <div className="text-right">
                    <p className="text-2xs text-ink-muted">Token Hash</p>
                    <p className="text-xs font-mono text-ink-secondary">
                      {pkg.tokensHash.slice(0, 12)}...
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className="text-ink-muted group-hover:text-accent transition-colors">
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
