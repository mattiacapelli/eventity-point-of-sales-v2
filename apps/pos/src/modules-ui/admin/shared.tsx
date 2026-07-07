import React from "react";

export const tableHeaderStyle: React.CSSProperties = {
  padding: "10px 16px",
  textAlign: "left",
  fontSize: "var(--text-xs)",
  fontWeight: 700,
  color: "var(--color-gray-500)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  borderBottom: "1px solid var(--color-gray-200)",
  background: "var(--color-gray-50)",
};

export const tableCellStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "var(--text-sm)",
  color: "var(--color-gray-700)",
  borderBottom: "1px solid var(--color-gray-100)",
  verticalAlign: "middle",
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "44px",
  padding: "0 14px",
  borderRadius: "var(--radius-lg)",
  border: "2px solid var(--color-gray-200)",
  fontSize: "var(--text-md)",
  fontFamily: "var(--font)",
  color: "var(--color-gray-800)",
  background: "var(--color-white)",
  outline: "none",
  boxSizing: "border-box",
};

export const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  color: "var(--color-gray-600)",
  marginBottom: "6px",
};

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: "42px", height: "24px", borderRadius: "12px", border: "none",
        background: value ? "var(--color-brand)" : "var(--color-gray-300)",
        cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: "3px", left: value ? "20px" : "3px",
        width: "18px", height: "18px", borderRadius: "50%",
        background: "var(--color-white)", transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}
