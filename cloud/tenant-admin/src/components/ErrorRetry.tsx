import { Button } from "./Button.js";

export function ErrorRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-sm)", alignItems: "flex-start" }}>
      <span style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>{message}</span>
      <Button variant="secondary" onClick={onRetry}>Riprova</Button>
    </div>
  );
}
