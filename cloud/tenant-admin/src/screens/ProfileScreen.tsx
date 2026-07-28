import { UserCircleIcon } from "@heroicons/react/24/outline";
import type { CurrentUser } from "../core/types.js";
import { Button } from "../components/Button.js";
import { Badge } from "../components/Badge.js";

export function ProfileScreen({ currentUser, onLogout }: { currentUser: CurrentUser; onLogout: () => void }) {
  return (
    <div style={{ maxWidth: "480px", padding: "var(--sp-lg)" }}>
      <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--sp-lg)" }}>Il mio profilo</div>

      <div
        style={{
          background: "var(--color-white)",
          border: "1px solid var(--color-gray-100)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          padding: "var(--sp-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-md)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-md)" }}>
          <div
            style={{
              width: "48px", height: "48px", borderRadius: "50%",
              background: "rgba(48,107,52,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <UserCircleIcon width={26} height={26} color="var(--color-brand)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "var(--text-md)", fontWeight: 700, wordBreak: "break-all" }}>{currentUser.email}</div>
            <div style={{ marginTop: "4px" }}>
              <Badge tone={currentUser.isSuperAdmin ? "brand" : "neutral"}>
                {currentUser.isSuperAdmin ? "Super-admin" : "Utente"}
              </Badge>
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--color-gray-100)", paddingTop: "var(--sp-md)" }}>
          <Button variant="secondary" onClick={onLogout}>Esci</Button>
        </div>
      </div>
    </div>
  );
}
