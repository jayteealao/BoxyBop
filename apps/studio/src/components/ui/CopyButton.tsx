/**
 * Copy to clipboard button with feedback.
 */

import { useState, useCallback } from "react";
import { clsx } from "clsx";

interface CopyButtonProps {
  /** Value to copy - use either value or text */
  value?: string;
  /** Alias for value (for backward compatibility) */
  text?: string;
  className?: string;
  label?: string;
}

export function CopyButton({ value, text, className, label }: CopyButtonProps) {
  const textToCopy = value ?? text ?? "";
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [textToCopy]);

  return (
    <button
      onClick={handleCopy}
      className={clsx(
        "inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-all duration-150",
        copied
          ? "bg-success/10 text-success"
          : "bg-studio-surface-raised text-ink-secondary hover:text-ink-primary hover:bg-studio-surface-overlay",
        className
      )}
      title={copied ? "Copied!" : `Copy ${label || "to clipboard"}`}
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          {label || "Copy"}
        </>
      )}
    </button>
  );
}
