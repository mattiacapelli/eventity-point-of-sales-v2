import { useEffect, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import type { RestaurantInfo } from "../../core/admin-api.js";
import { apiClient } from "../../core/api-client.js";
import type { ZReport } from "../../core/api-client.js";
import { useShiftStore } from "../../state/shift-store.js";
import { useStore } from "../../state/global-store.js";
import { Button } from "../../components/ui/Button.js";
import { Modal } from "../../components/ui/Modal.js";
import { inputStyle, labelStyle, tableHeaderStyle, tableCellStyle } from "./shared.js";
import { wsClient } from "../../core/ws-client.js";

function ZReportModal({ shiftId, onClose }: { shiftId: number | null; onClose: () => void }) {
  const [report, setReport] = useState<ZReport | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [loading_, setLoading_] = useState(false);

  useEffect(() => {
    if (!shiftId) { setReport(null); return; }
    setLoading_(true);
    Promise.all([
      apiClient.stats.zreport(shiftId),
      adminApi.restaurant.get(),
    ]).then(([r, rest]) => { setReport(r); setRestaurant(rest); })
      .catch(() => {})
      .finally(() => setLoading_(false));
  }, [shiftId]);

  const METHOD_LABELS: Record<string, string> = { cash: "Contanti", card: "Carta", digital_wallet: "Wallet", tab: "Conto" };

  return (
    <Modal open={shiftId !== null} onClose={onClose} title="Z-Report — Fine turno">
      <div style={{ minWidth: "460px", maxWidth: "560px" }}>
        {loading_ || !report ? (
          <div style={{ textAlign: "center", padding: "32px", color: "var(--color-gray-400)" }}>
            {loading_ ? "Caricamento..." : "Nessun dato"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Restaurant header */}
            {restaurant?.name && (
              <div style={{ textAlign: "center", paddingBottom: "12px", borderBottom: "1px solid var(--color-gray-100)" }}>
                <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-gray-800)" }}>{restaurant.name}</div>
                {(restaurant.address || restaurant.city) && (
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>
                    {[restaurant.address, restaurant.city].filter(Boolean).join(" — ")}
                  </div>
                )}
                {restaurant.vat && (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>P.IVA {restaurant.vat}</div>
                )}
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginTop: "4px" }}>
                  {report && `Turno: ${new Date(report.shift.openedAt).toLocaleDateString("it-IT")} ${new Date(report.shift.openedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}${report.shift.closedAt ? ` → ${new Date(report.shift.closedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : " (in corso)"}`}
                </div>
              </div>
            )}

            {/* Summary grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
              {[
                { label: "Vendite nette", value: `€${report.summary.netSales.toFixed(2)}`, highlight: true },
                { label: "Ordini completati", value: String(report.summary.totalOrders) },
                { label: "Scontrino medio", value: `€${report.summary.avgTicket.toFixed(2)}` },
                { label: "Totale lordo", value: `€${report.summary.totalSales.toFixed(2)}` },
                { label: "Rimborsi", value: `€${report.summary.refundTotal.toFixed(2)}` },
                { label: "Annullati", value: String(report.summary.cancelledOrders) },
              ].map(({ label, value, highlight }) => (
                <div key={label} style={{ background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", padding: "12px" }}>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", fontWeight: 600, marginBottom: "4px" }}>{label}</div>
                  <div style={{ fontSize: highlight ? "var(--text-lg)" : "var(--text-md)", fontWeight: 700, color: highlight ? "var(--color-brand)" : "var(--color-gray-800)" }}>{value}</div>
                </div>
              ))}
            </div>

            {/* By payment method */}
            {report.byPaymentMethod.length > 0 && (
              <div>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Per metodo di pagamento</div>
                <div style={{ background: "var(--color-white)", border: "1px solid var(--color-gray-100)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                  {report.byPaymentMethod.map((m, i) => (
                    <div key={m.method} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < report.byPaymentMethod.length - 1 ? "1px solid var(--color-gray-100)" : "none" }}>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-700)" }}>{METHOD_LABELS[m.method] ?? m.method} ({m.count})</span>
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-800)" }}>€{m.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By category */}
            {report.byCategory.length > 0 && (
              <div>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Per categoria</div>
                <div style={{ background: "var(--color-white)", border: "1px solid var(--color-gray-100)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                  {report.byCategory.sort((a, b) => b.amount - a.amount).map((c, i) => (
                    <div key={c.categoryName} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < report.byCategory.length - 1 ? "1px solid var(--color-gray-100)" : "none" }}>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-700)" }}>{c.categoryName} ({c.quantity} pz)</span>
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-800)" }}>€{c.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top products */}
            {report.topProducts.length > 0 && (
              <div>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Top prodotti</div>
                <div style={{ background: "var(--color-white)", border: "1px solid var(--color-gray-100)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                  {report.topProducts.map((p, i) => (
                    <div key={p.name + i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < report.topProducts.length - 1 ? "1px solid var(--color-gray-100)" : "none" }}>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-700)" }}>{i + 1}. {p.name} ({p.quantity} pz)</span>
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-800)" }}>€{p.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button size="sm" variant="ghost" onClick={onClose}>Chiudi</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function ShiftsTab() {
  const [history, setHistory] = useState<Array<{
    id: number; userId: number; openedAt: number; closedAt: number | null;
    openingCash: number; closingCash: number | null; totalSales: number; totalOrders: number; notes: string | null;
  }>>([]);
  const { currentShift, setCurrentShift } = useShiftStore();
  const [loading_, setLoading_] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("0");
  const [saving, setSaving] = useState(false);
  const [zReportShiftId, setZReportShiftId] = useState<number | null>(null);
  const { session } = useStore();

  async function loadShifts() {
    setLoading_(true);
    try {
      const [hist, current] = await Promise.allSettled([
        adminApi.shifts.history(),
        adminApi.shifts.current(),
      ]);
      if (hist.status === "fulfilled") setHistory(hist.value);
      if (current.status === "fulfilled") setCurrentShift(current.value);
      else setCurrentShift(null);
    } finally { setLoading_(false); }
  }

  useEffect(() => { void loadShifts(); }, []);

  useEffect(() => {
    const unsubs = [
      wsClient.on("SHIFT_OPENED", () => void loadShifts()),
      wsClient.on("SHIFT_CLOSED", () => void loadShifts()),
      wsClient.on("SHIFT_UPDATED", () => void loadShifts()),
    ];
    return () => { for (const unsub of unsubs) unsub(); };
  }, []);

  async function handleOpen() {
    setSaving(true);
    try {
      const userId = session?.userId ?? "admin";
      const shift = await adminApi.shifts.open({ userId, openingCash: parseFloat(openingCash) || 0 });
      setCurrentShift(shift);
      setOpenModal(false);
    } finally { setSaving(false); }
  }

  async function handleClose() {
    if (!currentShift) return;
    setSaving(true);
    try {
      await adminApi.shifts.close(currentShift.id, { closingCash: parseFloat(closingCash) || 0 });
      setCurrentShift(null);
      void loadShifts();
      setCloseModal(false);
    } finally { setSaving(false); }
  }

  function formatDuration(from: number, to?: number | null) {
    const ms = (to ?? Date.now()) - from;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
  }

  return (
    <div style={{ padding: "var(--sp-lg)" }}>
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", marginBottom: "var(--sp-lg)", marginTop: 0 }}>Turni</h2>

      {loading_ ? (
        <div style={{ textAlign: "center", color: "var(--color-gray-400)", padding: "40px" }}>Caricamento...</div>
      ) : (
        <>
          {/* Current shift card */}
          <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", padding: "24px", boxShadow: "var(--shadow-sm)", marginBottom: "24px" }}>
            {currentShift ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#22c55e", flexShrink: 0, display: "inline-block" }} />
                  <span style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--color-gray-800)" }}>Turno in corso</span>
                  <span style={{ marginLeft: "auto", fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>
                    {formatDuration(currentShift.openedAt)}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "20px" }}>
                  {[
                    { label: "Aperto alle", value: formatDate(currentShift.openedAt) },
                    { label: "Vendite", value: `€${currentShift.totalSales.toFixed(2)}` },
                    { label: "Ordini", value: String(currentShift.totalOrders) },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", padding: "12px 16px" }}>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", fontWeight: 600, marginBottom: "4px" }}>{label}</div>
                      <div style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--color-gray-800)" }}>{value}</div>
                    </div>
                  ))}
                </div>
                <Button variant="danger" size="sm" onClick={() => { setClosingCash(String(currentShift.openingCash)); setCloseModal(true); }}>
                  Chiudi turno
                </Button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--color-gray-700)", marginBottom: "4px" }}>Nessun turno aperto</div>
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)" }}>Apri un nuovo turno per iniziare a registrare le vendite.</div>
                </div>
                <Button size="sm" onClick={() => { setOpeningCash("0"); setOpenModal(true); }}>Apri turno</Button>
              </div>
            )}
          </div>

          {/* History */}
          {history.filter((s) => s.closedAt !== null).length > 0 && (
            <div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
                Storico
              </div>
              <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Apertura</th>
                      <th style={tableHeaderStyle}>Chiusura</th>
                      <th style={tableHeaderStyle}>Durata</th>
                      <th style={tableHeaderStyle}>Vendite</th>
                      <th style={tableHeaderStyle}>Ordini</th>
                      <th style={tableHeaderStyle}>Fondo cassa</th>
                      <th style={tableHeaderStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.filter((s) => s.closedAt !== null).map((s) => (
                      <tr key={s.id}>
                        <td style={tableCellStyle}>{formatDate(s.openedAt)}</td>
                        <td style={tableCellStyle}>{s.closedAt ? formatDate(s.closedAt) : "—"}</td>
                        <td style={tableCellStyle}>{formatDuration(s.openedAt, s.closedAt)}</td>
                        <td style={{ ...tableCellStyle, fontWeight: 600, color: "var(--color-brand)" }}>€{s.totalSales.toFixed(2)}</td>
                        <td style={tableCellStyle}>{s.totalOrders}</td>
                        <td style={tableCellStyle}>{s.closingCash !== null ? `€${s.closingCash.toFixed(2)}` : "—"}</td>
                        <td style={tableCellStyle}>
                          <button
                            onClick={() => setZReportShiftId(s.id)}
                            style={{ padding: "5px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600, fontFamily: "var(--font)", color: "var(--color-gray-600)" }}
                          >
                            Z-Report
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={openModal} onClose={() => setOpenModal(false)} title="Apri turno">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Fondo cassa iniziale (€)</label>
            <input style={inputStyle} type="number" min="0" step="0.01" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} autoFocus />
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setOpenModal(false)}>Annulla</Button>
            <Button size="sm" loading={saving} onClick={() => void handleOpen()}>Apri turno</Button>
          </div>
        </div>
      </Modal>

      <Modal open={closeModal} onClose={() => setCloseModal(false)} title="Chiudi turno">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Fondo cassa finale (€)</label>
            <input style={inputStyle} type="number" min="0" step="0.01" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} autoFocus />
          </div>
          {currentShift && (
            <div style={{ background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", padding: "12px 16px", fontSize: "var(--text-sm)", color: "var(--color-gray-600)" }}>
              Vendite registrate: <strong>€{currentShift.totalSales.toFixed(2)}</strong>
            </div>
          )}
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setCloseModal(false)}>Annulla</Button>
            <Button variant="danger" size="sm" loading={saving} onClick={() => void handleClose()}>Chiudi turno</Button>
          </div>
        </div>
      </Modal>

      <ZReportModal shiftId={zReportShiftId} onClose={() => setZReportShiftId(null)} />
    </div>
  );
}
