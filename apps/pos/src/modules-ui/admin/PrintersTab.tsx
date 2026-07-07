import { useEffect, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import { useAdminStore } from "../../state/admin-store.js";
import { Button } from "../../components/ui/Button.js";
import { Modal } from "../../components/ui/Modal.js";
import type { Printer, ProductionCenter } from "@pos/shared-types";
import { PlusIcon, PrinterIcon, PencilSquareIcon, TrashIcon, BuildingStorefrontIcon, XMarkIcon } from "../../components/ui/icons.js";
import { inputStyle, labelStyle, Toggle } from "./shared.js";

export function PrintersTab() {
  const { printers, setPrinters, upsertPrinter, removePrinter } = useAdminStore();
  const { productionCenters } = useAdminStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Printer | null>(null);
  const [form, setForm] = useState({ name: "", host: "", port: "", receiptEnabled: false, kitchenEnabled: false, printMode: "text" as "text" | "image" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [discovering, setDiscovering] = useState(false);
  const [discoverModalOpen, setDiscoverModalOpen] = useState(false);
  const [subnetInput, setSubnetInput] = useState("");
  const [discoverResult, setDiscoverResult] = useState<{ subnet: string; found: Array<{ host: string; port: number }> } | null>(null);

  // Per-printer assigned production centers
  const [printerCenters, setPrinterCenters] = useState<Record<string, ProductionCenter[]>>({});
  const [loadedPrinterCenters, setLoadedPrinterCenters] = useState<Set<string>>(new Set());
  const [centerDropdown, setCenterDropdown] = useState<string | null>(null);

  useEffect(() => {
    adminApi.printers.list().then(setPrinters).catch(console.error);
  }, []);

  async function loadPrinterCenters(printerId: string) {
    if (loadedPrinterCenters.has(printerId)) return;
    const centers = await adminApi.printers.getProductionCenters(printerId);
    setPrinterCenters((prev) => ({ ...prev, [printerId]: centers }));
    setLoadedPrinterCenters((prev) => new Set(prev).add(printerId));
  }

  useEffect(() => {
    printers.forEach((p) => { void loadPrinterCenters(p.id); });
  }, [printers]);

  async function handleAssignCenter(printerId: string, centerId: string) {
    await adminApi.productionCenters.assignPrinter(centerId, printerId);
    const centers = await adminApi.printers.getProductionCenters(printerId);
    setPrinterCenters((prev) => ({ ...prev, [printerId]: centers }));
    setCenterDropdown(null);
  }

  async function handleRemoveCenter(printerId: string, centerId: string) {
    await adminApi.productionCenters.removePrinter(centerId, printerId);
    const centers = await adminApi.printers.getProductionCenters(printerId);
    setPrinterCenters((prev) => ({ ...prev, [printerId]: centers }));
  }

  function openCreate() {
    setEditTarget(null);
    setForm({ name: "", host: "", port: "", receiptEnabled: false, kitchenEnabled: false, printMode: "text" });
    setModalOpen(true);
  }
  function openEdit(p: Printer) {
    setEditTarget(p);
    setForm({ name: p.name, host: p.host ?? "", port: p.port ? String(p.port) : "", receiptEnabled: p.receiptEnabled, kitchenEnabled: p.kitchenEnabled, printMode: p.printMode ?? "text" });
    setModalOpen(true);
  }
  async function handleSave() {
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await adminApi.printers.update(editTarget.id, {
          name: form.name,
          host: form.host === "" ? null : form.host,
          port: form.port === "" ? null : parseInt(form.port),
          receiptEnabled: form.receiptEnabled,
          kitchenEnabled: form.kitchenEnabled,
          printMode: form.printMode,
        });
        upsertPrinter(updated);
      } else {
        const createData: Parameters<typeof adminApi.printers.create>[0] = {
          name: form.name,
          receiptEnabled: form.receiptEnabled,
          kitchenEnabled: form.kitchenEnabled,
          printMode: form.printMode,
        };
        if (form.host !== "") createData.host = form.host;
        if (form.port !== "") createData.port = parseInt(form.port);
        const created = await adminApi.printers.create(createData);
        upsertPrinter(created);
      }
      setModalOpen(false);
    } finally { setSaving(false); }
  }
  async function handleDelete(id: string) {
    await adminApi.printers.delete(id);
    removePrinter(id);
    setDeleteId(null);
  }
  async function handleTestPrint(id: string) {
    setTestingId(id);
    try {
      const result = await adminApi.printers.testPrint(id);
      setTestResult((prev) => ({ ...prev, [id]: result.message }));
    } catch (e) {
      setTestResult((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "Errore" }));
    } finally {
      setTestingId(null);
      setTimeout(() => setTestResult((prev) => { const n = { ...prev }; delete n[id]; return n; }), 5000);
    }
  }

  async function openDiscoverModal() {
    setDiscoverResult(null);
    setDiscoverModalOpen(true);
    try {
      const { subnet } = await adminApi.printers.discoverSubnet();
      setSubnetInput(subnet ?? "");
    } catch {
      setSubnetInput("");
    }
  }

  async function handleDiscover() {
    setDiscovering(true);
    try {
      const result = await adminApi.printers.discover(subnetInput.trim() || undefined);
      setDiscoverResult(result);
    } catch (e) {
      setDiscoverResult({ subnet: subnetInput, found: [] });
    } finally {
      setDiscovering(false);
    }
  }

  function prefillFromDiscovered(host: string, port: number) {
    setEditTarget(null);
    setForm({ name: "", host, port: String(port), receiptEnabled: false, kitchenEnabled: false, printMode: "text" });
    setDiscoverModalOpen(false);
    setDiscoverResult(null);
    setModalOpen(true);
  }

  return (
    <div style={{ padding: "var(--sp-lg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-lg)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", margin: 0 }}>Stampanti</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <Button size="sm" variant="secondary" onClick={() => void openDiscoverModal()}>Scopri in rete</Button>
          <Button size="sm" onClick={openCreate} icon={<PlusIcon style={{ width: "16px", height: "16px" }} />}>Nuova stampante</Button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {printers.length === 0 && (
          <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", padding: "32px", textAlign: "center", color: "var(--color-gray-400)", fontSize: "var(--text-sm)", boxShadow: "var(--shadow-sm)" }}>
            Nessuna stampante configurata.
          </div>
        )}
        {printers.map((p) => (
          <div key={p.id} style={{ background: "var(--color-white)", borderRadius: "var(--radius-lg)", padding: "14px 16px", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <PrinterIcon style={{ width: "18px", height: "18px", color: "var(--color-brand)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--color-gray-800)" }}>{p.name}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
                  {p.host ? `${p.host}${p.port ? `:${p.port}` : ""}` : "Locale"}
                  {p.receiptEnabled && " · Scontrini"}
                  {p.kitchenEnabled && " · Cucina"}
                </div>
              </div>
              <Button size="sm" variant="secondary" loading={testingId === p.id} onClick={() => void handleTestPrint(p.id)}>
                Test
              </Button>
              <button onClick={() => openEdit(p)} style={{ padding: "6px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", color: "var(--color-gray-600)", display: "flex" }}>
                <PencilSquareIcon style={{ width: "16px", height: "16px" }} />
              </button>
              <button onClick={() => setDeleteId(p.id)} style={{ padding: "6px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-danger)", background: "var(--color-white)", cursor: "pointer", color: "var(--color-danger)", display: "flex" }}>
                <TrashIcon style={{ width: "16px", height: "16px" }} />
              </button>
            </div>
            {testResult[p.id] && (
              <div style={{ marginTop: "8px", padding: "8px 12px", background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)", color: "var(--color-gray-600)" }}>
                {testResult[p.id]}
              </div>
            )}

            {/* Centri di produzione assegnati */}
            {(() => {
              const assignedCenters = printerCenters[p.id] ?? [];
              const unassignedCenters = productionCenters.filter((c) => !assignedCenters.some((a) => a.id === c.id));
              const isCenterDropdownOpen = centerDropdown === p.id;
              return (
                <div style={{ borderTop: "1px solid var(--color-gray-100)", marginTop: "12px", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Centri di produzione
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", minHeight: "24px" }}>
                    {assignedCenters.map((c) => (
                      <span key={c.id} style={{
                        display: "inline-flex", alignItems: "center", gap: "5px",
                        padding: "3px 10px", borderRadius: "20px",
                        background: "rgba(99,102,241,0.1)", color: "#4f46e5",
                        fontSize: "var(--text-xs)", fontWeight: 600,
                      }}>
                        <BuildingStorefrontIcon style={{ width: "11px", height: "11px" }} />
                        {c.name}
                        <button
                          onClick={() => void handleRemoveCenter(p.id, c.id)}
                          style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: "0", color: "#4f46e5", opacity: 0.7 }}
                        >
                          <XMarkIcon style={{ width: "12px", height: "12px" }} />
                        </button>
                      </span>
                    ))}
                    {assignedCenters.length === 0 && (
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
                        Nessun centro assegnato
                      </span>
                    )}
                  </div>
                  {unassignedCenters.length > 0 && (
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() => setCenterDropdown(isCenterDropdownOpen ? null : p.id)}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: "5px",
                          padding: "5px 12px", borderRadius: "20px",
                          border: "1.5px dashed var(--color-gray-300)", background: "transparent",
                          cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600,
                          color: "var(--color-gray-500)",
                        }}
                      >
                        <PlusIcon style={{ width: "12px", height: "12px" }} />
                        Assegna centro
                      </button>
                      {isCenterDropdownOpen && (
                        <div style={{
                          position: "absolute", top: "calc(100% + 6px)", left: 0,
                          background: "var(--color-white)", borderRadius: "var(--radius-lg)",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid var(--color-gray-200)",
                          minWidth: "200px", zIndex: 100, overflow: "hidden",
                        }}>
                          {unassignedCenters.map((c, i) => (
                            <button key={c.id} onClick={() => void handleAssignCenter(p.id, c.id)}
                              style={{
                                width: "100%", padding: "10px 14px", border: "none",
                                borderBottom: i < unassignedCenters.length - 1 ? "1px solid var(--color-gray-100)" : "none",
                                background: "transparent", cursor: "pointer", textAlign: "left",
                                fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-gray-700)", fontFamily: "var(--font)",
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-gray-50)"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ""; }}
                            >
                              {c.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ))}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? "Modifica stampante" : "Nuova stampante"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Nome</label>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Es. Cassa, Cucina, Bar..." autoFocus />
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Host / IP</label>
              <input style={inputStyle} value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} placeholder="192.168.1.x" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Porta</label>
              <input style={inputStyle} type="number" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} placeholder="9100" />
            </div>
          </div>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <Toggle value={form.receiptEnabled} onChange={(v) => setForm((f) => ({ ...f, receiptEnabled: v }))} />
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)" }}>Scontrini</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <Toggle value={form.kitchenEnabled} onChange={(v) => setForm((f) => ({ ...f, kitchenEnabled: v }))} />
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)" }}>Cucina</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)" }}>Modalità stampa:</span>
              <select value={form.printMode} onChange={(e) => setForm((f) => ({ ...f, printMode: e.target.value as "text" | "image" }))}
                style={{ ...inputStyle, width: "auto", height: "36px", fontSize: "var(--text-sm)", padding: "0 10px" }}>
                <option value="text">Testo ESC/POS</option>
                <option value="image">Immagine raster</option>
              </select>
            </label>
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Annulla</Button>
            <Button size="sm" loading={saving} disabled={!form.name.trim()} onClick={() => void handleSave()}>{editTarget ? "Salva" : "Aggiungi"}</Button>
          </div>
        </div>
      </Modal>
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Elimina stampante">
        <p style={{ color: "var(--color-gray-600)", fontSize: "var(--text-sm)", marginBottom: "20px" }}>Eliminare questa stampante?</p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>Annulla</Button>
          <Button variant="danger" size="sm" onClick={() => deleteId && void handleDelete(deleteId)}>Elimina</Button>
        </div>
      </Modal>
      <Modal open={discoverModalOpen} onClose={() => { setDiscoverModalOpen(false); setDiscoverResult(null); }} title="Scopri stampanti in rete">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Subnet da scansionare</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={subnetInput}
                onChange={(e) => setSubnetInput(e.target.value)}
                placeholder="es. 192.168.1"
              />
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)", whiteSpace: "nowrap" }}>.1 – .254</span>
            </div>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginTop: "4px", margin: "4px 0 0" }}>
              Lascia vuoto per usare la subnet rilevata automaticamente
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => { setDiscoverModalOpen(false); setDiscoverResult(null); }}>Annulla</Button>
            <Button size="sm" loading={discovering} onClick={() => void handleDiscover()}>Avvia scansione</Button>
          </div>
          {discoverResult && (
            <div>
              <div style={{ borderTop: "1px solid var(--color-gray-200)", paddingTop: "16px" }}>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginBottom: "10px" }}>
                  Subnet scansionata: {discoverResult.subnet}.0/24
                </p>
                {discoverResult.found.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--color-gray-400)", fontSize: "var(--text-sm)", background: "var(--color-gray-50)", borderRadius: "var(--radius-md)" }}>
                    Nessuna stampante rilevata.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {discoverResult.found.map((d) => (
                      <div key={`${d.host}:${d.port}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)" }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-gray-800)" }}>{d.host}</span>
                          <span style={{ marginLeft: "8px", fontSize: "var(--text-xs)", color: "var(--color-gray-500)" }}>porta {d.port}</span>
                        </div>
                        <Button size="sm" onClick={() => prefillFromDiscovered(d.host, d.port)}>Aggiungi</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
