type Tone = "success" | "danger" | "neutral" | "brand";

const TONE_STYLES: Record<Tone, React.CSSProperties> = {
  success: { background: "rgba(34,197,94,0.12)", color: "#16a34a" },
  danger: { background: "rgba(239,68,68,0.1)", color: "var(--color-danger)" },
  neutral: { background: "var(--color-gray-100)", color: "var(--color-gray-600)" },
  brand: { background: "rgba(48,107,52,0.1)", color: "var(--color-brand)" },
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
        ...TONE_STYLES[tone],
      }}
    >
      {children}
    </span>
  );
}
