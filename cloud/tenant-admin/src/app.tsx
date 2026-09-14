import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { clearToken, getMe, getToken, setOnSessionExpired } from "./core/api-client.js";
import { ActiveTenantProvider } from "./core/tenant-context.js";
import type { CurrentUser } from "./core/types.js";
import { LoginScreen } from "./screens/LoginScreen.js";
import { TenantsScreen } from "./screens/TenantsScreen.js";
import { GlobalUsersScreen } from "./screens/GlobalUsersScreen.js";
import { ProfileScreen } from "./screens/ProfileScreen.js";
import { TenantDetailRoute } from "./screens/TenantDetailRoute.js";
import { Header } from "./components/Header.js";

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

  return (
    <ActiveTenantProvider>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
        <Header currentUser={currentUser} onLogout={handleLogout} />
        <Routes>
          <Route
            path="/tenants"
            element={
              <div className="scrollable" style={{ flex: 1, minHeight: 0, minWidth: 0, overflowX: "hidden", padding: "var(--sp-lg) var(--sp-xl)" }}>
                <TenantsScreen currentUser={currentUser} />
              </div>
            }
          />
          <Route path="/tenants/:id/:tab" element={<TenantDetailRoute currentUser={currentUser} />} />
          <Route path="/tenants/:id" element={<Navigate to="overview" replace />} />
          {currentUser.isSuperAdmin && (
            <Route
              path="/users"
              element={
                <div className="scrollable" style={{ flex: 1, minHeight: 0, minWidth: 0, overflowX: "hidden", padding: "var(--sp-lg) var(--sp-xl)" }}>
                  <GlobalUsersScreen />
                </div>
              }
            />
          )}
          <Route
            path="/profile"
            element={
              <div className="scrollable" style={{ flex: 1, minHeight: 0, minWidth: 0, overflowX: "hidden", padding: "var(--sp-lg) var(--sp-xl)" }}>
                <div style={{ maxWidth: "640px" }}>
                  <ProfileScreen currentUser={currentUser} onLogout={handleLogout} />
                </div>
              </div>
            }
          />
          <Route path="*" element={<Navigate to="/tenants" replace />} />
        </Routes>
      </div>
    </ActiveTenantProvider>
  );
}
