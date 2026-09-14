export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-lg)", overflowX: "auto", overflowY: "hidden" }}>
      <table style={{ width: "100%", minWidth: "560px", borderCollapse: "collapse" }}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr style={{ background: "var(--color-gray-50)", borderBottom: "1px solid var(--color-gray-200)" }}>
        {children}
      </tr>
    </thead>
  );
}

export function Th({ children, align, width }: { children?: React.ReactNode; align?: "left" | "right" | "center"; width?: string }) {
  return (
    <th
      style={{
        padding: "10px 12px",
        textAlign: align ?? "left",
        width,
        fontSize: "var(--text-xs)",
        fontWeight: 700,
        color: "var(--color-gray-500)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

export function Tr({ children }: { children: React.ReactNode }) {
  return (
    <tr style={{ borderBottom: "1px solid var(--color-gray-100)" }}>
      {children}
    </tr>
  );
}

export function Td({ children, align }: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <td style={{ padding: "8px 12px", textAlign: align ?? "left", fontSize: "var(--text-sm)", verticalAlign: "middle" }}>
      {children}
    </td>
  );
}
