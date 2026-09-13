import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline";
  loading?: boolean;
}

export function Button({ variant = "primary", disabled, loading, style, children, ...rest }: ButtonProps) {
  const base = {
    width: "100%",
    padding: "16px",
    borderRadius: "var(--radius-lg)",
    fontSize: "var(--text-md)",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    opacity: disabled ? 0.5 : 1,
  };
  const variantStyle = variant === "primary"
    ? { background: "var(--color-brand)", color: "var(--color-white)" }
    : { background: "var(--color-white)", color: "var(--color-brand)", border: "2px solid var(--color-brand)" };

  return (
    <button
      className={variant === "primary" ? "btn-primary" : "btn-outline"}
      disabled={disabled || loading}
      style={{ ...base, ...variantStyle, ...style }}
      {...rest}
    >
      {loading && <span className="spinner" style={variant === "outline" ? { borderTopColor: "var(--color-brand)", borderColor: "rgba(48,107,52,0.25)" } : undefined} />}
      {children}
    </button>
  );
}
