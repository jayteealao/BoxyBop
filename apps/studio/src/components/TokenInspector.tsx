/**
 * Token Inspector Component.
 *
 * Displays design tokens with visual previews:
 * - Colors: swatches grouped by semantic category
 * - Typography: preview sample text for each scale step
 * - Spacing/radius/shadows: visual previews
 * - Click-to-copy functionality for var names and values
 */

import { useState, useMemo } from "react";
import { CopyButton } from "./ui/CopyButton";
import { SearchInput } from "./ui/SearchInput";
import type { TokenSummary } from "../lib/api";

interface TokenInspectorProps {
  tokens: TokenSummary;
}

type TokenCategory = "colors" | "typography" | "spacing" | "effects";

const CATEGORY_LABELS: Record<TokenCategory, string> = {
  colors: "Colors",
  typography: "Typography",
  spacing: "Spacing & Sizing",
  effects: "Effects",
};

export function TokenInspector({ tokens }: TokenInspectorProps) {
  const [activeCategory, setActiveCategory] = useState<TokenCategory>("colors");
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-6">
      {/* Category tabs */}
      <div className="flex gap-2 border-b border-studio-700 pb-4">
        {(Object.keys(CATEGORY_LABELS) as TokenCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeCategory === cat
                ? "bg-accent text-ink-900"
                : "text-ink-400 hover:text-ink-200 hover:bg-studio-800"
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={`Search ${CATEGORY_LABELS[activeCategory].toLowerCase()}...`}
      />

      {/* Token display */}
      <div className="min-h-[400px]">
        {activeCategory === "colors" && (
          <ColorTokens colors={tokens.colors} search={search} />
        )}
        {activeCategory === "typography" && (
          <TypographyTokens typography={tokens.typography} search={search} />
        )}
        {activeCategory === "spacing" && (
          <SpacingTokens
            spacing={tokens.spacing}
            radius={tokens.radius}
            search={search}
          />
        )}
        {activeCategory === "effects" && (
          <EffectsTokens
            shadows={tokens.shadows}
            borders={tokens.borders}
            search={search}
          />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Color Tokens
// =============================================================================

interface ColorTokensProps {
  colors: TokenSummary["colors"];
  search: string;
}

function ColorTokens({ colors, search }: ColorTokensProps) {
  const grouped = useMemo(() => {
    const groups: Record<string, TokenSummary["colors"]> = {};

    for (const color of colors) {
      if (search && !color.name.toLowerCase().includes(search.toLowerCase())) {
        continue;
      }

      // Group by category or prefix
      const category = color.category || color.name.split("-")[0] || "other";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(color);
    }

    return groups;
  }, [colors, search]);

  const groupNames = Object.keys(grouped).sort();

  if (groupNames.length === 0) {
    return (
      <div className="text-center py-12 text-ink-500">
        No colors match your search.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groupNames.map((group) => (
        <div key={group}>
          <h3 className="text-sm font-semibold text-ink-300 uppercase tracking-wider mb-4">
            {group}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {grouped[group].map((color) => (
              <ColorSwatch key={color.cssVar} color={color} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface ColorSwatchProps {
  color: TokenSummary["colors"][number];
}

function ColorSwatch({ color }: ColorSwatchProps) {
  // Calculate contrast for text color
  const isLight = useMemo(() => {
    // Parse hex color
    const hex = color.value.replace("#", "");
    if (hex.length !== 6) return false;

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    // Relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }, [color.value]);

  return (
    <div className="group relative">
      {/* Swatch */}
      <div
        className="aspect-square rounded-lg border border-studio-700 overflow-hidden"
        style={{ backgroundColor: color.value }}
      >
        {/* Overlay with details on hover */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${
            isLight ? "bg-black/40" : "bg-white/10"
          }`}
        >
          <CopyButton
            value={color.value}
            label="Copy hex"
            className="!p-1.5 !text-xs"
          />
        </div>
      </div>

      {/* Label */}
      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-1">
          <span className="text-sm font-mono text-ink-200 truncate flex-1">
            {color.name}
          </span>
          <CopyButton value={color.cssVar} label="" className="!p-0.5 opacity-0 group-hover:opacity-100" />
        </div>
        <div className="text-xs font-mono text-ink-500">{color.value}</div>
        {color.role && (
          <div className="text-xs text-ink-600">{color.role}</div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Typography Tokens
// =============================================================================

interface TypographyTokensProps {
  typography: TokenSummary["typography"];
  search: string;
}

function TypographyTokens({ typography, search }: TypographyTokensProps) {
  const filtered = useMemo(() => {
    if (!search) return typography;
    return typography.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [typography, search]);

  const sampleText = "The quick brown fox jumps over the lazy dog";

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-ink-500">
        No typography tokens match your search.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filtered
        .sort((a, b) => parseFloat(a.fontSize) - parseFloat(b.fontSize))
        .map((token) => (
          <div
            key={token.cssVar}
            className="p-4 bg-studio-800 rounded-lg border border-studio-700 group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-accent">{token.name}</span>
                <span className="text-xs text-ink-500">
                  {token.fontSize} / {token.fontWeight}
                  {token.lineHeight && ` / ${token.lineHeight}`}
                </span>
              </div>
              <CopyButton value={token.cssVar} label="Copy var" />
            </div>
            <p
              className="text-ink-200 truncate"
              style={{
                fontSize: token.fontSize,
                fontWeight: typeof token.fontWeight === "number" ? token.fontWeight : parseInt(token.fontWeight) || 400,
                lineHeight: token.lineHeight || "normal",
              }}
            >
              {sampleText}
            </p>
          </div>
        ))}
    </div>
  );
}

// =============================================================================
// Spacing Tokens
// =============================================================================

interface SpacingTokensProps {
  spacing: TokenSummary["spacing"];
  radius: TokenSummary["radius"];
  search: string;
}

function SpacingTokens({ spacing, radius, search }: SpacingTokensProps) {
  const filteredSpacing = useMemo(() => {
    if (!search) return spacing;
    return spacing.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [spacing, search]);

  const filteredRadius = useMemo(() => {
    if (!search) return radius;
    return radius.filter((r) =>
      r.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [radius, search]);

  return (
    <div className="space-y-8">
      {/* Spacing */}
      {filteredSpacing.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink-300 uppercase tracking-wider mb-4">
            Spacing Scale
          </h3>
          <div className="space-y-2">
            {filteredSpacing
              .sort((a, b) => parseFloat(a.value) - parseFloat(b.value))
              .map((token) => (
                <div
                  key={token.cssVar}
                  className="flex items-center gap-4 p-3 bg-studio-800 rounded-lg border border-studio-700 group"
                >
                  <span className="w-16 text-sm font-mono text-accent shrink-0">
                    {token.name}
                  </span>
                  <div className="flex-1 h-6 bg-studio-900 rounded overflow-hidden">
                    <div
                      className="h-full bg-accent/30 border-r-2 border-accent"
                      style={{ width: token.value }}
                    />
                  </div>
                  <span className="text-xs font-mono text-ink-500 w-16 text-right shrink-0">
                    {token.value}
                  </span>
                  <CopyButton
                    value={token.cssVar}
                    label=""
                    className="opacity-0 group-hover:opacity-100"
                  />
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Border Radius */}
      {filteredRadius.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink-300 uppercase tracking-wider mb-4">
            Border Radius
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredRadius
              .sort((a, b) => parseFloat(a.value) - parseFloat(b.value))
              .map((token) => (
                <div
                  key={token.cssVar}
                  className="p-4 bg-studio-800 rounded-lg border border-studio-700 group text-center"
                >
                  <div
                    className="w-16 h-16 mx-auto bg-accent/20 border-2 border-accent mb-3"
                    style={{ borderRadius: token.value }}
                  />
                  <div className="text-sm font-mono text-accent">{token.name}</div>
                  <div className="text-xs font-mono text-ink-500 mt-1">
                    {token.value}
                  </div>
                  <CopyButton
                    value={token.cssVar}
                    label=""
                    className="opacity-0 group-hover:opacity-100 mx-auto mt-2"
                  />
                </div>
              ))}
          </div>
        </div>
      )}

      {filteredSpacing.length === 0 && filteredRadius.length === 0 && (
        <div className="text-center py-12 text-ink-500">
          No spacing tokens match your search.
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Effects Tokens
// =============================================================================

interface EffectsTokensProps {
  shadows: TokenSummary["shadows"];
  borders: TokenSummary["borders"];
  search: string;
}

function EffectsTokens({ shadows, borders, search }: EffectsTokensProps) {
  const filteredShadows = useMemo(() => {
    if (!search) return shadows;
    return shadows.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [shadows, search]);

  const filteredBorders = useMemo(() => {
    if (!search) return borders;
    return borders.filter((b) =>
      b.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [borders, search]);

  return (
    <div className="space-y-8">
      {/* Shadows */}
      {filteredShadows.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink-300 uppercase tracking-wider mb-4">
            Shadows
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredShadows.map((token) => (
              <div
                key={token.cssVar}
                className="p-6 bg-studio-800 rounded-lg border border-studio-700 group"
              >
                <div
                  className="w-full h-24 bg-studio-700 rounded-lg mb-4"
                  style={{ boxShadow: token.value }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono text-accent">{token.name}</span>
                  <CopyButton value={token.cssVar} label="Copy" />
                </div>
                <p className="text-xs font-mono text-ink-500 mt-2 break-all">
                  {token.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Borders */}
      {filteredBorders.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink-300 uppercase tracking-wider mb-4">
            Borders
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBorders.map((token) => {
              const borderValue = `${token.width} ${token.style}${token.color ? ` ${token.color}` : ""}`;
              return (
                <div
                  key={token.cssVar}
                  className="p-4 bg-studio-800 rounded-lg border border-studio-700 group"
                >
                  <div
                    className="w-full h-16 bg-studio-900 rounded mb-3"
                    style={{ border: borderValue }}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono text-accent">{token.name}</span>
                    <CopyButton
                      value={token.cssVar}
                      label=""
                      className="opacity-0 group-hover:opacity-100"
                    />
                  </div>
                  <p className="text-xs font-mono text-ink-500 mt-1">{borderValue}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {filteredShadows.length === 0 && filteredBorders.length === 0 && (
        <div className="text-center py-12 text-ink-500">
          No effects match your search.
        </div>
      )}
    </div>
  );
}
