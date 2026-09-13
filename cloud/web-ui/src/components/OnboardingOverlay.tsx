import { ClipboardDocumentListIcon, CheckCircleIcon, QrCodeIcon } from "@heroicons/react/24/outline";
import { Button } from "./Button.js";

const STEPS = [
  { Icon: ClipboardDocumentListIcon, title: "Scegli i piatti dal menu", description: "Sfoglia le categorie e aggiungi al carrello quello che vuoi ordinare." },
  { Icon: CheckCircleIcon, title: "Conferma il tuo ordine", description: "Controlla il riepilogo e conferma: l'ordine viene inviato alla cassa." },
  { Icon: QrCodeIcon, title: "Mostra il QR in cassa", description: "Mostra il codice generato per pagare e ritirare lo scontrino." },
];

export function OnboardingOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "480px",
          background: "var(--color-white)", borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
          display: "flex", flexDirection: "column",
          animation: "fade-in 0.2s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: "36px", height: "4px", borderRadius: "var(--radius-pill)", background: "var(--color-gray-200)" }} />
        </div>

        <div style={{ padding: "var(--sp-lg)", display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, textAlign: "center" }}>
            Come funziona
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-md)" }}>
            {STEPS.map(({ Icon, title, description }, i) => (
              <div key={i} style={{ display: "flex", gap: "var(--sp-md)", alignItems: "flex-start" }}>
                <div
                  style={{
                    flexShrink: 0, width: "40px", height: "40px", borderRadius: "50%",
                    background: "rgba(48,107,52,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Icon width={20} height={20} color="var(--color-brand)" />
                </div>
                <div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-900)" }}>{title}</div>
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", marginTop: "2px" }}>{description}</div>
                </div>
              </div>
            ))}
          </div>

          <Button onClick={onClose}>Ho capito</Button>
        </div>
      </div>
    </div>
  );
}
