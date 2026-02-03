/**
 * Style Guide Preview - Visual preview of locked style tokens.
 */

export interface StyleTokens {
  colors: Array<{ cssVar: string; value: string; role: string }>;
  typography: Array<{ cssVar: string; fontSize: string; fontWeight: number; lineHeight?: string }>;
  spacing: Array<{ cssVar: string; value: string }>;
  radius: Array<{ cssVar: string; value: string }>;
  shadows: Array<{ cssVar: string; value: string }>;
}

interface StyleGuidePreviewProps {
  tokens: StyleTokens;
  tokensHash: string;
  styleRunId?: string;
  compact?: boolean;
}

function ColorSwatch({ value, role }: { cssVar: string; value: string; role: string }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-studio-bg rounded-lg">
      <div
        className="w-8 h-8 rounded border border-white/10 flex-shrink-0"
        style={{ backgroundColor: value }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ink-primary truncate">{role}</p>
        <p className="text-2xs font-mono text-ink-muted truncate">{value}</p>
      </div>
    </div>
  );
}

function TypographyPreview({
  cssVar,
  fontSize,
  fontWeight,
}: {
  cssVar: string;
  fontSize: string;
  fontWeight: number;
}) {
  const label = cssVar.replace("--font-", "").replace(/-/g, " ");
  return (
    <div className="flex items-center justify-between p-2 bg-studio-bg rounded-lg">
      <span
        className="text-ink-primary truncate"
        style={{ fontSize, fontWeight }}
      >
        {label}
      </span>
      <span className="text-2xs font-mono text-ink-muted ml-2 flex-shrink-0">
        {fontSize}/{fontWeight}
      </span>
    </div>
  );
}

function SpacingPreview({ cssVar, value }: { cssVar: string; value: string }) {
  const label = cssVar.replace("--spacing-", "");
  const numericValue = parseFloat(value);
  const maxWidth = 64; // max bar width in pixels
  const barWidth = Math.min((numericValue / 48) * maxWidth, maxWidth);

  return (
    <div className="flex items-center gap-2 p-2 bg-studio-bg rounded-lg">
      <div className="w-12 flex-shrink-0">
        <span className="text-xs text-ink-primary font-medium">{label}</span>
      </div>
      <div
        className="h-3 bg-accent/30 rounded"
        style={{ width: `${barWidth}px` }}
      />
      <span className="text-2xs font-mono text-ink-muted">{value}</span>
    </div>
  );
}

function RadiusPreview({ cssVar, value }: { cssVar: string; value: string }) {
  const label = cssVar.replace("--radius-", "");
  return (
    <div className="flex items-center gap-2 p-2 bg-studio-bg rounded-lg">
      <div
        className="w-8 h-8 bg-accent/20 border-2 border-accent flex-shrink-0"
        style={{ borderRadius: value }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-primary">{label}</p>
        <p className="text-2xs font-mono text-ink-muted">{value}</p>
      </div>
    </div>
  );
}

function ShadowPreview({ cssVar, value }: { cssVar: string; value: string }) {
  const label = cssVar.replace("--shadow-", "");
  return (
    <div className="flex items-center gap-2 p-2 bg-studio-bg rounded-lg">
      <div
        className="w-8 h-8 bg-white rounded flex-shrink-0"
        style={{ boxShadow: value }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-primary">{label}</p>
        <p className="text-2xs font-mono text-ink-muted truncate" title={value}>
          {value.length > 30 ? `${value.slice(0, 30)}...` : value}
        </p>
      </div>
    </div>
  );
}

export function StyleGuidePreview({
  tokens,
  tokensHash,
  styleRunId,
  compact = false,
}: StyleGuidePreviewProps) {
  const totalTokens =
    tokens.colors.length +
    tokens.typography.length +
    tokens.spacing.length +
    tokens.radius.length +
    tokens.shadows.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-ink-primary flex items-center gap-2">
            <svg className="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Locked Style Guide
          </h3>
          <p className="text-xs text-ink-muted mt-0.5">
            {totalTokens} tokens locked
            <span className="mx-1">•</span>
            <span className="font-mono">{tokensHash.slice(0, 12)}...</span>
          </p>
        </div>
      </div>

      {/* Compact mode - just counts */}
      {compact ? (
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: "Colors", count: tokens.colors.length, color: "bg-token-color" },
            { label: "Type", count: tokens.typography.length, color: "bg-token-typography" },
            { label: "Space", count: tokens.spacing.length, color: "bg-token-spacing" },
            { label: "Radius", count: tokens.radius.length, color: "bg-token-radius" },
            { label: "Shadow", count: tokens.shadows.length, color: "bg-token-shadow" },
          ].map((item) => (
            <div key={item.label} className="text-center p-2 bg-studio-bg rounded-lg">
              <div className={`w-2 h-2 rounded-full ${item.color} mx-auto mb-1`} />
              <p className="text-lg font-bold text-ink-primary">{item.count}</p>
              <p className="text-2xs text-ink-muted">{item.label}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Colors */}
          {tokens.colors.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-ink-secondary mb-2 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-token-color" />
                Colors ({tokens.colors.length})
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {tokens.colors.slice(0, 9).map((color) => (
                  <ColorSwatch key={color.cssVar} {...color} />
                ))}
                {tokens.colors.length > 9 && (
                  <div className="flex items-center justify-center p-2 bg-studio-bg rounded-lg text-xs text-ink-muted">
                    +{tokens.colors.length - 9} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Typography */}
          {tokens.typography.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-ink-secondary mb-2 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-token-typography" />
                Typography ({tokens.typography.length})
              </h4>
              <div className="space-y-1">
                {tokens.typography.slice(0, 5).map((type) => (
                  <TypographyPreview key={type.cssVar} {...type} />
                ))}
                {tokens.typography.length > 5 && (
                  <p className="text-xs text-ink-muted text-center py-1">
                    +{tokens.typography.length - 5} more
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Spacing */}
          {tokens.spacing.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-ink-secondary mb-2 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-token-spacing" />
                Spacing ({tokens.spacing.length})
              </h4>
              <div className="grid grid-cols-2 gap-1">
                {tokens.spacing.slice(0, 6).map((space) => (
                  <SpacingPreview key={space.cssVar} {...space} />
                ))}
              </div>
            </div>
          )}

          {/* Border Radius */}
          {tokens.radius.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-ink-secondary mb-2 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-token-radius" />
                Border Radius ({tokens.radius.length})
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {tokens.radius.slice(0, 6).map((radius) => (
                  <RadiusPreview key={radius.cssVar} {...radius} />
                ))}
              </div>
            </div>
          )}

          {/* Shadows */}
          {tokens.shadows.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-ink-secondary mb-2 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-token-shadow" />
                Shadows ({tokens.shadows.length})
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {tokens.shadows.slice(0, 4).map((shadow) => (
                  <ShadowPreview key={shadow.cssVar} {...shadow} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Style Run ID */}
      {styleRunId && (
        <p className="text-2xs text-ink-disabled font-mono pt-2 border-t border-studio-border">
          Style Run: {styleRunId}
        </p>
      )}
    </div>
  );
}
