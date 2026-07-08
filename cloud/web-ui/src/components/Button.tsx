import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline";
}

export function Button({ variant = "primary", disabled, style, children, ...rest }: ButtonProps) {
  const base = {
    width: "100%",
    padding: "16px",
    borderRadius: "var(--radius-lg)",
    fontSize: "var(--text-md)",
    fontWeight: 700,
    transition: "var(--transition)",
    opacity: disabled ? 0.5 : 1,
  };
  const variantStyle = variant === "primary"
    ? { background: "var(--color-brand)", color: "var(--color-white)" }
    : { background: "var(--color-white)", color: "var(--color-brand)", border: "2px solid var(--color-brand)" };

  return (
    <button
      disabled={disabled}
      style={{ ...base, ...variantStyle, ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}
