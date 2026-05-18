import React from "react";

interface CardProps {
  children: React.ReactNode;
  variant?: "light" | "dark" | "brand";
  padding?: "none" | "sm" | "md" | "lg";
  radius?: "md" | "lg" | "xl";
  shadow?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

const paddingMap = { none: "0", sm: "12px", md: "20px", lg: "28px" };
const radiusMap  = { md: "var(--radius-md)", lg: "var(--radius-lg)", xl: "var(--radius-xl)" };

const variantStyles: Record<"light" | "dark" | "brand", React.CSSProperties> = {
  light: {
    background: "var(--color-white)",
    color: "var(--color-gray-900)",
  },
  dark: {
    background: "var(--color-gray-800)",
    color: "var(--color-white)",
  },
  brand: {
    background: "var(--color-brand)",
    color: "var(--color-white)",
  },
};

export function Card({
  children,
  variant = "light",
  padding = "md",
  radius = "lg",
  shadow = true,
  onClick,
  style,
  className,
}: CardProps) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        padding: paddingMap[padding],
        borderRadius: radiusMap[radius],
        boxShadow: shadow ? "var(--shadow-md)" : "none",
        cursor: onClick ? "pointer" : undefined,
        transition: onClick ? "var(--transition)" : undefined,
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </div>
  );
}
