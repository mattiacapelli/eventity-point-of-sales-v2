type Tone = "success" | "danger" | "neutral" | "brand";

const TONE_STYLES: Record<Tone, React.CSSProperties> = {
  success: { background: "var(--color-brand-wash)", color: "var(--color-brand)" },
  danger: { background: "var(--color-danger-wash)", color: "var(--color-danger)" },
  neutral: { background: "var(--color-gray-100)", color: "var(--color-gray-600)" },
  brand: { background: "var(--color-brand-wash)", color: "var(--color-brand)" },
};

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: "var(--radius-pill)",
        fontSize: "var(--text-xs)",
        fontWeight: 700,
        display: "inline-block",
        whiteSpace: "nowrap",
        ...TONE_STYLES[tone],
      }}
    >
      {children}
    </span>
  );
}
