import { useEffect, useState } from "react";
import type { CurrentUser, TenantUser, TenantUserRole } from "../../core/types.js";
import { listTenantUsers, inviteTenantUser, removeTenantUser, updateTenantUserRole } from "../../core/api-client.js";
import { Button } from "../../components/Button.js";
import { Badge } from "../../components/Badge.js";
import { Input, Select } from "../../components/Input.js";
import { ConfirmDialog } from "../../components/ConfirmDialog.js";
import { ErrorRetry } from "../../components/ErrorRetry.js";
import { EmptyState } from "../../components/EmptyState.js";
import { Table, TableHead, Th, Tr, Td } from "../../components/Table.js";
import { useToast } from "../../components/Toast.js";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("it-IT");
}

export function UsersPanel({ tenantId, currentUser, canManageUsers, onCountChange }: {
  tenantId: string;
  currentUser: CurrentUser;
  canManageUsers: boolean;
  onCountChange?: (count: number) => void;
}) {
  const { showToast } = useToast();
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TenantUserRole>("operator");
  const [inviting, setInviting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TenantUser | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);

  function loadUsers() {
    setUsersError(null);
    listTenantUsers(tenantId)
      .then((rows) => {
        setTenantUsers(rows);
        onCountChange?.(rows.length);
      })
      .catch((err) => setUsersError(err instanceof Error ? err.message : "Impossibile caricare gli utenti"));
  }

  useEffect(loadUsers, [tenantId]);

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const result = await inviteTenantUser(tenantId, inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      loadUsers();
      showToast(
        result.tempPassword
          ? `Utente creato. Password temporanea: ${result.tempPassword}`
          : `${result.email} aggiunto come ${result.role}`,
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile invitare l'utente", "error");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveUser(user: TenantUser) {
    await removeTenantUser(tenantId, user.userId);
    setTenantUsers((prev) => {
      const next = prev.filter((u) => u.id !== user.id);
      onCountChange?.(next.length);
      return next;
    });
    showToast(`${user.email} rimosso dal tenant`);
  }

  async function handleRoleChange(user: TenantUser, role: TenantUserRole) {
    if (role === user.role) return;
    setChangingRoleId(user.id);
    try {
      await updateTenantUserRole(tenantId, user.userId, role);
      setTenantUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)));
      showToast(`${user.email} ora è ${role}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile aggiornare il ruolo", "error");
    } finally {
      setChangingRoleId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-md)" }}>
      {canManageUsers && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email da invitare"
            type="email"
            style={{ flex: 1, minWidth: "200px" }}
          />
          <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as TenantUserRole)} style={{ width: "140px" }}>
            <option value="operator">Operator</option>
            <option value="owner">Owner</option>
          </Select>
          <Button onClick={() => void handleInvite()} loading={inviting} disabled={!inviteEmail.trim()}>
            Invita
          </Button>
        </div>
      )}

      {usersError ? (
        <ErrorRetry message={usersError} onRetry={loadUsers} />
      ) : tenantUsers.length === 0 ? (
        <EmptyState>Nessun utente associato</EmptyState>
      ) : (
        <Table>
          <TableHead>
            <Th>Email</Th>
            <Th width="140px">Ruolo</Th>
            <Th width="110px">Da</Th>
            <Th width="90px" align="right">Azioni</Th>
          </TableHead>
          <tbody>
            {tenantUsers.map((u) => {
              const canEditThis = canManageUsers && (currentUser.isSuperAdmin || u.role !== "owner");
              return (
                <Tr key={u.id}>
                  <Td>
                    <span style={{ fontWeight: 600 }}>{u.email}</span>
                  </Td>
                  <Td>
                    {canEditThis ? (
                      <Select
                        value={u.role}
                        onChange={(e) => void handleRoleChange(u, e.target.value as TenantUserRole)}
                        disabled={changingRoleId === u.id}
                        style={{ width: "auto", height: "28px", padding: "0 8px", fontSize: "var(--text-xs)" }}
                      >
                        <option value="operator">operator</option>
                        <option value="owner">owner</option>
                      </Select>
                    ) : (
                      <Badge tone={u.role === "owner" ? "brand" : "neutral"}>{u.role}</Badge>
                    )}
                  </Td>
                  <Td>
                    <span style={{ color: "var(--color-gray-500)" }}>{formatDate(u.createdAt)}</span>
                  </Td>
                  <Td align="right">
                    {canEditThis && (
                      <Button variant="ghost" onClick={() => setRemoveTarget(u)}>Rimuovi</Button>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {removeTarget && (
        <ConfirmDialog
          title="Rimuovi utente"
          description={`Confermi la rimozione di ${removeTarget.email} da questo tenant?`}
          confirmLabel="Rimuovi"
          onConfirm={async () => { await handleRemoveUser(removeTarget); setRemoveTarget(null); }}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
}
