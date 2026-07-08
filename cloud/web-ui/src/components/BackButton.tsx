export function BackButton({ onClick, dark }: { onClick: () => void; dark?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label="Indietro"
      style={{
        position: "absolute",
        top: "calc(var(--sp-lg) + var(--safe-top))",
        left: "var(--sp-lg)",
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        background: dark ? "var(--color-gray-100)" : "rgba(255,255,255,0.18)",
        color: dark ? "var(--color-gray-700)" : "var(--color-white)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "var(--text-lg)",
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      ←
    </button>
  );
}
