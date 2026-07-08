import { useState } from "react";
import { getToken } from "./core/api-client.js";
import { LoginScreen } from "./screens/LoginScreen.js";
import { TenantsScreen } from "./screens/TenantsScreen.js";

export function App() {
  const [loggedIn, setLoggedIn] = useState(() => getToken() !== null);

  if (!loggedIn) {
    return <LoginScreen onLoggedIn={() => setLoggedIn(true)} />;
  }

  return <TenantsScreen onLogout={() => setLoggedIn(false)} />;
}
