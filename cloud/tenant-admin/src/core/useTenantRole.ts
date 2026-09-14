import { useEffect, useState } from "react";
import type { CurrentUser, Tenant, TenantUserRole } from "./types.js";
import { listTenantUsers } from "./api-client.js";

/** Resolves the current user's write access on a tenant (super-admin or owner membership). */
export function useTenantCanWrite(tenant: Tenant | null, currentUser: CurrentUser): boolean {
  const [membershipRole, setMembershipRole] = useState<TenantUserRole | null>(null);

  useEffect(() => {
    if (!tenant || currentUser.isSuperAdmin) return;
    listTenantUsers(tenant.id)
      .then((rows) => {
        const mine = rows.find((u) => u.userId === currentUser.id);
        setMembershipRole(mine?.role ?? null);
      })
      .catch(() => setMembershipRole(null));
  }, [tenant?.id]);

  if (!tenant) return false;
  return currentUser.isSuperAdmin || membershipRole === "owner";
}
