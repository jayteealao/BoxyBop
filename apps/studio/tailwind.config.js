/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Core palette - industrial dark theme
        studio: {
          bg: "#0a0a0b",
          surface: "#111113",
          "surface-raised": "#18181b",
          "surface-overlay": "#1f1f23",
          border: "#27272a",
          "border-subtle": "#1e1e21",
          "border-accent": "#3f3f46",
        },
        // Text hierarchy
        ink: {
          primary: "#fafafa",
          secondary: "#a1a1aa",
          muted: "#71717a",
          disabled: "#52525b",
        },
        // Accent colors
        accent: {
          DEFAULT: "#22d3ee",
          hover: "#06b6d4",
          subtle: "#164e63",
          muted: "#083344",
        },
        // Semantic colors
        success: {
          DEFAULT: "#4ade80",
          subtle: "#14532d",
        },
        warning: {
          DEFAULT: "#fbbf24",
          subtle: "#451a03",
        },
        danger: {
          DEFAULT: "#f87171",
          subtle: "#450a0a",
        },
        // Token preview colors
        token: {
          color: "#8b5cf6",
          typography: "#f472b6",
          spacing: "#22d3ee",
          radius: "#fb923c",
          shadow: "#a78bfa",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        display: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      spacing: {
        18: "4.5rem",
        88: "22rem",
        112: "28rem",
        128: "32rem",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        glow: "0 0 20px rgba(34, 211, 238, 0.15)",
        "glow-sm": "0 0 10px rgba(34, 211, 238, 0.1)",
        inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.5)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-subtle": "pulseSubtle 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
};
