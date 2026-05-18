import { authClient } from "./auth-client.js";
import { wsClient } from "./ws-client.js";
import { useStore } from "../state/global-store.js";

/**
 * Called once at app mount. Restores session from localStorage and
 * wires the offline/online listeners.
 */
export async function bootstrap(): Promise<boolean> {
  // Offline listeners
  window.addEventListener("online",  () => useStore.getState().setOffline(false));
  window.addEventListener("offline", () => useStore.getState().setOffline(true));

  const token = authClient.getStoredToken();
  if (!token) return false;

  try {
    const me = await authClient.me(token);
    useStore.getState().setSession({
      token,
      userId: me.userId,
      role: me.role,
      username: me.username,
    });

    wsClient.connect(`ws://${window.location.host}/ws`, token);
    return true;
  } catch {
    authClient.clearToken();
    return false;
  }
}
