import React, { useState, useEffect, useCallback } from "react";
import { PosLayout } from "../../layout/PosLayout.js";
import { Button } from "../../components/ui/Button.js";
import { Modal } from "../../components/ui/Modal.js";
import { useStore } from "../../state/global-store.js";
import { apiClient } from "../../core/api-client.js";
import { adminApi } from "../../core/admin-api.js";
import { downloadCsv } from "../../core/csv-export.js";
import type { Order, OrderStatus } from "@pos/shared-types";
import type { Shift, Terminal } from "@pos/shared-types";

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending:    { bg: "#f3f4f6", text: "#374151", label: "In attesa" },
  confirmed:  { bg: "#dbeafe", text: "#1d4ed8", label: "Confermato" },
  preparing:  { bg: "#fef3c7", text: "#92400e", label: "In preparazione" },
  ready:      { bg: "#d1fae5", text: "#065f46", label: "Pronto" },
  completed:  { bg: "#d1fae5", text: "#065f46", label: "Completato" },
  cancelled:  { bg: "#fee2e2", text: "#991b1b", label: "Annullato" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg: "#f3f4f6", text: "#374151", label: status };
  return (
    <span style={{
      padding: "3px 10px",
      borderRadius: "999px",
      background: s.bg,
      color: s.text,
      fontWeight: 600,
      fontSize: "12px",
    }}>
      {s.label}
    </span>
  );
}

// ─── Cancel confirm modal ─────────────────────────────────────────────────────

function CancelModal({
  order,
  onConfirm,
  onClose,
}: {
  order: Order | null;
  onConfirm: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  async function handleConfirm() {
    if (!order) return;
    setLoading(true);
    await onConfirm(order.id);
    setLoading(false);
    onClose();
  }

  return (
    <Modal open={order !== null} onClose={onClose} title="Annulla ordine">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-md)" }}>
        <p style={{ margin: 0, color: "var(--color-gray-700)", fontSize: "var(--text-sm)" }}>
          Confermi l'annullamento dell'ordine <strong>#{order?.id.slice(-6).toUpperCase() ?? ""}</strong>?
        </p>
        <input
          placeholder="Motivazione (opzionale)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{
            height: "44px",
            padding: "0 14px",
            borderRadius: "var(--radius-lg)",
            border: "2px solid var(--color-gray-200)",
            fontFamily: "var(--font)",
            fontSize: "var(--text-sm)",
          }}
        />
        <div style={{ display: "flex", gap: "var(--sp-sm)" }}>
          <Button variant="ghost" size="sm" onClick={onClose} style={{ flex: 1 }}>Annulla</Button>
          <Button variant="danger" size="sm" onClick={handleConfirm} loading={loading} style={{ flex: 1 }}>
            Conferma annullamento
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Refund modal ─────────────────────────────────────────────────────────────

function RefundModal({
  paymentId,
  amount,
  onConfirm,
  onClose,
}: {
  paymentId: string | null;
  amount: number;
  onConfirm: (paymentId: string, reason?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  async function handleConfirm() {
    if (!paymentId) return;
    setLoading(true);
    await onConfirm(paymentId, reason || undefined);
    setLoading(false);
    setReason("");
    onClose();
  }

  return (
    <Modal open={paymentId !== null} onClose={onClose} title="Rimborsa pagamento">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-md)" }}>
        <p style={{ margin: 0, color: "var(--color-gray-700)", fontSize: "var(--text-sm)" }}>
          Stai rimborsando <strong>€{amount.toFixed(2)}</strong>. Questa operazione è irreversibile.
        </p>
        <input
          placeholder="Motivazione (opzionale)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{
            height: "44px", padding: "0 14px",
            borderRadius: "var(--radius-lg)",
            border: "2px solid var(--color-gray-200)",
            fontFamily: "var(--font)", fontSize: "var(--text-sm)",
          }}
        />
        <div style={{ display: "flex", gap: "var(--sp-sm)" }}>
          <Button variant="ghost" size="sm" onClick={onClose} style={{ flex: 1 }}>Annulla</Button>
          <Button variant="danger" size="sm" onClick={handleConfirm} loading={loading} style={{ flex: 1 }}>
            Conferma rimborso
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Order row ────────────────────────────────────────────────────────────────

function OrderRow({
  order,
  isAdmin,
  onReprint,
  onReprintKitchen,
  onCancel,
  onRefund,
  receiptPrefix,
  receiptPadding,
  terminalName,
}: {
  order: Order;
  isAdmin: boolean;
  onReprint: (id: string) => void;
  onReprintKitchen: (id: string) => void;
  onCancel: (order: Order) => void;
  onRefund: (order: Order) => void;
  receiptPrefix: string;
  receiptPadding: number;
  terminalName?: string;
}) {
  const canCancel = isAdmin && order.status !== "completed" && order.status !== "cancelled";
  const canRefund = isAdmin && order.status === "completed";
  const itemSummary = order.items.length > 0
    ? order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")
    : "—";

  return (
    <div style={{
      background: "var(--color-white)",
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-gray-100)",
      padding: "var(--sp-md)",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--sp-sm)" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--color-gray-900)" }}>
            #{displayOrderNum(order, receiptPrefix, receiptPadding)}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginTop: "2px" }}>
            {new Date(order.createdAt).toLocaleString("it-IT")}
            {terminalName && ` · ${terminalName}`}
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-600)" }}>
        {itemSummary}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-brand)" }}>
          €{order.totalAmount.toFixed(2)}
        </span>
        <div style={{ display: "flex", gap: "var(--sp-sm)" }}>
          <Button size="sm" variant="ghost" onClick={() => onReprint(order.id)}>
            Scontrino
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onReprintKitchen(order.id)}
            style={{ color: "var(--color-gray-600)" }}>
            Comanda
          </Button>
          {canRefund && (
            <Button size="sm" variant="ghost" onClick={() => onRefund(order)}
              style={{ color: "#b45309", borderColor: "#fcd34d" }}>
              Rimborsa
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="danger" onClick={() => onCancel(order)}>
              Annulla
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

const ORDER_STATUSES: { value: string; label: string }[] = [
  { value: "", label: "Tutti" },
  { value: "pending", label: "In attesa" },
  { value: "confirmed", label: "Confermato" },
  { value: "preparing", label: "In preparazione" },
  { value: "ready", label: "Pronto" },
  { value: "completed", label: "Completato" },
  { value: "cancelled", label: "Annullato" },
];

const PAGE_SIZE = 50;

function displayOrderNum(order: Order, prefix: string, padding: number): string {
  if (order.receiptNumber !== undefined) {
    const padded = padding > 0 ? String(order.receiptNumber).padStart(padding, "0") : String(order.receiptNumber);
    return `${prefix}${padded}`;
  }
  return order.id.slice(-6).toUpperCase();
}

export function HistoryScreen() {
  const session = useStore((s) => s.session);
  const isAdmin = session?.role === "admin";

  const [receiptPrefix, setReceiptPrefix] = useState("");
  const [receiptPadding, setReceiptPadding] = useState(0);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterShiftId, setFilterShiftId] = useState("");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [filterTerminalId, setFilterTerminalId] = useState("");
  const [terminals, setTerminals] = useState<Terminal[]>([]);

  // Modals
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [refundOrder, setRefundOrder] = useState<{ paymentId: string; amount: number } | null>(null);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    adminApi.shifts.history().then(setShifts).catch(() => {});
    adminApi.terminals.list().then(setTerminals).catch(() => {});
    adminApi.settings.get().then((s) => {
      setReceiptPrefix(s.receiptNumberPrefix);
      setReceiptPadding(s.receiptNumberPadding);
    }).catch(() => {});
  }, []);

  const load = useCallback((currentOffset = 0, append = false) => {
    setLoading(true);
    setError(null);
    const filters: { status?: string; shiftId?: string; terminalId?: string; from?: number; to?: number; limit?: number; offset?: number } = {
      limit: PAGE_SIZE,
      offset: currentOffset,
    };
    if (filterStatus) filters.status = filterStatus;
    if (filterShiftId) filters.shiftId = filterShiftId;
    if (filterTerminalId) filters.terminalId = filterTerminalId;
    if (filterFrom) filters.from = new Date(filterFrom).getTime();
    if (filterTo) filters.to = new Date(filterTo + "T23:59:59").getTime();
    apiClient.orders.list(filters)
      .then((data) => {
        setOrders((prev) => append ? [...prev, ...data] : data);
        setHasMore(data.length === PAGE_SIZE);
        setOffset(currentOffset + data.length);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filterStatus, filterShiftId, filterTerminalId, filterFrom, filterTo]);

  useEffect(() => { load(0, false); }, [load]);

  function handleExportCsv() {
    downloadCsv(
      `ordini-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Data", "Numero scontrino", "Cassa", "Stato", "Totale", "Sconto", "Prodotti"],
      orders.map((o) => [
        new Date(o.createdAt).toLocaleString("it-IT"),
        o.receiptNumber ?? "",
        terminals.find((t) => t.id === o.terminalId)?.name ?? "",
        o.status,
        o.totalAmount.toFixed(2),
        o.discountAmount.toFixed(2),
        o.items.map((i) => `${i.quantity}x ${i.name}`).join("; "),
      ]),
    );
  }

  async function handleReprint(id: string) {
    try {
      await apiClient.orders.reprint(id);
      showToast("Ristampa inviata alla stampante", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Errore ristampa", "error");
    }
  }

  async function handleReprintKitchen(id: string) {
    try {
      await apiClient.orders.reprintKitchen(id);
      showToast("Comanda inviata alla stampante cucina", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Errore ristampa comanda", "error");
    }
  }

  async function handleCancel(id: string) {
    try {
      await apiClient.orders.cancel(id);
      showToast("Ordine annullato", "success");
      load(0, false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Errore annullamento", "error");
    }
  }

  async function handleRefundClick(order: Order) {
    try {
      const { payments: pmts } = await apiClient.payments.listByOrder(order.id);
      const completed = pmts.find((p) => p.status === "completed");
      if (!completed) { showToast("Nessun pagamento rimborsabile trovato", "error"); return; }
      setRefundOrder({ paymentId: completed.id, amount: completed.amount });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Errore", "error");
    }
  }

  async function handleRefundConfirm(paymentId: string, reason?: string) {
    try {
      await apiClient.payments.refund(paymentId, reason);
      showToast("Rimborso effettuato", "success");
      load(0, false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Errore rimborso", "error");
    }
  }

  const selectStyle: React.CSSProperties = {
    height: "40px",
    padding: "0 10px",
    borderRadius: "var(--radius-md)",
    border: "2px solid var(--color-gray-200)",
    fontFamily: "var(--font)",
    fontSize: "var(--text-sm)",
    background: "var(--color-white)",
    color: "var(--color-gray-700)",
  };

  const dateInputStyle: React.CSSProperties = {
    height: "40px",
    padding: "0 10px",
    borderRadius: "var(--radius-md)",
    border: "2px solid var(--color-gray-200)",
    fontFamily: "var(--font)",
    fontSize: "var(--text-sm)",
  };

  return (
    <PosLayout>
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "var(--sp-lg)", display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: "var(--text-xxl)", fontWeight: 700, color: "var(--color-gray-900)", margin: 0 }}>
            Storico ordini
          </h1>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button size="sm" variant="ghost" onClick={handleExportCsv} disabled={orders.length === 0} title="Esporta solo gli ordini attualmente caricati">
              Esporta CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => load(0, false)}>Aggiorna</Button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "var(--sp-sm)", flexWrap: "wrap", alignItems: "center" }}>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
            {ORDER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {shifts.length > 0 && (
            <select value={filterShiftId} onChange={(e) => setFilterShiftId(e.target.value)} style={selectStyle}>
              <option value="">Tutti i turni</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  Turno {new Date(s.openedAt).toLocaleDateString("it-IT")}
                </option>
              ))}
            </select>
          )}

          {terminals.length > 1 && (
            <select value={filterTerminalId} onChange={(e) => setFilterTerminalId(e.target.value)} style={selectStyle}>
              <option value="">Tutte le casse</option>
              {terminals.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}

          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} style={dateInputStyle} placeholder="Da" />
          <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} style={dateInputStyle} placeholder="A" />

          {(filterStatus || filterShiftId || filterTerminalId || filterFrom || filterTo) && (
            <Button size="sm" variant="ghost" onClick={() => {
              setFilterStatus(""); setFilterShiftId(""); setFilterTerminalId(""); setFilterFrom(""); setFilterTo("");
            }}>
              Cancella filtri
            </Button>
          )}
        </div>

        {/* Content */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "var(--sp-xl)" }}>
            <span style={{ width: "32px", height: "32px", border: "3px solid var(--color-gray-200)", borderTopColor: "var(--color-brand)", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
          </div>
        )}

        {error && (
          <div style={{ padding: "var(--sp-md)", background: "#fef2f2", borderRadius: "var(--radius-lg)", color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>
            {error}
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div style={{ textAlign: "center", padding: "var(--sp-xl)", color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>
            Nessun ordine trovato
          </div>
        )}

        {!loading && orders.map((order) => {
          const terminalName = terminals.length > 1 ? terminals.find((t) => t.id === order.terminalId)?.name : undefined;
          return (
            <OrderRow
              key={order.id}
              order={order}
              isAdmin={isAdmin}
              onReprint={handleReprint}
              onReprintKitchen={handleReprintKitchen}
              onCancel={setCancelOrder}
              onRefund={handleRefundClick}
              receiptPrefix={receiptPrefix}
              receiptPadding={receiptPadding}
              {...(terminalName ? { terminalName } : {})}
            />
          );
        })}

        {hasMore && !loading && (
          <div style={{ textAlign: "center", paddingBottom: "var(--sp-md)" }}>
            <Button size="sm" variant="ghost" onClick={() => load(offset, true)}>
              Carica altri
            </Button>
          </div>
        )}

        {loading && orders.length > 0 && (
          <div style={{ textAlign: "center", padding: "var(--sp-md)" }}>
            <span style={{ width: "24px", height: "24px", border: "3px solid var(--color-gray-200)", borderTopColor: "var(--color-brand)", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
          </div>
        )}
      </div>

      <CancelModal
        order={cancelOrder}
        onConfirm={handleCancel}
        onClose={() => setCancelOrder(null)}
      />

      <RefundModal
        paymentId={refundOrder?.paymentId ?? null}
        amount={refundOrder?.amount ?? 0}
        onConfirm={handleRefundConfirm}
        onClose={() => setRefundOrder(null)}
      />

      {toast && (
        <div style={{
          position: "fixed",
          bottom: "var(--sp-lg)",
          left: "50%",
          transform: "translateX(-50%)",
          background: toast.type === "success" ? "#065f46" : "var(--color-danger)",
          color: "white",
          padding: "12px 24px",
          borderRadius: "var(--radius-lg)",
          fontWeight: 600,
          fontSize: "var(--text-sm)",
          boxShadow: "var(--shadow-lg)",
          zIndex: 9999,
        }}>
          {toast.msg}
        </div>
      )}
    </PosLayout>
  );
}
