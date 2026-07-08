export function Footer() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "var(--sp-md) 0 calc(var(--sp-md) + var(--safe-bottom))",
        fontSize: "var(--text-xs)",
        color: "var(--color-gray-400)",
        flexShrink: 0,
      }}
    >
      Powered by eventity.app
    </div>
  );
}
