import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_STYLES: Record<Variant, React.CSSProperties> = {
  primary: { background: "var(--color-brand)", color: "var(--color-white)" },
  secondary: { background: "var(--color-white)", color: "var(--color-gray-700)", border: "1.5px solid var(--color-gray-200)" },
  danger: { background: "var(--color-danger)", color: "var(--color-white)" },
  ghost: { background: "transparent", color: "var(--color-gray-500)" },
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export function Button({ variant = "primary", loading = false, disabled, children, style, ...rest }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      style={{
        height: "40px",
        padding: "0 16px",
        borderRadius: "var(--radius-md)",
        fontWeight: 700,
        fontSize: "var(--text-sm)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        opacity: disabled || loading ? 0.6 : 1,
        whiteSpace: "nowrap",
        ...VARIANT_STYLES[variant],
        ...style,
      }}
      {...rest}
    >
      {loading ? "..." : children}
    </button>
  );
}
