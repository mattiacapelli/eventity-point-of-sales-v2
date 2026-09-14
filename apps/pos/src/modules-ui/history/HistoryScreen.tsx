import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  pending:    { bg: "#FFF4E2", text: "#8A5A0B", label: "In attesa" },
  confirmed:  { bg: "#FFF4E2", text: "#8A5A0B", label: "Confermato" },
  preparing:  { bg: "#FFF4E2", text: "#8A5A0B", label: "In preparazione" },
  ready:      { bg: "#E8F0EA", text: "#17663C", label: "Pronto" },
  completed:  { bg: "#E8F0EA", text: "#17663C", label: "Completato" },
  cancelled:  { bg: "#F0F3F0", text: "#7C8A81", label: "Annullato" },
  refunded:   { bg: "#F0F3F0", text: "#7C8A81", label: "Rimborsato" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg: "#F0F3F0", text: "#7C8A81", label: status };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", flex: "none", whiteSpace: "nowrap",
      padding: "5px 11px",
      borderRadius: "8px",
      background: s.bg,
      color: s.text,
      fontWeight: 700,
      fontSize: "13px",
    }}>
      {s.label}
    </span>
  );
}

// ─── Cancel modal (con opzione rimborso se già pagato) ───────────────────────

function CancelModal({
  order,
  onConfirm,
  onClose,
}: {
  order: Order | null;
  onConfirm: (id: number, reason?: string, refundPaymentId?: number) => Promise<void>;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [withRefund, setWithRefund] = useState(false);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);

  // Se l'ordine è completed carica il pagamento per proporre il rimborso
  useEffect(() => {
    if (!order) { setPaymentId(null); setWithRefund(false); setReason(""); return; }
    if (order.status === "completed") {
      apiClient.payments.listByOrder(order.id)
        .then(({ payments }) => {
          const p = payments.find((x) => x.status === "completed");
          if (p) { setPaymentId(p.id); setPaymentAmount(p.amount); setWithRefund(true); }
        })
        .catch(() => {});
    } else {
      setPaymentId(null); setWithRefund(false);
    }
  }, [order?.id]);

  async function handleConfirm() {
    if (!order) return;
    setLoading(true);
    await onConfirm(order.id, reason || undefined, withRefund && paymentId ? paymentId : undefined);
    setLoading(false);
    setReason(""); setWithRefund(false); setPaymentId(null);
    onClose();
  }

  const isPaid = paymentId !== null;

  return (
    <Modal open={order !== null} onClose={onClose} title="Annulla ordine">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-md)" }}>
        <p style={{ margin: 0, color: "var(--color-gray-700)", fontSize: "var(--text-sm)" }}>
          Confermi l'annullamento dell'ordine <strong>#{order?.id ?? ""}</strong>?
        </p>
        {isPaid && (
          <div style={{ background: "#FFF8EC", border: "1px solid #F0DFBE", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
            <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "#6B4A0C", marginBottom: "8px" }}>
              Ordine già pagato — €{paymentAmount.toFixed(2)}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "var(--text-sm)", color: "#8A6A2B" }}>
              <input type="checkbox" checked={withRefund} onChange={(e) => setWithRefund(e.target.checked)}
                style={{ width: "16px", height: "16px", cursor: "pointer" }} />
              Effettua rimborso contestuale
            </label>
          </div>
        )}
        <input
          placeholder="Motivazione (opzionale)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ height: "44px", padding: "0 14px", borderRadius: "var(--radius-lg)", border: "2px solid var(--color-gray-200)", fontFamily: "var(--font)", fontSize: "var(--text-sm)" }}
        />
        <div style={{ display: "flex", gap: "var(--sp-sm)" }}>
          <Button variant="ghost" size="sm" onClick={onClose} style={{ flex: 1 }}>Chiudi</Button>
          <Button variant="danger" size="sm" onClick={handleConfirm} loading={loading} style={{ flex: 1 }}>
            {withRefund ? "Annulla e rimborsa" : "Conferma annullamento"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Edit items modal ─────────────────────────────────────────────────────────

function EditItemsModal({
  order,
  onSaved,
  onClose,
}: {
  order: Order | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  type EditItem = { productId: number; name: string; quantity: number; unitPrice: number };
  const [items, setItems] = useState<EditItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!order) return;
    setItems(order.items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })));
    setError(null);
  }, [order?.id]);

  function setQty(idx: number, qty: number) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, qty) } : it));
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!order || items.length === 0) return;
    setLoading(true); setError(null);
    try {
      await apiClient.orders.updateItems(order.id, items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity })));
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  return (
    <Modal open={order !== null} onClose={onClose} title="Modifica ordine">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-md)" }}>
        {items.length === 0 ? (
          <p style={{ margin: 0, color: "var(--color-gray-500)", fontSize: "var(--text-sm)" }}>Nessun articolo.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "320px", overflowY: "auto" }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", background: "var(--color-gray-50)", borderRadius: "var(--radius-md)" }}>
                <span style={{ flex: 1, fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-gray-800)" }}>{item.name}</span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", width: "52px", textAlign: "right" }}>
                  €{(item.unitPrice * item.quantity).toFixed(2)}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <button onClick={() => setQty(idx, item.quantity - 1)} style={{ width: "26px", height: "26px", borderRadius: "50%", border: "1px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "var(--color-gray-600)", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                  <span style={{ width: "24px", textAlign: "center", fontSize: "var(--text-sm)", fontWeight: 700 }}>{item.quantity}</span>
                  <button onClick={() => setQty(idx, item.quantity + 1)} style={{ width: "26px", height: "26px", borderRadius: "50%", border: "1px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "var(--color-gray-600)", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                </div>
                <button onClick={() => removeItem(idx)} style={{ width: "26px", height: "26px", borderRadius: "50%", border: "none", background: "rgba(239,68,68,0.08)", cursor: "pointer", fontSize: "13px", color: "var(--color-danger)", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", fontWeight: 700, fontSize: "var(--text-md)", color: "var(--color-brand)" }}>
          Totale: €{total.toFixed(2)}
        </div>
        {error && <div style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", fontWeight: 600 }}>{error}</div>}
        <div style={{ display: "flex", gap: "var(--sp-sm)" }}>
          <Button variant="ghost" size="sm" onClick={onClose} style={{ flex: 1 }}>Annulla</Button>
          <Button size="sm" onClick={handleSave} loading={loading} disabled={items.length === 0} style={{ flex: 1 }}>
            Salva modifiche
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
  paymentId: number | null;
  amount: number;
  onConfirm: (paymentId: number, reason?: string) => Promise<void>;
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
  onEdit,
  receiptPrefix,
  receiptPadding,
  terminalName,
}: {
  order: Order;
  isAdmin: boolean;
  onReprint: (id: number) => void;
  onReprintKitchen: (id: number) => void;
  onCancel: (order: Order) => void;
  onRefund: (order: Order) => void;
  onEdit: (order: Order) => void;
  receiptPrefix: string;
  receiptPadding: number;
  terminalName?: string;
}) {
  const canCancel = isAdmin && order.status !== "cancelled";
  const canEdit = isAdmin && order.status !== "completed" && order.status !== "cancelled";
  const canRefund = isAdmin && order.status === "completed";
  const itemSummary = order.items.length > 0
    ? order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")
    : "—";

  const chips: { label: string; value: string }[] = [];
  if (order.tableId)      chips.push({ label: "Tavolo", value: order.tableId });
  if (order.customerName) chips.push({ label: "Cliente", value: order.customerName });
  if (order.pax)          chips.push({ label: "Coperti", value: String(order.pax) });
  if (order.notes)        chips.push({ label: "Note", value: order.notes });
  if (order.discountAmount > 0) chips.push({ label: "Sconto", value: `€${order.discountAmount.toFixed(2)}${order.discountType === "percent" ? ` (${((order.discountAmount / (order.totalAmount + order.discountAmount)) * 100).toFixed(0)}%)` : ""}` });
  if (order.fiscalDocNumber) chips.push({ label: "Doc.", value: order.fiscalDocNumber });

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: "10px 14px",
      padding: "15px 18px", borderBottom: "1px solid var(--color-gray-100)", alignItems: "center",
    }}>
      <div style={{ width: "132px", flex: "none", display: "flex", flexDirection: "column", gap: "5px" }}>
        <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-gray-900)" }}>
          #{displayOrderNum(order, receiptPrefix, receiptPadding)}
        </span>
        <span style={{ fontSize: "12.5px", color: "var(--color-gray-500)" }}>
          {new Date(order.createdAt).toLocaleString("it-IT")}
          {terminalName && ` · ${terminalName}`}
        </span>
      </div>

      <div style={{ flex: "1 1 240px", minWidth: 0, display: "flex", flexDirection: "column", gap: "5px" }}>
        <span style={{ fontSize: "14.5px", lineHeight: 1.4, color: "var(--color-gray-800)" }}>
          {itemSummary}
        </span>
        {chips.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {chips.map((c) => (
              <span key={c.label} style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                background: "var(--color-gray-50)", border: "1px solid var(--color-gray-200)",
                borderRadius: "6px", padding: "2px 8px",
                fontSize: "12px", color: "var(--color-gray-700)",
              }}>
                <span style={{ color: "var(--color-gray-500)", fontWeight: 600 }}>{c.label}</span>
                {c.value}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: "12px", marginLeft: "auto" }}>
        <StatusBadge status={order.status} />
        <span style={{ minWidth: "82px", textAlign: "right", fontSize: "18px", fontWeight: 700, color: "var(--color-gray-900)" }}>
          €{order.totalAmount.toFixed(2)}
        </span>
        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Button size="sm" variant="ghost" onClick={() => onReprint(order.id)}>
            Scontrino
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onReprintKitchen(order.id)}
            style={{ color: "var(--color-gray-600)" }}>
            Comanda
          </Button>
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={() => onEdit(order)}
              style={{ color: "var(--color-brand)", borderColor: "var(--color-brand)" }}>
              Modifica
            </Button>
          )}
          {canRefund && (
            <Button size="sm" variant="ghost" onClick={() => onRefund(order)}
              style={{ color: "#8A6A2B", borderColor: "#F0DFBE" }}>
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
  return String(order.id);
}

export function HistoryScreen() {
  const navigate = useNavigate();
  const session = useStore((s) => s.session);
  const isAdmin = session?.role === "admin";
  const clearCart = useStore((s) => s.clearCart);
  const addToCart = useStore((s) => s.addToCart);
  const setEditingOrderId = useStore((s) => s.setEditingOrderId);

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

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search — aspetta 400ms dopo l'ultimo tasto prima di caricare
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  // Modals
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [refundOrder, setRefundOrder] = useState<{ paymentId: number; amount: number } | null>(null);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function handleEditOrder(order: Order) {
    clearCart();
    for (const item of order.items) {
      addToCart({
        productId: item.productId,
        name: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        ...(item.notes ? { notes: item.notes } : {}),
      });
    }
    setEditingOrderId(order.id);
    navigate("/pos");
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
    const filters: { status?: string; shiftId?: string; terminalId?: string; from?: number; to?: number; limit?: number; offset?: number; search?: string } = {
      limit: PAGE_SIZE,
      offset: currentOffset,
    };
    if (filterStatus) filters.status = filterStatus;
    if (filterShiftId) filters.shiftId = filterShiftId;
    if (filterTerminalId) filters.terminalId = filterTerminalId;
    if (filterFrom) filters.from = new Date(filterFrom).getTime();
    if (filterTo) filters.to = new Date(filterTo + "T23:59:59").getTime();
    if (debouncedSearch) filters.search = debouncedSearch;
    apiClient.orders.list(filters)
      .then((data) => {
        setOrders((prev) => append ? [...prev, ...data] : data);
        setHasMore(data.length === PAGE_SIZE);
        setOffset(currentOffset + data.length);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filterStatus, filterShiftId, filterTerminalId, filterFrom, filterTo, debouncedSearch]);

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

  async function handleReprint(id: number) {
    try {
      await apiClient.orders.reprint(id);
      showToast("Ristampa inviata alla stampante", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("No completed payment")) showToast("Nessun pagamento trovato — impossibile ristampare", "error");
      else if (msg.includes("No active receipt printer") || msg.includes("unavailable")) showToast("Nessuna stampante scontrini attiva", "error");
      else if (msg.includes("404")) showToast("Ordine non trovato", "error");
      else showToast("Errore durante la ristampa", "error");
    }
  }

  async function handleReprintKitchen(id: number) {
    try {
      await apiClient.orders.reprintKitchen(id);
      showToast("Comanda inviata alla stampante cucina", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("No active kitchen")) showToast("Nessuna stampante cucina attiva", "error");
      else if (msg.includes("unavailable")) showToast("Servizio stampa non disponibile", "error");
      else if (msg.includes("404")) showToast("Ordine non trovato", "error");
      else showToast("Errore durante la ristampa comanda", "error");
    }
  }

  async function handleCancel(id: number, reason?: string, refundPaymentId?: number) {
    try {
      await apiClient.orders.cancel(id, reason);
      if (refundPaymentId) await apiClient.payments.refund(refundPaymentId, reason);
      showToast(refundPaymentId ? "Ordine annullato e rimborso effettuato" : "Ordine annullato", "success");
      load(0, false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("404")) showToast("Ordine non trovato", "error");
      else showToast("Errore durante l'annullamento", "error");
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

  async function handleRefundConfirm(paymentId: number, reason?: string) {
    try {
      await apiClient.payments.refund(paymentId, reason);
      showToast("Rimborso effettuato", "success");
      load(0, false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Errore rimborso", "error");
    }
  }

  const selectStyle: React.CSSProperties = {
    height: "46px",
    padding: "0 14px",
    borderRadius: "10px",
    border: "1px solid var(--color-gray-200)",
    fontFamily: "var(--font)",
    fontSize: "14.5px",
    fontWeight: 500,
    background: "var(--color-white)",
    color: "var(--color-gray-700)",
  };

  const dateInputStyle: React.CSSProperties = {
    height: "46px",
    padding: "0 12px",
    borderRadius: "10px",
    border: "1px solid var(--color-gray-200)",
    fontFamily: "var(--font)",
    fontSize: "14.5px",
  };

  const hasActiveFilters = !!(filterStatus || filterShiftId || filterTerminalId || filterFrom || filterTo || searchQuery);

  return (
    <PosLayout>
      <div style={{ height: "100%", overflowY: "auto", boxSizing: "border-box" }}>
      <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "22px 20px 40px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700, letterSpacing: "-0.025em", color: "var(--color-gray-900)" }}>
              Storico ordini
            </h1>
            <p style={{ margin: 0, fontSize: "14.5px", color: "var(--color-gray-700)" }}>
              {orders.length} ordin{orders.length === 1 ? "e" : "i"} caricat{orders.length === 1 ? "o" : "i"}
            </p>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: "8px" }}>
            <Button size="sm" variant="ghost" onClick={handleExportCsv} disabled={orders.length === 0} title="Esporta solo gli ordini attualmente caricati">
              Esporta CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => load(0, false)}>Aggiorna</Button>
          </div>
        </div>

        {/* Search + filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", padding: "12px", background: "var(--color-white)", border: "1px solid var(--color-gray-200)", borderRadius: "14px" }}>
          <div style={{ flex: 1, minWidth: "240px", display: "flex", alignItems: "center", gap: "10px", height: "46px", padding: "0 14px", borderRadius: "10px", background: "var(--color-gray-50)" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", border: "2.5px solid var(--color-gray-400)", flexShrink: 0 }} />
            <input
              type="search"
              placeholder="Numero, prodotto, tavolo, nota…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: "15px", fontFamily: "var(--font)", color: "var(--color-gray-900)" }}
            />
          </div>

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

          {hasActiveFilters && (
            <Button size="sm" variant="ghost" onClick={() => {
              setFilterStatus(""); setFilterShiftId(""); setFilterTerminalId(""); setFilterFrom(""); setFilterTo(""); setSearchQuery("");
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
          <div style={{ padding: "var(--sp-md)", background: "rgba(154,44,34,0.08)", borderRadius: "var(--radius-lg)", color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>
            {error}
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div style={{ textAlign: "center", padding: "var(--sp-xl)", color: "var(--color-gray-500)", fontSize: "var(--text-sm)" }}>
            {debouncedSearch ? `Nessun risultato per "${debouncedSearch}"` : "Nessun ordine trovato"}
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div style={{ background: "var(--color-white)", border: "1px solid var(--color-gray-200)", borderRadius: "16px", overflow: "hidden" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "14px", padding: "12px 18px",
              borderBottom: "1px solid var(--color-gray-200)", background: "var(--color-gray-50)",
              fontSize: "11.5px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-gray-500)",
            }}>
              <span style={{ width: "132px", flex: "none" }}>Ordine</span>
              <span style={{ flex: 1, minWidth: 0 }}>Prodotti</span>
              <span>Totale e azioni</span>
            </div>
            {orders.map((order) => {
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
                  onEdit={handleEditOrder}
                  receiptPrefix={receiptPrefix}
                  receiptPadding={receiptPadding}
                  {...(terminalName ? { terminalName } : {})}
                />
              );
            })}
          </div>
        )}

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
          background: toast.type === "success" ? "var(--color-brand-dark)" : "var(--color-danger)",
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
      </div>
    </PosLayout>
  );
}
