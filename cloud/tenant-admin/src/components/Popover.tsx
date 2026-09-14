import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Align = "start" | "end";

export function Popover({ anchorRef, onClose, align = "end", width = 260, children }: {
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  align?: Align;
  width?: number;
  children: React.ReactNode;
}) {
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const rawLeft = align === "end" ? rect.right - width : rect.left;
    const left = Math.min(Math.max(8, rawLeft), window.innerWidth - width - 8);
    setPos({ top: rect.bottom + 8, left });
  }, [anchorRef, align, width]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, anchorRef]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={popRef}
      className="popover-surface"
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 500, width: `${width}px` }}
    >
      {children}
    </div>,
    document.body,
  );
}
