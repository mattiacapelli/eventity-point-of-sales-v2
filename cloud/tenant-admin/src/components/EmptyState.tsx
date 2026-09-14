export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ textAlign: "center", color: "var(--color-gray-400)", padding: "var(--sp-lg) 0", fontSize: "var(--text-sm)" }}>
      {children}
    </div>
  );
}
