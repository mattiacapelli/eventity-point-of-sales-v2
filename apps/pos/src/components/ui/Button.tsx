import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size    = "sm" | "md" | "lg" | "xl";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "var(--color-brand)",
    color: "var(--color-white)",
    boxShadow: "var(--shadow-brand)",
  },
  secondary: {
    background: "var(--color-white)",
    color: "var(--color-brand)",
    border: "2px solid var(--color-brand)",
  },
  ghost: {
    background: "transparent",
    color: "var(--color-gray-700)",
    border: "2px solid var(--color-gray-200)",
  },
  danger: {
    background: "var(--color-danger)",
    color: "var(--color-white)",
  },
  accent: {
    background: "var(--color-accent)",
    color: "var(--color-gray-900)",
  },
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { height: "36px",  padding: "0 14px", fontSize: "var(--text-sm)", borderRadius: "var(--radius-md)" },
  md: { height: "44px",  padding: "0 20px", fontSize: "var(--text-md)", borderRadius: "var(--radius-lg)" },
  lg: { height: "56px",  padding: "0 28px", fontSize: "var(--text-lg)", borderRadius: "var(--radius-lg)" },
  xl: { height: "68px",  padding: "0 36px", fontSize: "var(--text-xl)", borderRadius: "var(--radius-lg)" },
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  icon,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        fontFamily: "var(--font)",
        fontWeight: 600,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.5 : 1,
        transition: "var(--transition)",
        width: fullWidth ? "100%" : undefined,
        whiteSpace: "nowrap",
        flexShrink: 0,
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      style={{
        width: "18px",
        height: "18px",
        border: "2px solid rgba(255,255,255,0.3)",
        borderTopColor: "currentColor",
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
        display: "inline-block",
      }}
    />
  );
}
