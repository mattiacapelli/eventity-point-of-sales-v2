import type { ComponentType, SVGProps } from "react";

export function StatCard({ label, value, Icon, accent }: { label: string; value: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; accent?: boolean }) {
  if (accent) {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-dark) 100%)",
          borderRadius: "var(--radius-md)", padding: "var(--sp-md)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center",
        }}
      >
        <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon width={16} height={16} color="var(--color-white)" />
        </div>
        <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-white)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
        <div style={{ fontSize: "var(--text-xs)", color: "rgba(255,255,255,0.85)" }}>{label}</div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", padding: "var(--sp-md)", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center" }}>
      <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--color-brand-wash)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon width={16} height={16} color="var(--color-brand)" />
      </div>
      <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-brand)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)" }}>{label}</div>
    </div>
  );
}

export function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", fontSize: "var(--text-sm)", color: "var(--color-gray-700)" }}>
      <span style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, background: ok ? "var(--color-brand)" : "var(--color-danger)" }} />
      {label}
    </div>
  );
}
