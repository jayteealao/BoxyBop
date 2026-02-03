/**
 * Component Gallery Component.
 *
 * Displays components from a design system:
 * - Grouped by design grouping from manifest
 * - Searchable and filterable
 * - Links to Storybook stories
 * - Copy import path functionality
 */

import { useState, useMemo } from "react";
import { SearchInput } from "./ui/SearchInput";
import { Badge } from "./ui/Badge";
import { CopyButton } from "./ui/CopyButton";
import { EmptyState } from "./ui/EmptyState";
import type { ComponentInfo } from "../lib/api";

interface ComponentGalleryProps {
  components: ComponentInfo[];
  setSlug: string;
  storybookUrl?: string;
}

export function ComponentGallery({
  components,
  setSlug,
  storybookUrl = "http://localhost:6006",
}: ComponentGalleryProps) {
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  // Get unique groups
  const groups = useMemo(() => {
    const groupSet = new Set(components.map((c) => c.group));
    return Array.from(groupSet).sort();
  }, [components]);

  // Filter components
  const filtered = useMemo(() => {
    return components.filter((c) => {
      // Group filter
      if (selectedGroup && c.group !== selectedGroup) {
        return false;
      }

      // Search filter
      if (search) {
        const query = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(query) ||
          c.group.toLowerCase().includes(query) ||
          (c.description?.toLowerCase().includes(query) ?? false)
        );
      }

      return true;
    });
  }, [components, selectedGroup, search]);

  // Group filtered components
  const grouped = useMemo(() => {
    const result: Record<string, ComponentInfo[]> = {};

    for (const component of filtered) {
      const group = component.group;
      if (!result[group]) {
        result[group] = [];
      }
      result[group].push(component);
    }

    // Sort components within each group
    for (const group of Object.keys(result)) {
      result[group].sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [filtered]);

  const groupNames = Object.keys(grouped).sort();

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search components..."
          />
        </div>

        {/* Group filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedGroup(null)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              selectedGroup === null
                ? "bg-accent text-ink-900"
                : "bg-studio-800 text-ink-400 hover:text-ink-200"
            }`}
          >
            All ({components.length})
          </button>
          {groups.map((group) => {
            const count = components.filter((c) => c.group === group).length;
            return (
              <button
                key={group}
                onClick={() => setSelectedGroup(group)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  selectedGroup === group
                    ? "bg-accent text-ink-900"
                    : "bg-studio-800 text-ink-400 hover:text-ink-200"
                }`}
              >
                {group} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-ink-500">
        Showing {filtered.length} of {components.length} components
        {selectedGroup && <span> in {selectedGroup}</span>}
        {search && <span> matching "{search}"</span>}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <EmptyState
          icon={
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          }
          title="No components found"
          description={
            search
              ? "Try adjusting your search terms"
              : "No components in this group"
          }
          action={
            (search || selectedGroup) && (
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedGroup(null);
                }}
                className="btn-secondary"
              >
                Clear filters
              </button>
            )
          }
        />
      )}

      {/* Component groups */}
      <div className="space-y-8">
        {groupNames.map((group) => (
          <div key={group}>
            <h3 className="text-lg font-semibold text-ink-200 mb-4 flex items-center gap-2">
              <span>{group}</span>
              <Badge variant="default">{grouped[group].length}</Badge>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {grouped[group].map((component) => (
                <ComponentCard
                  key={component.name}
                  component={component}
                  setSlug={setSlug}
                  storybookUrl={storybookUrl}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Component Card
// =============================================================================

interface ComponentCardProps {
  component: ComponentInfo;
  setSlug: string;
  storybookUrl: string;
}

function ComponentCard({ component, setSlug, storybookUrl }: ComponentCardProps) {
  const importPath = `@boxybop/ui-${setSlug}/${component.name}`;

  // Build Storybook URL for this component
  const storyUrl = useMemo(() => {
    // Storybook story IDs are typically lowercase with dashes
    const storyId = `${component.group.toLowerCase()}-${component.name.toLowerCase()}`;
    return `${storybookUrl}/?path=/story/${storyId}--default`;
  }, [component, storybookUrl]);

  return (
    <div className="card group hover:border-accent/50 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h4 className="font-mono text-accent font-medium">{component.name}</h4>
          <p className="text-xs text-ink-500">{component.group}</p>
        </div>

        {/* Status badge */}
        {(component.hasStory ?? (component.storyIds && component.storyIds.length > 0)) && (
          <Badge variant="success" className="shrink-0">
            Story
          </Badge>
        )}
      </div>

      {/* Description */}
      {component.description && (
        <p className="text-sm text-ink-400 mb-4 line-clamp-2">
          {component.description}
        </p>
      )}

      {/* Props preview */}
      {component.props && component.props.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-ink-500 mb-1">Props:</div>
          <div className="flex flex-wrap gap-1">
            {component.props.slice(0, 5).map((prop) => (
              <span
                key={prop}
                className="text-xs font-mono bg-studio-800 text-ink-400 px-1.5 py-0.5 rounded"
              >
                {prop}
              </span>
            ))}
            {component.props.length > 5 && (
              <span className="text-xs text-ink-500">
                +{component.props.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-studio-700">
        {/* Copy import */}
        <CopyButton
          value={importPath}
          label="Import"
          className="flex-1 justify-center"
        />

        {/* View story */}
        {(component.hasStory ?? (component.storyIds && component.storyIds.length > 0)) && (
          <a
            href={storyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex items-center gap-1.5"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            Story
          </a>
        )}

        {/* View source */}
        {component.sourcePath && (
          <button
            onClick={() => {
              // Could open in editor or show in modal
              navigator.clipboard.writeText(component.sourcePath!);
            }}
            className="p-2 text-ink-500 hover:text-ink-300 transition-colors"
            title={`Source: ${component.sourcePath}`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
