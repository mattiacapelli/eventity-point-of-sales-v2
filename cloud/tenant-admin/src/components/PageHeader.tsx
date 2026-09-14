import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { IconButton } from "./IconButton.js";

export function PageHeader({ eyebrow, title, description, actions, showBack }: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  showBack?: boolean;
}) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "var(--sp-md)",
        marginBottom: "var(--sp-lg)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
        {showBack && (
          <IconButton
            variant="outline"
            aria-label="Indietro"
            onClick={() => navigate(-1)}
            style={{ width: "38px", height: "38px", marginTop: "2px" }}
          >
            <ArrowLeftIcon width={17} height={17} />
          </IconButton>
        )}
        <div>
          {eyebrow && (
            <span style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-brand)", marginBottom: "4px" }}>
              {eyebrow}
            </span>
          )}
          <h1 style={{ margin: 0, fontSize: "var(--text-display)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--color-gray-900)" }}>
            {title}
          </h1>
          {description && (
            <p style={{ margin: "5px 0 0", fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}
