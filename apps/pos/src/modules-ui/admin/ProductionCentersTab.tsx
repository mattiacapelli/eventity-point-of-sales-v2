import { useEffect, useRef, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import { useAdminStore } from "../../state/admin-store.js";
import { Button } from "../../components/ui/Button.js";
import { Modal } from "../../components/ui/Modal.js";
import type { Category, ProductionCenter, Printer } from "@pos/shared-types";
import { BuildingStorefrontIcon, PlusIcon, PencilSquareIcon, TrashIcon, XMarkIcon, PrinterIcon, Bars3Icon } from "../../components/ui/icons.js";
import { inputStyle, labelStyle } from "./shared.js";
import { ColorField } from "./ColorField.js";

export function ProductionCentersTab() {
  const { productionCenters, categories, upsertProductionCenter, removeProductionCenter, setProductionCenters } = useAdminStore();

  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function onDragStart(index: number) {
    dragIndex.current = index;
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  async function onDrop(dropIndex: number) {
    const fromIndex = dragIndex.current;
    dragIndex.current = null;
    setDragOverIndex(null);
    if (fromIndex === null || fromIndex === dropIndex) return;

    const reordered = [...productionCenters];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(dropIndex, 0, moved!);
    setProductionCenters(reordered);
    await adminApi.productionCenters.reorder(reordered.map((pc) => pc.id));
  }

  // Per-center assigned categories (loaded lazily)
  const [centerCategories, setCenterCategories] = useState<Record<string, Category[]>>({});
  const [loadedCenters, setLoadedCenters] = useState<Set<string>>(new Set());

  // Per-center assigned printers
  const [centerPrinters, setCenterPrinters] = useState<Record<string, Array<Pick<Printer, "id" | "name" | "host" | "port" | "kitchenEnabled" | "active">>>>({});
  const [loadedPrinterCenters, setLoadedPrinterCenters] = useState<Set<string>>(new Set());
  const [allPrinters, setAllPrinters] = useState<Printer[]>([]);
  const [printerDropdown, setPrinterDropdown] = useState<string | null>(null);

  // Modal: new center
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCenterName, setNewCenterName] = useState("");
  const [newCenterColor, setNewCenterColor] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit center
  const [editTarget, setEditTarget] = useState<ProductionCenter | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editReceiptPrintMode, setEditReceiptPrintMode] = useState<"included" | "separate">("included");
  const [editSaving, setEditSaving] = useState(false);

  // Delete center
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Dropdown for adding category to a center
  const [addDropdown, setAddDropdown] = useState<string | null>(null);

  async function loadCenterCategories(centerId: string) {
    if (loadedCenters.has(centerId)) return;
    const cats = await adminApi.productionCenters.getCategories(centerId);
    setCenterCategories((prev) => ({ ...prev, [centerId]: cats }));
    setLoadedCenters((prev) => new Set(prev).add(centerId));
  }

  async function loadCenterPrinters(centerId: string) {
    if (loadedPrinterCenters.has(centerId)) return;
    const prs = await adminApi.productionCenters.getPrinters(centerId);
    setCenterPrinters((prev) => ({ ...prev, [centerId]: prs }));
    setLoadedPrinterCenters((prev) => new Set(prev).add(centerId));
  }

  useEffect(() => {
    productionCenters.forEach((pc) => {
      void loadCenterCategories(pc.id);
      void loadCenterPrinters(pc.id);
    });
    adminApi.printers.list().then(setAllPrinters).catch(() => {});
  }, [productionCenters]);

  async function handleCreate() {
    if (!newCenterName.trim()) return;
    setCreating(true);
    try {
      const created = await adminApi.productionCenters.create({
        name: newCenterName.trim(),
        color: newCenterColor === "" ? null : newCenterColor,
      });
      upsertProductionCenter(created);
      setCenterCategories((prev) => ({ ...prev, [created.id]: [] }));
      setLoadedCenters((prev) => new Set(prev).add(created.id));
      setNewCenterName("");
      setNewCenterColor("");
      setCreateModalOpen(false);
    } finally {
      setCreating(false);
    }
  }

  function startEdit(pc: ProductionCenter) {
    setEditTarget(pc);
    setEditName(pc.name);
    setEditColor(pc.color ?? "");
    setEditReceiptPrintMode(pc.receiptPrintMode);
  }

  async function handleEditSave() {
    if (!editTarget || !editName.trim()) return;
    setEditSaving(true);
    try {
      const updated = await adminApi.productionCenters.update(editTarget.id, {
        name: editName.trim(),
        color: editColor === "" ? null : editColor,
        receiptPrintMode: editReceiptPrintMode,
      });
      upsertProductionCenter(updated);
      setEditTarget(null);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await adminApi.productionCenters.delete(id);
    removeProductionCenter(id);
    setCenterCategories((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setDeleteId(null);
  }

  async function handleAssignCategory(centerId: string, categoryId: string) {
    await adminApi.productionCenters.assignCategory(centerId, categoryId);
    const cats = await adminApi.productionCenters.getCategories(centerId);
    setCenterCategories((prev) => ({ ...prev, [centerId]: cats }));
    setAddDropdown(null);
  }

  async function handleRemoveCategory(centerId: string, categoryId: string) {
    await adminApi.productionCenters.removeCategory(centerId, categoryId);
    const cats = await adminApi.productionCenters.getCategories(centerId);
    setCenterCategories((prev) => ({ ...prev, [centerId]: cats }));
  }

  async function handleAssignPrinter(centerId: string, printerId: string) {
    await adminApi.productionCenters.assignPrinter(centerId, printerId);
    const prs = await adminApi.productionCenters.getPrinters(centerId);
    setCenterPrinters((prev) => ({ ...prev, [centerId]: prs }));
    setPrinterDropdown(null);
  }

  async function handleRemovePrinter(centerId: string, printerId: string) {
    await adminApi.productionCenters.removePrinter(centerId, printerId);
    const prs = await adminApi.productionCenters.getPrinters(centerId);
    setCenterPrinters((prev) => ({ ...prev, [centerId]: prs }));
  }

  return (
    <div style={{ padding: "var(--sp-lg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-lg)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", margin: 0 }}>
          Centri di produzione
        </h2>
        <Button
          size="sm"
          onClick={() => setCreateModalOpen(true)}
          icon={<PlusIcon style={{ width: "16px", height: "16px" }} />}
        >
          Nuovo centro
        </Button>
      </div>

      {productionCenters.length === 0 && (
        <div style={{
          background: "var(--color-white)",
          borderRadius: "var(--radius-xl)",
          padding: "32px",
          textAlign: "center",
          color: "var(--color-gray-400)",
          fontSize: "var(--text-sm)",
          boxShadow: "var(--shadow-sm)",
        }}>
          Nessun centro di produzione. Clicca "Nuovo centro" per aggiungerne uno.
        </div>
      )}

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: "16px",
      }}>
        {productionCenters.map((pc, index) => {
          const assigned = centerCategories[pc.id] ?? [];
          const unassigned = categories.filter((c) => !assigned.some((a) => a.id === c.id));
          const isDropdownOpen = addDropdown === pc.id;

          return (
            <div
              key={pc.id}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={() => void onDrop(index)}
              onDragEnd={() => setDragOverIndex(null)}
              style={{
                background: "var(--color-white)",
                borderRadius: "var(--radius-xl)",
                boxShadow: "var(--shadow-sm)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                border: dragOverIndex === index ? "2px solid var(--color-brand)" : "2px solid transparent",
                transition: "border-color 0.15s",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Bars3Icon
                  style={{ width: "16px", height: "16px", color: "var(--color-gray-400)", flexShrink: 0, cursor: "grab" }}
                  title="Trascina per riordinare"
                />
                <BuildingStorefrontIcon style={{ width: "20px", height: "20px", color: pc.color ?? "var(--color-brand)", flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: "var(--text-md)", fontWeight: 700, color: "var(--color-gray-800)" }}>
                  {pc.name}
                </span>
                <button
                  onClick={() => startEdit(pc)}
                  title="Modifica"
                  style={{
                    padding: "5px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-gray-200)",
                    background: "var(--color-white)",
                    cursor: "pointer",
                    color: "var(--color-gray-500)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <PencilSquareIcon style={{ width: "14px", height: "14px" }} />
                </button>
                <button
                  onClick={() => setDeleteId(pc.id)}
                  title="Elimina"
                  style={{
                    padding: "5px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-danger)",
                    background: "var(--color-white)",
                    cursor: "pointer",
                    color: "var(--color-danger)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <TrashIcon style={{ width: "14px", height: "14px" }} />
                </button>
              </div>

              {/* Assigned categories as tags */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", minHeight: "28px" }}>
                {assigned.map((cat) => (
                  <span
                    key={cat.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "3px 10px 3px 10px",
                      borderRadius: "20px",
                      background: "rgba(48,107,52,0.1)",
                      color: "var(--color-brand)",
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                    }}
                  >
                    {cat.name}
                    <button
                      onClick={() => void handleRemoveCategory(pc.id, cat.id)}
                      title="Rimuovi"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "0",
                        color: "var(--color-brand)",
                        opacity: 0.7,
                      }}
                    >
                      <XMarkIcon style={{ width: "12px", height: "12px" }} />
                    </button>
                  </span>
                ))}
                {assigned.length === 0 && (
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", alignSelf: "center" }}>
                    Nessuna categoria assegnata
                  </span>
                )}
              </div>

              {/* Add category */}
              {unassigned.length > 0 && (
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setAddDropdown(isDropdownOpen ? null : pc.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 12px",
                      borderRadius: "20px",
                      border: "1.5px dashed var(--color-gray-300)",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                      color: "var(--color-gray-500)",
                      transition: "border-color var(--transition), color var(--transition)",
                    }}
                  >
                    <PlusIcon style={{ width: "12px", height: "12px" }} />
                    Aggiungi categoria
                  </button>

                  {isDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        background: "var(--color-white)",
                        borderRadius: "var(--radius-lg)",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                        border: "1px solid var(--color-gray-200)",
                        minWidth: "200px",
                        zIndex: 100,
                        overflow: "hidden",
                      }}
                    >
                      {unassigned.map((cat, i) => (
                        <button
                          key={cat.id}
                          onClick={() => void handleAssignCategory(pc.id, cat.id)}
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            border: "none",
                            borderBottom: i < unassigned.length - 1 ? "1px solid var(--color-gray-100)" : "none",
                            background: "transparent",
                            cursor: "pointer",
                            textAlign: "left",
                            fontSize: "var(--text-sm)",
                            fontWeight: 500,
                            color: "var(--color-gray-700)",
                            fontFamily: "var(--font)",
                            transition: "background var(--transition)",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-gray-50)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ""; }}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Stampanti assegnate */}
              {(() => {
                const assignedPrinters = centerPrinters[pc.id] ?? [];
                const unassignedPrinters = allPrinters.filter((p) => p.kitchenEnabled && !assignedPrinters.some((a) => a.id === p.id));
                const isPrinterDropdownOpen = printerDropdown === pc.id;
                return (
                  <div style={{ borderTop: "1px solid var(--color-gray-100)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Stampanti cucina
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", minHeight: "24px" }}>
                      {assignedPrinters.map((p) => (
                        <span key={p.id} style={{
                          display: "inline-flex", alignItems: "center", gap: "5px",
                          padding: "3px 10px", borderRadius: "20px",
                          background: "rgba(99,102,241,0.1)", color: "#4f46e5",
                          fontSize: "var(--text-xs)", fontWeight: 600,
                        }}>
                          <PrinterIcon style={{ width: "11px", height: "11px" }} />
                          {p.name}
                          <button
                            onClick={() => void handleRemovePrinter(pc.id, p.id)}
                            style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: "0", color: "#4f46e5", opacity: 0.7 }}
                          >
                            <XMarkIcon style={{ width: "12px", height: "12px" }} />
                          </button>
                        </span>
                      ))}
                      {assignedPrinters.length === 0 && (
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
                          Fallback su tutte le stampanti kitchen
                        </span>
                      )}
                    </div>
                    {unassignedPrinters.length > 0 && (
                      <div style={{ position: "relative" }}>
                        <button
                          onClick={() => setPrinterDropdown(isPrinterDropdownOpen ? null : pc.id)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: "5px",
                            padding: "5px 12px", borderRadius: "20px",
                            border: "1.5px dashed var(--color-gray-300)", background: "transparent",
                            cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600,
                            color: "var(--color-gray-500)",
                          }}
                        >
                          <PlusIcon style={{ width: "12px", height: "12px" }} />
                          Assegna stampante
                        </button>
                        {isPrinterDropdownOpen && (
                          <div style={{
                            position: "absolute", top: "calc(100% + 6px)", left: 0,
                            background: "var(--color-white)", borderRadius: "var(--radius-lg)",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid var(--color-gray-200)",
                            minWidth: "200px", zIndex: 100, overflow: "hidden",
                          }}>
                            {unassignedPrinters.map((p, i) => (
                              <button key={p.id} onClick={() => void handleAssignPrinter(pc.id, p.id)}
                                style={{
                                  width: "100%", padding: "10px 14px", border: "none",
                                  borderBottom: i < unassignedPrinters.length - 1 ? "1px solid var(--color-gray-100)" : "none",
                                  background: "transparent", cursor: "pointer", textAlign: "left",
                                  fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-gray-700)", fontFamily: "var(--font)",
                                }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-gray-50)"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ""; }}
                              >
                                {p.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Modalità stampa scontrino */}
              <div style={{ borderTop: "1px solid var(--color-gray-100)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Stampa scontrino
                </div>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)" }}>
                  {pc.receiptPrintMode === "separate"
                    ? "Scontrino separato (documento a parte)"
                    : "Incluso nello scontrino unico"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Nuovo centro di produzione">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Nome</label>
            <input
              style={inputStyle}
              value={newCenterName}
              onChange={(e) => setNewCenterName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
              placeholder="Es. Cucina, Bar, Pizzeria..."
              autoFocus
            />
          </div>
          <ColorField value={newCenterColor} onChange={setNewCenterColor} />
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setCreateModalOpen(false)}>Annulla</Button>
            <Button size="sm" loading={creating} disabled={!newCenterName.trim()} onClick={() => void handleCreate()}>
              Crea
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={editTarget !== null} onClose={() => setEditTarget(null)} title="Modifica centro">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Nome</label>
            <input
              style={inputStyle}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleEditSave(); }}
              placeholder="Nome centro"
              autoFocus
            />
          </div>
          <ColorField value={editColor} onChange={setEditColor} />
          <div>
            <label style={labelStyle}>Stampa scontrino</label>
            <select
              style={inputStyle}
              value={editReceiptPrintMode}
              onChange={(e) => setEditReceiptPrintMode(e.target.value as "included" | "separate")}
            >
              <option value="included">Incluso nello scontrino unico</option>
              <option value="separate">Scontrino separato (documento a parte)</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setEditTarget(null)}>Annulla</Button>
            <Button size="sm" loading={editSaving} onClick={() => void handleEditSave()}>Salva</Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Elimina centro di produzione">
        <p style={{ color: "var(--color-gray-600)", fontSize: "var(--text-sm)", marginBottom: "20px" }}>
          Sei sicuro di voler eliminare questo centro? Tutte le associazioni con le categorie verranno rimosse.
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>Annulla</Button>
          <Button variant="danger" size="sm" onClick={() => deleteId && void handleDelete(deleteId)}>
            Elimina
          </Button>
        </div>
      </Modal>
    </div>
  );
}
