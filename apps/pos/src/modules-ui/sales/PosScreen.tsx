import React, { useState, useEffect } from "react";
import type { PaymentMethod } from "@pos/shared-types";
import { PosLayout } from "../../layout/PosLayout.js";
import { ProductGrid } from "./ProductGrid.js";
import { CartPanel } from "./CartPanel.js";
import { Modal } from "../../components/ui/Modal.js";
import { Button } from "../../components/ui/Button.js";
import { useStore } from "../../state/global-store.js";
import { useAdminStore } from "../../state/admin-store.js";
import { useShiftStore } from "../../state/shift-store.js";
import { apiClient } from "../../core/api-client.js";
import { adminApi } from "../../core/admin-api.js";
import {
  BanknotesIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  ReceiptPercentIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "../../components/ui/icons.js";

// Icon resolved by payment method type
function PaymentIcon({ type, ...props }: { type: string } & React.SVGProps<SVGSVGElement>) {
  if (type === "card") return <CreditCardIcon {...props} />;
  if (type === "digital_wallet") return <DevicePhoneMobileIcon {...props} />;
  if (type === "tab") return <ReceiptPercentIcon {...props} />;
  return <BanknotesIcon {...props} />;
}

function formatEur(n: number) {
  return `€${n.toFixed(2)}`;
}

function CheckoutModal() {
  const { checkoutOrder, setCheckoutOrder, clearCart } = useStore();
  const { paymentMethods, setPaymentMethods } = useAdminStore();
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const activeMethods = paymentMethods.filter((m) => m.active);

  // Load payment methods when modal is needed; auto-select first
  useEffect(() => {
    if (!checkoutOrder) return;
    if (paymentMethods.length === 0) {
      adminApi.paymentMethods.list().then((ms) => {
        setPaymentMethods(ms);
        const active = ms.filter((m) => m.active);
        if (active.length > 0 && !selectedMethodId) setSelectedMethodId(active[0]!.id);
      }).catch(console.error);
    } else if (!selectedMethodId && activeMethods.length > 0) {
      setSelectedMethodId(activeMethods[0]!.id);
    }
  }, [checkoutOrder]);

  if (!checkoutOrder) return null;

  const order = checkoutOrder;
  const selectedMethod = activeMethods.find((m) => m.id === selectedMethodId);

  const handlePay = async () => {
    if (!selectedMethod) return;
    setLoading(true);
    setError(null);
    try {
      // Map the dynamic method type to the legacy PaymentMethod enum for the existing payments API
      const legacyMethod: PaymentMethod =
        selectedMethod.type === "card" ? "card" :
        selectedMethod.type === "digital_wallet" ? "digital_wallet" :
        selectedMethod.type === "tab" ? "tab" : "cash";
      await apiClient.payments.pay({ orderId: order.id, method: legacyMethod, amount: order.totalAmount });
      setPaid(true);
      setTimeout(() => {
        setCheckoutOrder(null);
        clearCart();
        setPaid(false);
        setSelectedMethodId(null);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore pagamento");
    } finally {
      setLoading(false);
    }
  };

  if (paid) {
    return (
      <Modal open onClose={() => {}} title="" width="360px">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-md)", padding: "var(--sp-xl) 0" }}>
          <CheckCircleIcon style={{ width: "72px", height: "72px", color: "var(--color-success)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-success)" }}>
              Pagamento registrato
            </div>
            <div style={{ color: "var(--color-gray-500)", fontSize: "var(--text-sm)", marginTop: "4px" }}>
              Stampa in corso...
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={() => setCheckoutOrder(null)} title="Pagamento" width="420px">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>

        {/* Order summary */}
        <div style={{ background: "var(--color-gray-50)", borderRadius: "var(--radius-lg)", padding: "var(--sp-md)" }}>
          <div style={{ color: "var(--color-gray-500)", fontSize: "var(--text-sm)", marginBottom: "var(--sp-sm)" }}>
            Ordine #{order.id.slice(-6).toUpperCase()}
          </div>
          {order.items.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)", padding: "4px 0" }}>
              <span>{item.name} ×{item.quantity}</span>
              <span style={{ fontWeight: 600 }}>{formatEur(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--color-gray-200)", marginTop: "var(--sp-sm)", paddingTop: "var(--sp-sm)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontWeight: 700 }}>Totale</span>
            <span style={{ fontSize: "var(--text-xxl)", fontWeight: 700, color: "var(--color-brand)" }}>
              {formatEur(order.totalAmount)}
            </span>
          </div>
        </div>

        {/* Payment method — dynamic */}
        <div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-600)", marginBottom: "var(--sp-sm)" }}>
            Metodo di pagamento
          </div>
          {activeMethods.length === 0 ? (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)", padding: "16px 0" }}>
              Nessun metodo di pagamento attivo — configurali in Amministrazione.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: activeMethods.length > 2 ? "1fr 1fr" : `repeat(${activeMethods.length}, 1fr)`, gap: "8px" }}>
              {activeMethods.map((m) => {
                const active = selectedMethodId === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMethodId(m.id)}
                    style={{
                      padding: "14px 12px",
                      borderRadius: "var(--radius-lg)",
                      border: `2px solid ${active ? "var(--color-brand)" : "var(--color-gray-200)"}`,
                      background: active ? "rgba(48,107,52,0.06)" : "var(--color-white)",
                      fontFamily: "var(--font)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "6px",
                      minHeight: "72px",
                      transition: "all var(--transition)",
                    }}
                  >
                    <PaymentIcon type={m.type} style={{ width: "22px", height: "22px", color: active ? "var(--color-brand)" : "var(--color-gray-400)" }} />
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: active ? "var(--color-brand)" : "var(--color-gray-700)" }}>
                      {m.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(239,68,68,0.08)", borderRadius: "var(--radius-md)", padding: "10px 14px" }}>
            <ExclamationCircleIcon style={{ width: "18px", height: "18px", color: "var(--color-danger)", flexShrink: 0 }} />
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-danger)" }}>{error}</span>
          </div>
        )}

        <Button fullWidth size="xl" loading={loading} disabled={!selectedMethod} onClick={() => void handlePay()}>
          Paga {formatEur(order.totalAmount)}
        </Button>
      </div>
    </Modal>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%", height: "44px", padding: "0 14px",
  borderRadius: "var(--radius-lg)", border: "2px solid var(--color-gray-200)",
  fontSize: "var(--text-md)", fontFamily: "var(--font)",
  color: "var(--color-gray-800)", background: "var(--color-white)",
  outline: "none", boxSizing: "border-box",
};

function OpenShiftModal({ onDone }: { onDone: () => void }) {
  const { session } = useStore();
  const { setCurrentShift } = useShiftStore();
  const [openingCash, setOpeningCash] = useState("0");
  const [saving, setSaving] = useState(false);

  async function handleOpen() {
    setSaving(true);
    try {
      const userId = session?.userId ?? "unknown";
      const shift = await adminApi.shifts.open({ userId, openingCash: parseFloat(openingCash) || 0 });
      setCurrentShift(shift);
    } catch {
      // shift already open — fetch it and set it
      try {
        const existing = await adminApi.shifts.current();
        setCurrentShift(existing);
      } catch { /* ignore */ }
    } finally {
      setSaving(false);
      onDone();
    }
  }

  return (
    <Modal open onClose={onDone} title="Apri turno">
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-600)", marginBottom: "6px" }}>
            Fondo cassa iniziale (€)
          </label>
          <input style={INPUT_STYLE} type="number" min="0" step="0.01" value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)} autoFocus />
        </div>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={onDone}>Annulla</Button>
          <Button size="sm" loading={saving} onClick={() => void handleOpen()}>Apri turno</Button>
        </div>
      </div>
    </Modal>
  );
}

function CloseShiftModal({ onDone }: { onDone: () => void }) {
  const { currentShift, setCurrentShift } = useShiftStore();
  const [closingCash, setClosingCash] = useState(() => String(currentShift?.openingCash ?? 0));
  const [saving, setSaving] = useState(false);

  async function handleClose() {
    if (!currentShift) return;
    setSaving(true);
    try {
      await adminApi.shifts.close(currentShift.id, { closingCash: parseFloat(closingCash) || 0 });
      setCurrentShift(null);
    } finally {
      setSaving(false);
      onDone();
    }
  }

  return (
    <Modal open onClose={onDone} title="Chiudi turno">
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {currentShift && (
          <div style={{ background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", padding: "12px 16px", fontSize: "var(--text-sm)", color: "var(--color-gray-600)" }}>
            Vendite registrate: <strong>€{currentShift.totalSales.toFixed(2)}</strong> · {currentShift.totalOrders} ordini
          </div>
        )}
        <div>
          <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-600)", marginBottom: "6px" }}>
            Fondo cassa finale (€)
          </label>
          <input style={INPUT_STYLE} type="number" min="0" step="0.01" value={closingCash}
            onChange={(e) => setClosingCash(e.target.value)} autoFocus />
        </div>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={onDone}>Annulla</Button>
          <Button variant="danger" size="sm" loading={saving} onClick={() => void handleClose()}>Chiudi turno</Button>
        </div>
      </div>
    </Modal>
  );
}

export function PosScreen() {
  const { setCategories, setProducts, categories, products } = useAdminStore();
  const { currentShift, setCurrentShift, shiftModalOpen, setShiftModalOpen } = useShiftStore();
  const [shiftChecked, setShiftChecked] = useState(false);

  // Load catalogue from API on mount (only if not already loaded by AdminScreen)
  useEffect(() => {
    if (categories.length > 0 && products.length > 0) return;
    void Promise.all([
      adminApi.categories.list(),
      adminApi.products.list(),
    ]).then(([cats, prods]) => {
      setCategories(cats);
      setProducts(prods);
    });
  }, []);

  // Check for current open shift on mount — silently, no popup
  useEffect(() => {
    if (shiftChecked) return;
    adminApi.shifts.current()
      .then((shift) => { setCurrentShift(shift); })
      .catch(() => { /* no shift open, user can open one manually */ })
      .finally(() => { setShiftChecked(true); });
  }, []);

  return (
    <PosLayout>
      <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr 320px" }}>
        <ProductGrid />
        <CartPanel />
      </div>
      <CheckoutModal />
      {shiftModalOpen === "open" && (
        <OpenShiftModal onDone={() => setShiftModalOpen(null)} />
      )}
      {shiftModalOpen === "close" && currentShift && (
        <CloseShiftModal onDone={() => setShiftModalOpen(null)} />
      )}
    </PosLayout>
  );
}
