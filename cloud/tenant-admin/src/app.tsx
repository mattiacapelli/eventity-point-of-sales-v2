import { useEffect, useState } from "react";
import { clearToken, getMe, getToken, setOnSessionExpired } from "./core/api-client.js";
import type { CurrentUser } from "./core/types.js";
import { LoginScreen } from "./screens/LoginScreen.js";
import { TenantsScreen } from "./screens/TenantsScreen.js";

export function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(() => getToken() !== null);

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

  return <TenantsScreen currentUser={currentUser} onLogout={handleLogout} />;
}
