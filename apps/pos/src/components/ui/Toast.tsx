import React from "react";
import { create } from "zustand";

type ToastVariant = "success" | "error";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastStore {
  toasts: ToastItem[];
  show: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (message, variant = "error") => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

const VARIANT_STYLES: Record<ToastVariant, { background: string; color: string }> = {
  success: { background: "var(--color-success, #059669)", color: "#fff" },
  error: { background: "var(--color-danger, #dc2626)", color: "#fff" },
};

export function ToastHost() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        maxWidth: "360px",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          style={{
            ...VARIANT_STYLES[t.variant],
            padding: "12px 16px",
            borderRadius: "var(--radius-lg, 10px)",
            boxShadow: "var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.2))",
            fontFamily: "var(--font)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            cursor: "pointer",
            transition: "transform 180ms ease, opacity 180ms ease",
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
