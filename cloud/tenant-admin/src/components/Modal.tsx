export function Modal({ onClose, children, maxWidth = "420px" }: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17,24,39,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--sp-lg)",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          background: "var(--color-white)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-lg)",
          padding: "var(--sp-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-md)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}
