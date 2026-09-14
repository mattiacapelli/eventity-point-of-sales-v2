import type { ButtonHTMLAttributes } from "react";

type Variant = "plain" | "outline" | "danger";

const VARIANT_CLASS: Record<Variant, string> = {
  plain: "icon-btn",
  outline: "icon-btn icon-btn--outline",
  danger: "icon-btn icon-btn--danger",
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  "aria-label": string;
}

/** Single style for every icon-only button (table row actions, popover triggers, toolbar controls). */
export function IconButton({ variant = "plain", className, style, ...rest }: IconButtonProps) {
  return (
    <button
      className={[VARIANT_CLASS[variant], className].filter(Boolean).join(" ")}
      style={style}
      {...rest}
    />
  );
}
