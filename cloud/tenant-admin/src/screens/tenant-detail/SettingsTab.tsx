import { DangerZone } from "./DangerZone.js";

export function SettingsTab({ tenantId, tenantName, onDeleted }: {
  tenantId: string;
  tenantName: string;
  onDeleted: (id: string) => void;
}) {
  return <DangerZone tenantId={tenantId} tenantName={tenantName} onDeleted={onDeleted} />;
}
