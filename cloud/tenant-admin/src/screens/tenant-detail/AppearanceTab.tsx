import type { Tenant } from "../../core/types.js";
import { BrandingPanel } from "./BrandingPanel.js";
import { MenuImportPanel } from "./MenuImportPanel.js";

export function AppearanceTab({ tenant, onUpdated }: {
  tenant: Tenant;
  onUpdated: (t: Tenant) => void;
}) {
  return (
    <>
      <BrandingPanel tenant={tenant} onUpdated={onUpdated} />
      <MenuImportPanel tenantId={tenant.id} onImported={() => {}} />
    </>
  );
}
