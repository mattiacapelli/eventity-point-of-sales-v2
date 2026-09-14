export function SettingsCard({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "var(--color-white)",
        border: "1px solid var(--color-gray-200)",
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-gray-100)" }}>
        <div style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--color-gray-900)" }}>{title}</div>
        {description && (
          <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", marginTop: "3px" }}>{description}</div>
        )}
      </div>
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "var(--sp-md)" }}>
        {children}
      </div>
    </section>
  );
}
