import { createContext, useCallback, useContext, useState } from "react";

type ToastKind = "success" | "error";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{ position: "fixed", bottom: "var(--sp-lg)", right: "var(--sp-lg)", display: "flex", flexDirection: "column", gap: "8px", zIndex: 200 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              padding: "12px 18px",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-md)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              color: "var(--color-white)",
              background: t.kind === "success" ? "var(--color-brand)" : "var(--color-danger)",
              maxWidth: "320px",
              animation: "toast-in 0.25s ease",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
