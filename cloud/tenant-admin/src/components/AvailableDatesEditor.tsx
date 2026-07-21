import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

const WEEKDAY_LABELS = ["L", "M", "M", "G", "V", "S", "D"];
const MONTH_FORMATTER = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

export function AvailableDatesEditor({ dates, onChange, onClose }: {
  dates: string[];
  onChange: (dates: string[]) => void;
  onClose: () => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const selected = new Set(dates);
  const monthDays = daysInMonth(viewYear, viewMonth);
  const leadingBlanks = (monthDays[0]!.getDay() + 6) % 7; // Monday-first

  function toggleDate(iso: string) {
    const next = new Set(selected);
    if (next.has(iso)) next.delete(iso);
    else next.add(iso);
    onChange([...next].sort());
  }

  function changeMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute", zIndex: 50, marginTop: "4px",
        background: "var(--color-white)", border: "1px solid var(--color-gray-200)",
        borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-md)",
        padding: "var(--sp-md)", width: "260px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <button onClick={() => changeMonth(-1)} aria-label="Mese precedente" style={{ padding: "4px" }}>
          <ChevronLeftIcon width={16} height={16} />
        </button>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, textTransform: "capitalize" }}>
          {MONTH_FORMATTER.format(new Date(viewYear, viewMonth, 1))}
        </span>
        <button onClick={() => changeMonth(1)} aria-label="Mese successivo" style={{ padding: "4px" }}>
          <ChevronRightIcon width={16} height={16} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "4px" }}>
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: "var(--text-xs)", color: "var(--color-gray-400)", fontWeight: 700 }}>{w}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
        {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b${i}`} />)}
        {monthDays.map((d) => {
          const iso = toIso(d);
          const isSelected = selected.has(iso);
          return (
            <button
              key={iso}
              onClick={() => toggleDate(iso)}
              style={{
                aspectRatio: "1", borderRadius: "var(--radius-sm)",
                background: isSelected ? "var(--color-brand)" : "transparent",
                color: isSelected ? "var(--color-white)" : "var(--color-gray-700)",
                fontSize: "var(--text-xs)", fontWeight: isSelected ? 700 : 500,
              }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--sp-sm)", paddingTop: "var(--sp-sm)", borderTop: "1px solid var(--color-gray-100)" }}>
        <button
          onClick={() => onChange([])}
          disabled={dates.length === 0}
          style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)", fontWeight: 600, opacity: dates.length === 0 ? 0.4 : 1 }}
        >
          Sempre visibile
        </button>
        <button onClick={onClose} style={{ fontSize: "var(--text-xs)", color: "var(--color-brand)", fontWeight: 700 }}>
          Chiudi
        </button>
      </div>
    </div>
  );
}
