import React from "react";

interface GridProps {
  children: React.ReactNode;
  cols?: number;
  gap?: string;
  style?: React.CSSProperties;
}

export function Grid({ children, cols = 3, gap = "12px", style }: GridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
