import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, icon, style, ...rest }: InputProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {label && (
        <label
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: "var(--color-gray-700)",
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: "relative" }}>
        {icon && (
          <span
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-gray-400)",
              display: "flex",
              alignItems: "center",
            }}
          >
            {icon}
          </span>
        )}
        <input
          style={{
            width: "100%",
            height: "52px",
            padding: icon ? "0 16px 0 44px" : "0 16px",
            borderRadius: "var(--radius-lg)",
            border: error ? "2px solid var(--color-danger)" : "2px solid var(--color-gray-200)",
            background: "var(--color-white)",
            fontFamily: "var(--font)",
            fontSize: "var(--text-md)",
            fontWeight: 500,
            color: "var(--color-gray-900)",
            outline: "none",
            transition: "border-color var(--transition)",
            ...style,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-brand)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error
              ? "var(--color-danger)"
              : "var(--color-gray-200)";
          }}
          {...rest}
        />
      </div>
      {error && (
        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", fontWeight: 500 }}>
          {error}
        </span>
      )}
    </div>
  );
}
