import React, { useState, useEffect } from "react";
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
import { useScannerListener } from "../../core/useScannerListener.js";
import { decodeQrPayload } from "../../core/qr-payload.js";
import { useToastStore } from "../../components/ui/Toast.js";
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
  const { checkoutOrder, setCheckoutOrder, clearCart, pendingTableId, pendingCustomerName } = useStore();
  const { paymentMethods, setPaymentMethods } = useAdminStore();
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [tableId, setTableId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [tablesEnabled, setTablesEnabled] = useState(false);

  const activeMethods = paymentMethods.filter((m) => m.active);
  const singleMethod = activeMethods.length === 1 ? activeMethods[0] : null;

  // Load payment methods + settings when modal opens; auto-select if single method
  useEffect(() => {
    if (!checkoutOrder) return;
    // Fall back to values prefilled by a QR scan when the order itself doesn't have them yet.
    setTableId(checkoutOrder.tableId ?? pendingTableId ?? "");
    setCustomerName(checkoutOrder.customerName ?? pendingCustomerName ?? "");
    adminApi.settings.get().then((s) => setTablesEnabled(s.tablesEnabled)).catch(() => {});
    if (paymentMethods.length === 0) {
      adminApi.paymentMethods.list().then((ms) => {
        setPaymentMethods(ms);
        const active = ms.filter((m) => m.active);
        if (active.length > 0) setSelectedMethodId(active[0]!.id);
      }).catch(console.error);
    } else {
      setSelectedMethodId(activeMethods[0]?.id ?? null);
    }
  }, [checkoutOrder?.id]);

  if (!checkoutOrder) return null;

  const order = checkoutOrder;
  const selectedMethod = activeMethods.find((m) => m.id === selectedMethodId);

  const handlePay = async () => {
    if (!selectedMethod) return;
    setLoading(true);
    setError(null);
    try {
      const trimmedTableId = tableId.trim();
      const trimmedCustomerName = customerName.trim();
      if (trimmedTableId !== (order.tableId ?? "") || trimmedCustomerName !== (order.customerName ?? "")) {
        await apiClient.orders.updateDetails(order.id, {
          tableId: trimmedTableId === "" ? null : trimmedTableId,
          customerName: trimmedCustomerName === "" ? null : trimmedCustomerName,
        });
      }
      await apiClient.payments.pay({ orderId: order.id, method: selectedMethod.id, amount: order.totalAmount });
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
    <Modal open onClose={() => setCheckoutOrder(null)} title="Pagamento" width="560px">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>

        {/* Table / customer — only when tables module is enabled */}
        {tablesEnabled && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-600)", marginBottom: "var(--sp-sm)", display: "block" }}>
                Tavolo
              </label>
              <input
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                placeholder="Es. 12"
                style={{ width: "100%", height: "40px", padding: "0 12px", borderRadius: "var(--radius-md)", border: "2px solid var(--color-gray-200)", fontFamily: "var(--font)", fontSize: "var(--text-md)", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-600)", marginBottom: "var(--sp-sm)", display: "block" }}>
                Nome cliente
              </label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Es. Mario Rossi"
                style={{ width: "100%", height: "40px", padding: "0 12px", borderRadius: "var(--radius-md)", border: "2px solid var(--color-gray-200)", fontFamily: "var(--font)", fontSize: "var(--text-md)", boxSizing: "border-box" }}
              />
            </div>
          </div>
        )}

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
          ) : singleMethod ? (
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "12px 14px", borderRadius: "var(--radius-lg)",
              border: "2px solid var(--color-brand)",
              background: "rgba(48,107,52,0.06)",
            }}>
              <PaymentIcon type={singleMethod.type} style={{ width: "20px", height: "20px", color: "var(--color-brand)", flexShrink: 0 }} />
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-brand)" }}>{singleMethod.name}</span>
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

const NUMPAD_BTN: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  height: "64px", borderRadius: "var(--radius-lg)",
  border: "1px solid var(--color-gray-200)", background: "var(--color-white)",
  fontSize: "22px", fontWeight: 700, color: "var(--color-gray-800)",
  cursor: "pointer", userSelect: "none", WebkitUserSelect: "none",
  touchAction: "manipulation", transition: "background 0.1s",
};

function CashNumpad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function press(key: string) {
    if (key === "⌫") {
      onChange(value.length <= 1 ? "0" : value.slice(0, -1));
      return;
    }
    if (key === "." && value.includes(".")) return;
    const next = value === "0" && key !== "." ? key : value + key;
    // max 2 decimal digits
    const [int, dec] = next.split(".");
    if (dec !== undefined && dec.length > 2) return;
    if (int.length > 6) return;
    onChange(next);
  }

  const keys = ["7","8","9","4","5","6","1","2","3",".","0","⌫"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px" }}>
      {keys.map((k) => (
        <button key={k} style={{ ...NUMPAD_BTN, background: k === "⌫" ? "var(--color-gray-100)" : "var(--color-white)" }}
          onPointerDown={(e) => { e.preventDefault(); press(k); }}>
          {k}
        </button>
      ))}
    </div>
  );
}

type InvItem = import("../../core/admin-api.js").InventoryItemRecord;

function OpenShiftModal({ onDone }: { onDone: () => void }) {
  const { session } = useStore();
  const { setCurrentShift } = useShiftStore();
  const [step, setStep] = useState<"cash" | "inventory" | "summary">("cash");
  const [openingCash, setOpeningCash] = useState("0");
  const [saving, setSaving] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InvItem[]>([]);
  const [stockValues, setStockValues] = useState<Record<string, number>>({});
  const [invIdx, setInvIdx] = useState(0);

  useEffect(() => {
    adminApi.inventory.listItems()
      .then((items) => {
        setInventoryItems(items);
        const vals: Record<string, number> = {};
        for (const item of items) {
          vals[item.id] = item.resetOnShiftOpen ? 0 : item.currentStock;
        }
        setStockValues(vals);
      })
      .catch(() => {});
  }, []);

  async function handleOpen() {
    setSaving(true);
    try {
      const userId = session?.userId ?? "unknown";
      const shift = await adminApi.shifts.open({ userId, openingCash: parseFloat(openingCash) || 0 });
      setCurrentShift(shift);
      await Promise.all(
        inventoryItems.map(async (item) => {
          const newQty = stockValues[item.id] ?? item.currentStock;
          const delta = newQty - item.currentStock;
          if (delta === 0) return;
          try { await adminApi.inventory.adjustStock(item.id, delta, "carico apertura turno"); } catch { /* ignore */ }
        })
      );
    } catch {
      try { setCurrentShift(await adminApi.shifts.current()); } catch { /* ignore */ }
    } finally {
      setSaving(false);
      onDone();
    }
  }

  function adj(id: string, delta: number) {
    setStockValues((v) => ({ ...v, [id]: Math.max(0, (v[id] ?? 0) + delta) }));
  }

  const stepIndex = step === "cash" ? 0 : step === "inventory" ? 1 : 2;
  const totalSteps = inventoryItems.length > 0 ? 3 : 2;
  const currentInvItem = inventoryItems[invIdx] ?? null;

  const TOUCH_BTN: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "60px", height: "60px", borderRadius: "50%", border: "none",
    fontSize: "28px", fontWeight: 700, cursor: "pointer",
    touchAction: "manipulation", userSelect: "none", WebkitUserSelect: "none",
    transition: "background 0.1s, transform 0.05s",
  };

  function goNext() {
    if (step === "cash") {
      if (inventoryItems.length > 0) { setInvIdx(0); setStep("inventory"); }
      else setStep("summary");
    } else if (step === "inventory") {
      if (invIdx < inventoryItems.length - 1) setInvIdx((i) => i + 1);
      else setStep("summary");
    }
  }
  function goBack() {
    if (step === "summary") {
      if (inventoryItems.length > 0) { setInvIdx(inventoryItems.length - 1); setStep("inventory"); }
      else setStep("cash");
    } else if (step === "inventory") {
      if (invIdx > 0) setInvIdx((i) => i - 1);
      else setStep("cash");
    }
  }

  const stepLabel = step === "cash" ? "Fondo cassa" : step === "inventory" ? `Inventario (${invIdx + 1}/${inventoryItems.length})` : "Riepilogo";

  return (
    <Modal open onClose={onDone} title="Apertura turno" width="520px">
      <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>

        {/* Progress bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px" }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: "4px", borderRadius: "2px",
              background: i <= stepIndex ? "var(--color-brand)" : "var(--color-gray-200)",
              transition: "background 0.3s",
            }} />
          ))}
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", flexShrink: 0, minWidth: "80px", textAlign: "right" }}>
            {stepLabel}
          </span>
        </div>

        {/* ── STEP 1: fondo cassa ── */}
        {step === "cash" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Fondo cassa iniziale</div>
              <div style={{ fontSize: "52px", fontWeight: 800, color: "var(--color-gray-900)", letterSpacing: "-1px", lineHeight: 1.1 }}>
                € {openingCash}
              </div>
            </div>
            <CashNumpad value={openingCash} onChange={setOpeningCash} />
            <button
              style={{ width: "100%", height: "56px", borderRadius: "var(--radius-lg)", border: "none", background: "var(--color-brand)", color: "var(--color-white)", fontSize: "var(--text-base)", fontWeight: 700, cursor: "pointer", touchAction: "manipulation" }}
              onClick={goNext}
            >
              Continua →
            </button>
          </div>
        )}

        {/* ── STEP 2: inventario item per item ── */}
        {step === "inventory" && currentInvItem && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
                {currentInvItem.resetOnShiftOpen ? "Carico turno" : "Conferma stock"}
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--color-gray-900)", marginBottom: "2px" }}>{currentInvItem.name}</div>
              {currentInvItem.resetOnShiftOpen ? (
                <div style={{ fontSize: "var(--text-sm)", color: "#b45309" }}>Inserisci la quantità iniziale del turno</div>
              ) : (
                <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)" }}>Stock precedente: {currentInvItem.currentStock} {currentInvItem.unit}</div>
              )}
            </div>

            {/* Big +/- counter */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "24px" }}>
              <button
                style={{ ...TOUCH_BTN, background: "var(--color-gray-100)", color: "var(--color-gray-800)", fontSize: "36px" }}
                onPointerDown={(e) => { e.preventDefault(); adj(currentInvItem.id, -1); }}
              >−</button>
              <div style={{ textAlign: "center", minWidth: "120px" }}>
                <div style={{ fontSize: "56px", fontWeight: 800, color: "var(--color-gray-900)", lineHeight: 1 }}>
                  {stockValues[currentInvItem.id] ?? 0}
                </div>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)", marginTop: "4px" }}>{currentInvItem.unit}</div>
              </div>
              <button
                style={{ ...TOUCH_BTN, background: "var(--color-brand)", color: "var(--color-white)", fontSize: "36px" }}
                onPointerDown={(e) => { e.preventDefault(); adj(currentInvItem.id, 1); }}
              >+</button>
            </div>

            {/* Input numerico diretto */}
            <input
              type="number"
              min="0"
              step="1"
              value={stockValues[currentInvItem.id] ?? 0}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v >= 0) setStockValues((s) => ({ ...s, [currentInvItem.id]: v }));
              }}
              style={{ ...INPUT_STYLE, textAlign: "center", fontSize: "var(--text-lg)", fontWeight: 700, height: "52px" }}
            />

            {/* Navigation */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                style={{ flex: 1, height: "52px", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-gray-200)", background: "var(--color-white)", fontSize: "var(--text-base)", fontWeight: 600, color: "var(--color-gray-600)", cursor: "pointer", touchAction: "manipulation" }}
                onClick={goBack}
              >← Indietro</button>
              <button
                style={{ flex: 2, height: "52px", borderRadius: "var(--radius-lg)", border: "none", background: "var(--color-brand)", color: "var(--color-white)", fontSize: "var(--text-base)", fontWeight: 700, cursor: "pointer", touchAction: "manipulation" }}
                onClick={goNext}
              >
                {invIdx < inventoryItems.length - 1 ? "Avanti →" : "Riepilogo →"}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: riepilogo ── */}
        {step === "summary" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Riepilogo apertura</div>

            {/* Fondo cassa */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "var(--color-gray-50)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-gray-200)" }}>
              <div>
                <div style={{ fontWeight: 700, color: "var(--color-gray-800)", fontSize: "var(--text-base)" }}>Fondo cassa</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>Contanti in cassa all'apertura</div>
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-gray-900)" }}>€ {parseFloat(openingCash).toFixed(2)}</div>
            </div>

            {/* Inventario */}
            {inventoryItems.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "260px", overflowY: "auto" }}>
                {inventoryItems.map((item) => {
                  const qty = stockValues[item.id] ?? item.currentStock;
                  const delta = qty - item.currentStock;
                  return (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: "var(--color-gray-800)", fontSize: "var(--text-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                        {delta !== 0 && (
                          <div style={{ fontSize: "var(--text-xs)", color: delta > 0 ? "#16a34a" : "#dc2626", fontWeight: 600, marginTop: "1px" }}>
                            {delta > 0 ? `+${delta}` : delta} {item.unit}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, marginLeft: "12px" }}>
                        <span style={{ fontSize: "20px", fontWeight: 800, color: "var(--color-gray-900)" }}>{qty}</span>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>{item.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button
                style={{ flex: 1, height: "52px", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-gray-200)", background: "var(--color-white)", fontSize: "var(--text-base)", fontWeight: 600, color: "var(--color-gray-600)", cursor: "pointer", touchAction: "manipulation" }}
                onClick={goBack}
              >← Indietro</button>
              <button
                disabled={saving}
                style={{ flex: 2, height: "52px", borderRadius: "var(--radius-lg)", border: "none", background: saving ? "var(--color-gray-300)" : "var(--color-brand)", color: "var(--color-white)", fontSize: "var(--text-base)", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", touchAction: "manipulation" }}
                onClick={() => void handleOpen()}
              >
                {saving ? "Apertura..." : "Apri turno ✓"}
              </button>
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
}

function CloseShiftModal({ onDone }: { onDone: () => void }) {
  const { currentShift, setCurrentShift } = useShiftStore();
  const [closingCash, setClosingCash] = useState(() => String(currentShift?.openingCash ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsForce, setNeedsForce] = useState(false);
  const [closedShiftId, setClosedShiftId] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<string | null>(null);

  async function handleClose(force = false) {
    if (!currentShift) return;
    const shiftId = currentShift.id;
    setSaving(true);
    setError(null);
    try {
      await adminApi.shifts.close(shiftId, { closingCash: parseFloat(closingCash) || 0, force });
      setCurrentShift(null);
      setClosedShiftId(shiftId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante la chiusura del turno");
      setNeedsForce(true);
    } finally {
      setSaving(false);
    }
  }

  async function handlePrint() {
    if (!closedShiftId) return;
    setPrinting(true);
    setPrintResult(null);
    try {
      const res = await apiClient.stats.printShiftReport(closedShiftId);
      setPrintResult(res.message ?? (res.ok ? "Report stampato" : "Stampa non riuscita"));
    } catch (err) {
      setPrintResult(err instanceof Error ? err.message : "Errore durante la stampa");
    } finally {
      setPrinting(false);
    }
  }

  if (closedShiftId) {
    return (
      <Modal open onClose={onDone} title="Turno chiuso">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", padding: "12px 16px", fontSize: "var(--text-sm)", color: "var(--color-gray-600)" }}>
            Il turno è stato chiuso correttamente.
          </div>
          {printResult && (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-600)" }}>{printResult}</div>
          )}
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" loading={printing} onClick={() => void handlePrint()}>Stampa report</Button>
            <Button size="sm" onClick={onDone}>Chiudi</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onDone} title="Chiudi turno">
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {currentShift && (
          <div style={{ background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", padding: "12px 16px", fontSize: "var(--text-sm)", color: "var(--color-gray-600)" }}>
            Vendite registrate: <strong>€{currentShift.totalSales.toFixed(2)}</strong> · {currentShift.totalOrders} ordini
          </div>
        )}
        {error && (
          <div style={{ background: "var(--color-red-50, #fef2f2)", color: "var(--color-red-700, #b91c1c)", borderRadius: "var(--radius-md)", padding: "12px 16px", fontSize: "var(--text-sm)" }}>
            {error}
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
          {needsForce && (
            <Button variant="danger" size="sm" loading={saving} onClick={() => void handleClose(true)}>Forza chiusura</Button>
          )}
          <Button variant="danger" size="sm" loading={saving} onClick={() => void handleClose(false)}>Chiudi turno</Button>
        </div>
      </div>
    </Modal>
  );
}

export function PosScreen() {
  const { setCategories, setProducts, categories, products, optionGroupsByProduct, setOptionGroups } = useAdminStore();
  const { currentShift, shiftModalOpen, setShiftModalOpen } = useShiftStore();
  const addToCart = useStore((s) => s.addToCart);
  const setPendingOrderInfo = useStore((s) => s.setPendingOrderInfo);
  const checkoutOrder = useStore((s) => s.checkoutOrder);
  const productConfiguratorOpen = useStore((s) => s.productConfiguratorOpen);
  const [catalogueReady, setCatalogueReady] = useState(false);

  // Load catalogue from API on mount (only if not already loaded by AdminScreen)
  useEffect(() => {
    if (categories.length > 0 && products.length > 0) { setCatalogueReady(true); return; }
    void Promise.all([
      adminApi.categories.list(),
      adminApi.products.list(),
    ]).then(([cats, prods]) => {
      setCategories(cats);
      setProducts(prods);
      setCatalogueReady(true);
    });
  }, []);

  // QR scan from a paired barcode scanner (HID keyboard-wedge): decode the compressed
  // web-order payload and load its items into the cart, prefilling table/customer name.
  // Ignored while the catalogue isn't loaded yet, or while the checkout/configurator modal
  // is already open — scanning mid-flow would otherwise silently contaminate that other order.
  useScannerListener((raw) => {
    if (!catalogueReady) {
      useToastStore.getState().show("Catalogo non ancora caricato: riprova tra un istante", "error");
      return;
    }
    if (checkoutOrder || productConfiguratorOpen) {
      useToastStore.getState().show("Completa l'operazione in corso prima di scansionare un nuovo ordine", "error");
      return;
    }

    let payload;
    try {
      payload = decodeQrPayload(raw);
    } catch {
      return; // not a recognizable payload — ignore silently (could be an unrelated barcode)
    }

    void (async () => {
      let missingCount = 0;
      let needsConfigCount = 0;

      for (const item of payload.items) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) { missingCount += 1; continue; }

        let groups = optionGroupsByProduct[product.id];
        if (!groups) {
          groups = await adminApi.optionGroups.list(product.id);
          setOptionGroups(product.id, groups);
        }

        const requiredGroups = groups.filter((g) => g.required);
        const scannedOptionIds = new Set(item.selectedOptionIds ?? []);
        const missingRequired = requiredGroups.some(
          (g) => !g.options.some((o) => scannedOptionIds.has(o.id))
        );
        if (missingRequired) { needsConfigCount += 1; continue; }

        const selectedOptions = groups
          .flatMap((g) => g.options.map((o) => ({ ...o, groupType: g.type })))
          .filter((o) => scannedOptionIds.has(o.id))
          .map((o) => ({
            optionId: o.id,
            optionGroupId: o.optionGroupId,
            name: o.name,
            priceDelta: o.priceDelta,
            prefix: o.prefix,
            isRemoval: o.prefix === "-",
          }));

        addToCart({
          productId: product.id,
          name: product.name,
          unitPrice: product.price,
          quantity: item.quantity,
          ...(selectedOptions.length > 0 ? { selectedOptions } : {}),
        });
      }

      setPendingOrderInfo({ tableId: payload.tableId || null, customerName: payload.customerName });

      if (missingCount > 0 || needsConfigCount > 0) {
        const parts = [];
        if (missingCount > 0) parts.push(`${missingCount} non disponibile/i`);
        if (needsConfigCount > 0) parts.push(`${needsConfigCount} da configurare manualmente`);
        useToastStore.getState().show(`Attenzione: ${parts.join(", ")}`, "error");
      } else {
        useToastStore.getState().show(`Ordine dal tavolo ${payload.tableId} caricato nel carrello`, "success");
      }
    })();
  });

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
