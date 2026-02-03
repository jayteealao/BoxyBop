/**
 * Design System Detail Page.
 *
 * Shows detailed view of a generated UI package with tabs:
 * - Overview: README and summary
 * - Tokens: Token inspector with swatches
 * - Components: Component gallery with search
 * - Stories: Story links to Storybook
 */

import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Card,
  CardHeader,
  Tabs,
  TabPanel,
  SearchInput,
  Badge,
  CopyButton,
  EmptyState,
  CardSkeleton,
} from "../components/ui";
import { TokenInspector } from "../components/TokenInspector";
import { ComponentGallery } from "../components/ComponentGallery";
import { fetchUIPackageManifest, type UIPackageManifest, type ComponentInfo } from "../lib/api";

const tabs = [
  { id: "overview", label: "Overview", icon: <OverviewIcon /> },
  { id: "tokens", label: "Tokens", icon: <TokensIcon /> },
  { id: "components", label: "Components", icon: <ComponentsIcon /> },
  { id: "stories", label: "Stories", icon: <StoriesIcon /> },
];

function OverviewIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

function TokensIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}

function ComponentsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function StoriesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      <path d="M12 6v8l3-2 3 2V6" />
    </svg>
  );
}

export function DesignSystemDetailPage() {
  const { setSlug } = useParams<{ setSlug: string }>();
  const [manifest, setManifest] = useState<UIPackageManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!setSlug) return;

    const slug = setSlug; // Capture to ensure it's not undefined

    async function loadManifest() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchUIPackageManifest(slug);
        setManifest(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load manifest");
      } finally {
        setIsLoading(false);
      }
    }

    loadManifest();
  }, [setSlug]);

  const tabsWithCounts = useMemo(() => {
    if (!manifest) return tabs;
    return tabs.map((tab) => ({
      ...tab,
      count:
        tab.id === "tokens"
          ? Object.values(manifest.tokens).flat().length
          : tab.id === "components"
          ? manifest.components.length
          : tab.id === "stories"
          ? manifest.components.reduce(
              (acc: number, c) => acc + (c.storyIds?.length || 1),
              0
            )
          : undefined,
    }));
  }, [manifest]);

  if (!setSlug) {
    return (
      <EmptyState
        title="No package selected"
        description="Please select a design system from the list."
        action={
          <Link to="/design-systems" className="btn-primary">
            Back to list
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link
          to="/design-systems"
          className="text-ink-muted hover:text-ink-primary transition-colors"
        >
          Design Systems
        </Link>
        <span className="text-ink-disabled">/</span>
        <span className="text-ink-primary font-medium">ui-{setSlug}</span>
      </nav>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 skeleton rounded-xl" />
            <div className="flex-1">
              <div className="skeleton h-7 w-48 mb-2" />
              <div className="skeleton h-4 w-96" />
            </div>
          </div>
          <div className="border-b border-studio-border pb-3">
            <div className="flex gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-10 w-24" />
              ))}
            </div>
          </div>
          <CardSkeleton />
        </div>
      )}

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
              <h3 className="font-medium text-danger">Failed to load package</h3>
              <p className="text-sm text-ink-secondary mt-1">{error}</p>
              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => window.location.reload()}
                  className="btn-secondary text-sm"
                >
                  Retry
                </button>
                <Link to="/design-systems" className="btn-ghost text-sm">
                  Back to list
                </Link>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Content */}
      {manifest && (
        <>
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center border border-accent/10">
                <span className="font-display font-bold text-accent text-2xl">
                  {setSlug.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-ink-primary">
                  ui-{setSlug}
                </h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-ink-muted">
                  <span>
                    Generated{" "}
                    {new Date(manifest.generatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-ink-disabled">•</span>
                  <span>{manifest.components.length} components</span>
                  <span className="text-ink-disabled">•</span>
                  <span className="font-mono text-2xs">
                    {manifest.tokensHash.slice(0, 12)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {manifest.storybook.url && (
                <a
                  href={manifest.storybook.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <path d="M15 3h6v6M10 14L21 3" strokeLinecap="round" />
                  </svg>
                  Open Storybook
                </a>
              )}
              <CopyButton
                text={`@boxybop/ui-${setSlug}`}
                label="package name"
                className="px-3 py-2"
              />
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            tabs={tabsWithCounts}
            activeTab={activeTab}
            onChange={setActiveTab}
          />

          {/* Tab panels */}
          {activeTab === "overview" && (
            <TabPanel>
              <OverviewTab manifest={manifest} />
            </TabPanel>
          )}

          {activeTab === "tokens" && (
            <TabPanel>
              <TokenInspector tokens={manifest.tokens} />
            </TabPanel>
          )}

          {activeTab === "components" && (
            <TabPanel>
              <ComponentGallery
                components={manifest.components}
                setSlug={setSlug}
                storybookUrl={manifest.storybook.url}
              />
            </TabPanel>
          )}

          {activeTab === "stories" && (
            <TabPanel>
              <StoriesTab
                components={manifest.components}
                storybookUrl={manifest.storybook.url}
              />
            </TabPanel>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// Tab Components
// =============================================================================

function OverviewTab({ manifest }: { manifest: UIPackageManifest }) {
  const hasMarkdown =
    manifest.docs.designSystemMarkdown || manifest.docs.readmeMarkdown;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Design System Markdown */}
        {manifest.docs.designSystemMarkdown && (
          <Card>
            <CardHeader title="Design System" />
            <div className="prose prose-invert prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-ink-secondary">
                {manifest.docs.designSystemMarkdown}
              </pre>
            </div>
          </Card>
        )}

        {/* README */}
        {manifest.docs.readmeMarkdown && (
          <Card>
            <CardHeader title="README" />
            <div className="prose prose-invert prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-ink-secondary">
                {manifest.docs.readmeMarkdown}
              </pre>
            </div>
          </Card>
        )}

        {/* No docs */}
        {!hasMarkdown && (
          <Card>
            <EmptyState
              title="No documentation"
              description="This package doesn't have generated documentation yet."
            />
          </Card>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Quick stats */}
        <Card>
          <CardHeader title="Statistics" />
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-studio-bg rounded-lg">
              <p className="text-2xs text-ink-muted uppercase tracking-wider">
                Components
              </p>
              <p className="text-2xl font-display font-bold text-ink-primary mt-1">
                {manifest.components.length}
              </p>
            </div>
            <div className="p-3 bg-studio-bg rounded-lg">
              <p className="text-2xs text-ink-muted uppercase tracking-wider">
                Tokens
              </p>
              <p className="text-2xl font-display font-bold text-ink-primary mt-1">
                {Object.values(manifest.tokens).flat().length}
              </p>
            </div>
          </div>
        </Card>

        {/* Token breakdown */}
        <Card>
          <CardHeader title="Token Breakdown" />
          <div className="space-y-2">
            {[
              { label: "Colors", count: manifest.tokens.colors.length, color: "bg-token-color" },
              { label: "Typography", count: manifest.tokens.typography.length, color: "bg-token-typography" },
              { label: "Spacing", count: manifest.tokens.spacing.length, color: "bg-token-spacing" },
              { label: "Radius", count: manifest.tokens.radius.length, color: "bg-token-radius" },
              { label: "Shadows", count: manifest.tokens.shadows.length, color: "bg-token-shadow" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between py-1"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${item.color}`} />
                  <span className="text-sm text-ink-secondary">{item.label}</span>
                </div>
                <span className="text-sm font-mono text-ink-primary">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Component groups */}
        {manifest.components.length > 0 && (
          <Card>
            <CardHeader title="Component Groups" />
            <div className="flex flex-wrap gap-2">
              {[...new Set(manifest.components.map((c) => c.group))].map(
                (group: string) => (
                  <Badge key={group} variant="default">
                    {group}
                  </Badge>
                )
              )}
            </div>
          </Card>
        )}

        {/* Quick links */}
        {manifest.storybook.recommendedLinks.length > 0 && (
          <Card>
            <CardHeader title="Quick Links" />
            <div className="space-y-2">
              {manifest.storybook.recommendedLinks.map((link: { title: string; href: string }) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-studio-bg transition-colors group"
                >
                  <svg
                    className="w-4 h-4 text-ink-muted group-hover:text-accent"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <path d="M15 3h6v6M10 14L21 3" strokeLinecap="round" />
                  </svg>
                  <span className="text-sm text-ink-secondary group-hover:text-ink-primary">
                    {link.title}
                  </span>
                </a>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function StoriesTab({
  components,
  storybookUrl,
}: {
  components: UIPackageManifest["components"];
  storybookUrl?: string;
}) {
  const [search, setSearch] = useState("");

  const filteredComponents = useMemo(() => {
    if (!search) return components;
    const lowerSearch = search.toLowerCase();
    return components.filter((c) =>
      c.name.toLowerCase().includes(lowerSearch) ||
      c.group.toLowerCase().includes(lowerSearch)
    );
  }, [components, search]);

  const groupedComponents = useMemo(() => {
    const groups: Record<string, ComponentInfo[]> = {};
    for (const component of filteredComponents) {
      if (!groups[component.group]) {
        groups[component.group] = [];
      }
      groups[component.group].push(component);
    }
    return groups;
  }, [filteredComponents]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search stories..."
          className="w-80"
        />
        {storybookUrl && (
          <a
            href={storybookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            Open Storybook
          </a>
        )}
      </div>

      {Object.entries(groupedComponents).map(([group, groupComponents]) => (
        <div key={group}>
          <h3 className="text-sm font-semibold text-ink-primary mb-3">
            {group}
          </h3>
          <div className="space-y-2">
            {groupComponents.map((component) => (
              <Card key={component.name} padding="sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-ink-primary">
                      {component.name}
                    </p>
                    {component.storyIds && component.storyIds.length > 0 && (
                      <p className="text-sm text-ink-muted mt-1">
                        {component.storyIds.length} stories
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {component.storyIds?.map((storyId: string) => (
                      <a
                        key={storyId}
                        href={
                          storybookUrl
                            ? `${storybookUrl}/?path=/story/${storyId}`
                            : `http://localhost:6006/?path=/story/${storyId}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost px-2 py-1 text-xs"
                      >
                        {storyId.split("--").pop()}
                      </a>
                    ))}
                    {(!component.storyIds || component.storyIds.length === 0) && (
                      <a
                        href={
                          storybookUrl
                            ? `${storybookUrl}/?path=/docs/${component.name.toLowerCase()}--docs`
                            : `http://localhost:6006/?path=/docs/${component.name.toLowerCase()}--docs`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost px-2 py-1 text-xs"
                      >
                        View Story
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {filteredComponents.length === 0 && (
        <EmptyState
          title="No stories found"
          description={search ? `No stories match "${search}".` : "No stories available."}
        />
      )}
    </div>
  );
}
