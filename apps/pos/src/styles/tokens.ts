export const tokens = {
  color: {
    brand:        "#306B34",
    brandDark:    "#234E26",
    brandLight:   "#3D8A42",
    accent:       "#C2E812",
    accentDark:   "#A5C60F",

    // Neutrals
    white:        "#FFFFFF",
    gray50:       "#F9FAFB",
    gray100:      "#F3F4F6",
    gray200:      "#E5E7EB",
    gray300:      "#D1D5DB",
    gray400:      "#9CA3AF",
    gray500:      "#6B7280",
    gray600:      "#4B5563",
    gray700:      "#374151",
    gray800:      "#1F2937",
    gray900:      "#111827",

    // Semantic
    success:      "#22C55E",
    warning:      "#F59E0B",
    danger:       "#EF4444",
    info:         "#3B82F6",

    // Status badges
    pending:      "#F59E0B",
    confirmed:    "#3B82F6",
    preparing:    "#8B5CF6",
    ready:        "#22C55E",
    completed:    "#6B7280",
    cancelled:    "#EF4444",
  },

  radius: {
    sm:    "8px",
    md:    "12px",
    lg:    "20px",
    xl:    "28px",
    pill:  "999px",
  },

  spacing: {
    xs:   "4px",
    sm:   "8px",
    md:   "16px",
    lg:   "24px",
    xl:   "32px",
    xxl:  "48px",
  },

  font: {
    family: "'Lexend', sans-serif",
    size: {
      xs:   "11px",
      sm:   "13px",
      md:   "15px",
      lg:   "18px",
      xl:   "22px",
      xxl:  "28px",
      hero: "36px",
    },
    weight: {
      light:   300,
      regular: 400,
      medium:  500,
      semibold: 600,
      bold:    700,
    },
  },

  shadow: {
    sm:  "0 1px 3px rgba(0,0,0,0.08)",
    md:  "0 4px 16px rgba(0,0,0,0.08)",
    lg:  "0 8px 32px rgba(0,0,0,0.12)",
    brand: "0 4px 20px rgba(48,107,52,0.25)",
  },

  transition: "150ms ease",

  touch: {
    minTarget: "44px",
    minTargetLg: "56px",
  },
} as const;

export type Tokens = typeof tokens;
