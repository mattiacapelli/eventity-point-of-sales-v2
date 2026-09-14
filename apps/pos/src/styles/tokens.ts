export const tokens = {
  color: {
    brand:        "#17663C",
    brandDark:    "#0F3D25",
    brandLight:   "#8FB79F",
    accent:       "#17663C",
    accentDark:   "#0F3D25",

    // Neutrals
    white:        "#FFFFFF",
    gray50:       "#F7F9F7",
    gray100:      "#F4F6F3",
    gray200:      "#E2E7E1",
    gray300:      "#D3DAD3",
    gray400:      "#A3AFA7",
    gray500:      "#8B978E",
    gray600:      "#7C8A81",
    gray700:      "#6B7A70",
    gray800:      "#37493E",
    gray900:      "#10281C",

    // Semantic
    success:      "#17663C",
    warning:      "#C98A16",
    danger:       "#9A2C22",
    info:         "#3B82F6",

    // Status badges
    pending:      "#C98A16",
    confirmed:    "#3B82F6",
    preparing:    "#8B5CF6",
    ready:        "#17663C",
    completed:    "#6B7280",
    cancelled:    "#9A2C22",
  },

  radius: {
    sm:    "9px",
    md:    "12px",
    lg:    "16px",
    xl:    "20px",
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
    family: "'Archivo', Helvetica, sans-serif",
    size: {
      xs:   "12px",
      sm:   "14px",
      md:   "15px",
      lg:   "18px",
      xl:   "22px",
      xxl:  "28px",
      hero: "36px",
    },
    weight: {
      light:   400,
      regular: 400,
      medium:  500,
      semibold: 600,
      bold:    700,
    },
  },

  shadow: {
    sm:  "0 1px 3px rgba(16,40,28,0.08)",
    md:  "0 4px 16px rgba(16,40,28,0.08)",
    lg:  "0 8px 32px rgba(16,40,28,0.12)",
    brand: "0 4px 20px rgba(23,102,60,0.25)",
  },

  transition: "150ms ease",

  touch: {
    minTarget: "44px",
    minTargetLg: "56px",
  },
} as const;

export type Tokens = typeof tokens;
