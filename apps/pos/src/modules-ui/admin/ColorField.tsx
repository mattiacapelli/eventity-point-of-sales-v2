import { labelStyle } from "./shared.js";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#1e293b",
];

export function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={labelStyle}>Colore</label>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(value === c ? "" : c)}
            title={c}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: c,
              border: value === c ? "3px solid var(--color-gray-800)" : "2px solid transparent",
              outline: value === c ? "2px solid var(--color-white)" : "none",
              outlineOffset: value === c ? "-4px" : "0",
              cursor: "pointer",
              flexShrink: 0,
              transition: "border 0.15s",
            }}
          />
        ))}
        <input
          type="color"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          title="Colore personalizzato"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            border: "2px solid var(--color-gray-300)",
            padding: 0,
            cursor: "pointer",
            background: "none",
          }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-gray-400)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            Rimuovi
          </button>
        )}
      </div>
    </div>
  );
}
