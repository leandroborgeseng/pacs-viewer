/**
 * Tokens de design Aion Imaging — portal + overrides OHIF (referência TS).
 * Cores alinhadas com globals.css (.dark / marca).
 */
export const aion = {
  brand: {
    name: "Aion Imaging",
    tagline: "Enterprise imaging",
  },
  colors: {
    primary: "#0066B2",
    primaryHover: "#0078CC",
    primaryMuted: "rgba(0, 102, 178, 0.15)",
    accent: "#FF4F00",
    accentMuted: "rgba(255, 79, 0, 0.12)",
    background: "#0B1120",
    surface: "#111827",
    surfaceElevated: "rgba(17, 24, 39, 0.72)",
    border: "#1F2937",
    text: "#E5E7EB",
    textMuted: "#9CA3AF",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
  },
  radii: {
    sm: "0.375rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    full: "9999px",
  },
  font: {
    sans: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
  },
} as const;
