import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { style, className, ...rest } = props;
  return (
    <input
      className={["input-field", className].filter(Boolean).join(" ")}
      style={{
        width: "100%",
        height: "42px",
        padding: "0 14px",
        borderRadius: "var(--radius-md)",
        border: "1.5px solid var(--color-gray-200)",
        fontSize: "var(--text-sm)",
        ...style,
      }}
      {...rest}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { style, children, className, ...rest } = props;
  return (
    <select
      className={["input-field", className].filter(Boolean).join(" ")}
      style={{
        width: "100%",
        height: "42px",
        padding: "0 14px",
        borderRadius: "var(--radius-md)",
        border: "1.5px solid var(--color-gray-200)",
        fontSize: "var(--text-sm)",
        background: "var(--color-white)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </select>
  );
}
