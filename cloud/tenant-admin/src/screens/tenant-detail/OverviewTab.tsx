import { StatsPanel } from "./StatsPanel.js";
import type { Tenant } from "../../core/types.js";

export function OverviewTab({ tenant }: { tenant: Tenant }) {
  return <StatsPanel tenant={tenant} />;
}
