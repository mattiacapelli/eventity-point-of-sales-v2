import { useEffect, useState } from "react";
import { clearToken, getMe, getToken, setOnSessionExpired } from "./core/api-client.js";
import type { CurrentUser } from "./core/types.js";
import { LoginScreen } from "./screens/LoginScreen.js";
import { TenantsScreen } from "./screens/TenantsScreen.js";
import { ProfileScreen } from "./screens/ProfileScreen.js";
import { Sidebar, type Section } from "./components/Sidebar.js";

export function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(() => getToken() !== null);
  const [activeSection, setActiveSection] = useState<Section>("tenants");

  useEffect(() => {
    setOnSessionExpired(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    if (getToken() === null) {
      setLoading(false);
      return;
    }
    getMe()
      .then(setCurrentUser)
      .catch(() => {
        clearToken();
        setCurrentUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleLogout() {
    clearToken();
    setCurrentUser(null);
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-gray-400)" }}>
        Caricamento...
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLoggedIn={(user) => setCurrentUser(user)} />;
  }

  return (
    <div style={{ flex: 1, display: "flex" }}>
      <Sidebar currentUser={currentUser} active={activeSection} onSelect={setActiveSection} />
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        {activeSection === "tenants" && <TenantsScreen currentUser={currentUser} />}
        {activeSection === "profile" && <ProfileScreen currentUser={currentUser} onLogout={handleLogout} />}
      </div>
    </div>
  );
}
