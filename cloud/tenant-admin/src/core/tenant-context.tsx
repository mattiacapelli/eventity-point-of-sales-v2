import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Tenant } from "./types.js";

/** Lets the currently-open tenant detail page tell the sidebar its name/slug, without prop-drilling through the router. */
interface ActiveTenantContextValue {
  tenant: Tenant | null;
  setTenant: (tenant: Tenant | null) => void;
}

const ActiveTenantContext = createContext<ActiveTenantContextValue | null>(null);

export function ActiveTenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenantState] = useState<Tenant | null>(null);
  const setTenant = useCallback((t: Tenant | null) => setTenantState(t), []);
  return (
    <ActiveTenantContext.Provider value={{ tenant, setTenant }}>
      {children}
    </ActiveTenantContext.Provider>
  );
}

export function useActiveTenant(): ActiveTenantContextValue {
  const ctx = useContext(ActiveTenantContext);
  if (!ctx) throw new Error("useActiveTenant must be used within ActiveTenantProvider");
  return ctx;
}
