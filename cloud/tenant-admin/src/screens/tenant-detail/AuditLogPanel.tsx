import { useEffect, useState } from "react";
import type { AuditLogEntry, Paginated } from "../../core/types.js";
import { fetchAuditLog } from "../../core/api-client.js";
import { ErrorRetry } from "../../components/ErrorRetry.js";
import { EmptyState } from "../../components/EmptyState.js";
import { Table, TableHead, Th, Tr, Td } from "../../components/Table.js";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("it-IT");
}

function formatMetadata(json: string | null): string {
  if (!json) return "—";
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    return Object.entries(obj).map(([k, v]) => `${k}: ${String(v)}`).join(", ");
  } catch {
    return "—";
  }
}

export function AuditLogPanel({ tenantId, onCountChange }: {
  tenantId: string;
  onCountChange?: (total: number) => void;
}) {
  const [auditPage, setAuditPage] = useState<Paginated<AuditLogEntry> | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  function loadAudit() {
    setAuditError(null);
    fetchAuditLog(tenantId)
      .then((page) => {
        setAuditPage(page);
        onCountChange?.(page.total);
      })
      .catch((err) => setAuditError(err instanceof Error ? err.message : "Impossibile caricare l'audit log"));
  }

  useEffect(loadAudit, [tenantId]);

  return (
    <div>
      {auditError ? (
        <ErrorRetry message={auditError} onRetry={loadAudit} />
      ) : !auditPage ? (
        <EmptyState>Caricamento...</EmptyState>
      ) : auditPage.items.length === 0 ? (
        <EmptyState>Nessuna azione registrata</EmptyState>
      ) : (
        <Table>
          <TableHead>
            <Th width="200px">Azione</Th>
            <Th>Dettagli</Th>
            <Th width="160px" align="right">Data</Th>
          </TableHead>
          <tbody>
            {auditPage.items.map((entry) => (
              <Tr key={entry.id}>
                <Td>
                  <code style={{ fontWeight: 600 }}>{entry.action}</code>
                </Td>
                <Td>
                  <span style={{ color: "var(--color-gray-500)" }}>{formatMetadata(entry.metadataJson)}</span>
                </Td>
                <Td align="right">
                  <span style={{ color: "var(--color-gray-500)", whiteSpace: "nowrap" }}>{formatDate(entry.createdAt)}</span>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
