import React, { useEffect, useState, useCallback } from "react";
import type { Order } from "@pos/shared-types";
import { PosLayout } from "../../layout/PosLayout.js";
import { apiClient } from "../../core/api-client.js";
import { wsClient } from "../../core/ws-client.js";
import { useStore } from "../../state/global-store.js";
import { Button } from "../../components/ui/Button.js";
import { Badge } from "../../components/ui/Badge.js";
import { Card } from "../../components/ui/Card.js";
import { Modal } from "../../components/ui/Modal.js";
import type { PaymentMethod } from "@pos/shared-types";

const PAYABLE_STATUSES = ["pending", "confirmed", "preparing", "ready", "completed"];

function formatEur(n: number) {
  return `€${n.toFixed(2)}`;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:           "💵 Contanti",
  card:           "💳 Carta",
  digital_wallet: "📱 Digitale",
  tab:            "🗒️ Conto aperto",
};

interface PayModalProps {
  order: Order;
  onClose: () => void;
  onPaid: () => void;
}

function PayModal({ order, onClose, onPaid }: PayModalProps) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.payments.pay({
        orderId: order.id,
        method,
        amount: order.totalAmount,
      });
      onPaid();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore pagamento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Conferma pagamento" width="400px">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
        {/* Order summary */}
        <div
          style={{
            background: "var(--color-gray-50)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--sp-md)",
          }}
        >
          <div style={{ color: "var(--color-gray-500)", fontSize: "var(--text-sm)", marginBottom: "var(--sp-sm)" }}>
            Ordine #{order.id.slice(-6).toUpperCase()}
          </div>
          {order.items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "var(--text-sm)",
                padding: "4px 0",
              }}
            >
              <span>
                {item.name} ×{item.quantity}
              </span>
              <span style={{ fontWeight: 600 }}>
                {formatEur(item.unitPrice * item.quantity)}
              </span>
            </div>
          ))}
          <div
            style={{
              borderTop: "1px solid var(--color-gray-200)",
              marginTop: "var(--sp-sm)",
              paddingTop: "var(--sp-sm)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <span style={{ fontWeight: 700 }}>Totale</span>
            <span style={{ fontSize: "var(--text-xxl)", fontWeight: 700, color: "var(--color-brand)" }}>
              {formatEur(order.totalAmount)}
            </span>
          </div>
        </div>

        {/* Payment method */}
        <div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-600)", marginBottom: "var(--sp-sm)" }}>
            Metodo di pagamento
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {(Object.entries(METHOD_LABELS) as [PaymentMethod, string][]).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                style={{
                  padding: "12px",
                  borderRadius: "var(--radius-lg)",
                  border: `2px solid ${method === m ? "var(--color-brand)" : "var(--color-gray-200)"}`,
                  background: method === m ? "rgba(48,107,52,0.06)" : "var(--color-white)",
                  fontFamily: "var(--font)",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  color: method === m ? "var(--color-brand)" : "var(--color-gray-700)",
                  cursor: "pointer",
                  textAlign: "center",
                  minHeight: "52px",
                  transition: "all var(--transition)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.1)",
              color: "var(--color-danger)",
              borderRadius: "var(--radius-md)",
              padding: "10px 14px",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        <Button fullWidth size="xl" loading={loading} onClick={() => void handlePay()}>
          Paga {formatEur(order.totalAmount)}
        </Button>
      </div>
    </Modal>
  );
}

export function PaymentScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<Order | null>(null);
  const [paidId, setPaidId] = useState<string | null>(null);
  const upsertOrder = useStore((s) => s.upsertOrder);
  const removeOrder = useStore((s) => s.removeOrder);

  const loadOrders = useCallback(async () => {
    try {
      const all = await apiClient.orders.list();
      const payable = all.filter((o) => PAYABLE_STATUSES.includes(o.status));
      setOrders(payable);
      payable.forEach((o) => upsertOrder(o));
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, [upsertOrder]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  // WebSocket updates
  useEffect(() => {
    const unsub1 = wsClient.on("ORDER_CREATED", (p) => {
      setOrders((prev) => {
        if (prev.some((o) => o.id === p.order.id)) return prev;
        return [p.order, ...prev];
      });
    });
    const unsub2 = wsClient.on("ORDER_UPDATED", (p) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === p.order.id ? p.order : o)),
      );
    });
    const unsub3 = wsClient.on("PAYMENT_COMPLETED", (p) => {
      setOrders((prev) => prev.filter((o) => o.id !== p.payment.orderId));
      removeOrder(p.payment.orderId);
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [removeOrder]);

  const handlePaid = () => {
    if (paying) {
      setPaidId(paying.id);
      setOrders((prev) => prev.filter((o) => o.id !== paying.id));
      setPaying(null);
      setTimeout(() => setPaidId(null), 3000);
    }
  };

  return (
    <PosLayout>
      <div
        className="scrollable"
        style={{ height: "100%", overflowY: "auto", padding: "var(--sp-md)" }}
      >
        <div style={{ marginBottom: "var(--sp-md)" }}>
          <div style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>Pagamenti</div>
          <div style={{ color: "var(--color-gray-500)", fontSize: "var(--text-sm)" }}>
            Seleziona un ordine da pagare
          </div>
        </div>

        {paidId && (
          <div
            style={{
              background: "rgba(34,197,94,0.12)",
              color: "var(--color-success)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--sp-md)",
              marginBottom: "var(--sp-md)",
              textAlign: "center",
              fontWeight: 700,
              fontSize: "var(--text-lg)",
            }}
          >
            ✓ Pagamento registrato!
          </div>
        )}

        {loading ? (
          <div style={{ color: "var(--color-gray-400)", padding: "var(--sp-xl)", textAlign: "center" }}>
            Caricamento ordini...
          </div>
        ) : orders.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--sp-xxl)",
              gap: "var(--sp-md)",
              color: "var(--color-gray-400)",
            }}
          >
            <span style={{ fontSize: "56px" }}>💳</span>
            <span style={{ fontWeight: 700, fontSize: "var(--text-lg)" }}>Nessun ordine da pagare</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {orders.map((order) => (
              <Card
                key={order.id}
                onClick={() => setPaying(order)}
                style={{ cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-md)" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-sm)", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 700, fontSize: "var(--text-md)" }}>
                        #{order.id.slice(-6).toUpperCase()}
                      </span>
                      <Badge variant={order.status} size="sm" />
                    </div>
                    <div style={{ color: "var(--color-gray-500)", fontSize: "var(--text-sm)" }}>
                      {order.items.length} prodott{order.items.length === 1 ? "o" : "i"}
                      {order.items.slice(0, 3).map((i) => ` · ${i.name}`).join("")}
                      {order.items.length > 3 ? "..." : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-brand)" }}>
                      {formatEur(order.totalAmount)}
                    </div>
                    <div style={{ color: "var(--color-gray-400)", fontSize: "var(--text-xs)" }}>
                      Tocca per pagare
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {paying && (
        <PayModal
          order={paying}
          onClose={() => setPaying(null)}
          onPaid={handlePaid}
        />
      )}
    </PosLayout>
  );
}
