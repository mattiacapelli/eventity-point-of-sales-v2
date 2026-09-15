import { useEffect, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import { useAdminStore } from "../../state/admin-store.js";
import { Button } from "../../components/ui/Button.js";
import { Modal } from "../../components/ui/Modal.js";
import type { Category, ProductionCenter, Printer } from "@pos/shared-types";
import { PlusIcon, XMarkIcon, PrinterIcon } from "../../components/ui/icons.js";
import { inputStyle, labelStyle, AdminTablePage, EditDeleteActions, DeleteConfirmModal } from "./shared.js";
import { ColorField } from "./ColorField.js";
import { IconPickerField, getProductionCenterIcon } from "./IconPickerField.js";

export function ProductionCentersTab() {
  const { productionCenters, categories, upsertProductionCenter, removeProductionCenter, setProductionCenters } = useAdminStore();

  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= productionCenters.length) return;
    const reordered = [...productionCenters];
    const tmp = reordered[index]!;
    reordered[index] = reordered[target]!;
    reordered[target] = tmp;
    setProductionCenters(reordered);
    await adminApi.productionCenters.reorder(reordered.map((pc) => pc.id));
  }

  // Per-center assigned categories (loaded lazily)
  const [centerCategories, setCenterCategories] = useState<Record<number, Category[]>>({});
  const [loadedCenters, setLoadedCenters] = useState<Set<number>>(new Set());

  // Per-center assigned printers
  const [centerPrinters, setCenterPrinters] = useState<Record<number, Array<Pick<Printer, "id" | "name" | "host" | "port" | "kitchenEnabled" | "active">>>>({});
  const [loadedPrinterCenters, setLoadedPrinterCenters] = useState<Set<number>>(new Set());
  const [allPrinters, setAllPrinters] = useState<Printer[]>([]);
  const [printerDropdown, setPrinterDropdown] = useState<number | null>(null);

  // Modal: new center
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCenterName, setNewCenterName] = useState("");
  const [newCenterColor, setNewCenterColor] = useState("");
  const [newCenterIcon, setNewCenterIcon] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit center
  const [editTarget, setEditTarget] = useState<ProductionCenter | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editReceiptPrintMode, setEditReceiptPrintMode] = useState<"included" | "separate">("included");
  const [editSaving, setEditSaving] = useState(false);

  // Delete center
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Dropdown for adding category to a center
  const [addDropdown, setAddDropdown] = useState<number | null>(null);

  async function loadCenterCategories(centerId: number) {
    if (loadedCenters.has(centerId)) return;
    const cats = await adminApi.productionCenters.getCategories(centerId);
    setCenterCategories((prev) => ({ ...prev, [centerId]: cats }));
    setLoadedCenters((prev) => new Set(prev).add(centerId));
  }

  async function loadCenterPrinters(centerId: number) {
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
        icon: newCenterIcon === "" ? null : newCenterIcon,
      });
      upsertProductionCenter(created);
      setCenterCategories((prev) => ({ ...prev, [created.id]: [] }));
      setLoadedCenters((prev) => new Set(prev).add(created.id));
      setNewCenterName("");
      setNewCenterColor("");
      setNewCenterIcon("");
      setCreateModalOpen(false);
    } finally {
      setCreating(false);
    }
  }

  function startEdit(pc: ProductionCenter) {
    setEditTarget(pc);
    setEditName(pc.name);
    setEditColor(pc.color ?? "");
    setEditIcon(pc.icon ?? "");
    setEditReceiptPrintMode(pc.receiptPrintMode);
  }

  async function handleEditSave() {
    if (!editTarget || !editName.trim()) return;
    setEditSaving(true);
    try {
      const updated = await adminApi.productionCenters.update(editTarget.id, {
        name: editName.trim(),
        color: editColor === "" ? null : editColor,
        icon: editIcon === "" ? null : editIcon,
        receiptPrintMode: editReceiptPrintMode,
      });
      upsertProductionCenter(updated);
      setEditTarget(null);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await adminApi.productionCenters.delete(id);
    removeProductionCenter(id);
    setCenterCategories((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setDeleteId(null);
  }

  async function handleAssignCategory(centerId: number, categoryId: number) {
    await adminApi.productionCenters.assignCategory(centerId, categoryId);
    const cats = await adminApi.productionCenters.getCategories(centerId);
    setCenterCategories((prev) => ({ ...prev, [centerId]: cats }));
    setAddDropdown(null);
  }

  async function handleRemoveCategory(centerId: number, categoryId: number) {
    await adminApi.productionCenters.removeCategory(centerId, categoryId);
    const cats = await adminApi.productionCenters.getCategories(centerId);
    setCenterCategories((prev) => ({ ...prev, [centerId]: cats }));
  }

  async function handleAssignPrinter(centerId: number, printerId: number) {
    await adminApi.productionCenters.assignPrinter(centerId, printerId);
    const prs = await adminApi.productionCenters.getPrinters(centerId);
    setCenterPrinters((prev) => ({ ...prev, [centerId]: prs }));
    setPrinterDropdown(null);
  }

  async function handleRemovePrinter(centerId: number, printerId: number) {
    await adminApi.productionCenters.removePrinter(centerId, printerId);
    const prs = await adminApi.productionCenters.getPrinters(centerId);
    setCenterPrinters((prev) => ({ ...prev, [centerId]: prs }));
  }

  return (
    <>
      <AdminTablePage
        title="Centri di produzione"
        rows={productionCenters}
        rowKey={(pc) => pc.id}
        emptyMessage='Nessun centro di produzione. Clicca "Nuovo centro" per aggiungerne uno.'
        searchPlaceholder="Cerca centro..."
        searchPredicate={(pc, q) => pc.name.toLowerCase().includes(q.toLowerCase())}
        reorderable
        onReorderUp={(_pc, index) => void move(index, -1)}
        onReorderDown={(_pc, index) => void move(index, 1)}
        columns={[
          {
            key: "name",
            header: "Nome",
            render: (pc) => {
              const Icon = getProductionCenterIcon(pc.icon);
              return (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Icon style={{ width: "16px", height: "16px", color: pc.color ?? "var(--color-brand)", flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: "var(--color-gray-800)" }}>{pc.name}</span>
                </div>
              );
            },
          },
          {
            key: "categories",
            header: "Categorie",
            render: (pc) => {
              const assigned = centerCategories[pc.id] ?? [];
              return assigned.length > 0
                ? <span style={{ color: "var(--color-gray-600)" }}>{assigned.map((c) => c.name).join(", ")}</span>
                : <span style={{ color: "var(--color-gray-400)" }}>Nessuna</span>;
            },
          },
          {
            key: "receipt",
            header: "Scontrino",
            render: (pc) => (pc.receiptPrintMode === "separate" ? "Separato" : "Incluso"),
          },
        ]}
        rowActions={(pc) => {
          const isExpanded = expandedId === pc.id;
          return (
            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : pc.id)}
                title="Categorie e stampanti"
                style={{
                  padding: "6px 10px", borderRadius: "var(--radius-md)",
                  border: isExpanded ? "1px solid var(--color-brand)" : "1px solid var(--color-gray-200)",
                  background: isExpanded ? "rgba(23,102,60,0.06)" : "var(--color-white)",
                  cursor: "pointer", color: isExpanded ? "var(--color-brand)" : "var(--color-gray-500)",
                  fontSize: "var(--text-xs)", fontWeight: 600, fontFamily: "var(--font)",
                }}
              >
                Dettagli
              </button>
              <EditDeleteActions onEdit={() => startEdit(pc)} onDelete={() => setDeleteId(pc.id)} />
            </div>
          );
        }}
        isExpanded={(pc) => expandedId === pc.id}
        renderExpanded={(pc) => (
          <ProductionCenterDetails
            center={pc}
            assignedCategories={centerCategories[pc.id] ?? []}
            allCategories={categories}
            assignedPrinters={centerPrinters[pc.id] ?? []}
            allPrinters={allPrinters}
            addDropdownOpen={addDropdown === pc.id}
            onToggleAddDropdown={() => setAddDropdown(addDropdown === pc.id ? null : pc.id)}
            printerDropdownOpen={printerDropdown === pc.id}
            onTogglePrinterDropdown={() => setPrinterDropdown(printerDropdown === pc.id ? null : pc.id)}
            onAssignCategory={(catId) => void handleAssignCategory(pc.id, catId)}
            onRemoveCategory={(catId) => void handleRemoveCategory(pc.id, catId)}
            onAssignPrinter={(pId) => void handleAssignPrinter(pc.id, pId)}
            onRemovePrinter={(pId) => void handleRemovePrinter(pc.id, pId)}
          />
        )}
        createLabel="Nuovo centro"
        onCreateClick={() => setCreateModalOpen(true)}
      />

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
          <IconPickerField value={newCenterIcon} onChange={setNewCenterIcon} />
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
          <IconPickerField value={editIcon} onChange={setEditIcon} />
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

      <DeleteConfirmModal
        open={deleteId !== null}
        title="Elimina centro di produzione"
        message="Sei sicuro di voler eliminare questo centro? Tutte le associazioni con le categorie verranno rimosse."
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && void handleDelete(deleteId)}
      />
    </>
  );
}

function ProductionCenterDetails({
  center,
  assignedCategories,
  allCategories,
  assignedPrinters,
  allPrinters,
  addDropdownOpen,
  onToggleAddDropdown,
  printerDropdownOpen,
  onTogglePrinterDropdown,
  onAssignCategory,
  onRemoveCategory,
  onAssignPrinter,
  onRemovePrinter,
}: {
  center: ProductionCenter;
  assignedCategories: Category[];
  allCategories: Category[];
  assignedPrinters: Array<Pick<Printer, "id" | "name" | "host" | "port" | "kitchenEnabled" | "active">>;
  allPrinters: Printer[];
  addDropdownOpen: boolean;
  onToggleAddDropdown: () => void;
  printerDropdownOpen: boolean;
  onTogglePrinterDropdown: () => void;
  onAssignCategory: (categoryId: number) => void;
  onRemoveCategory: (categoryId: number) => void;
  onAssignPrinter: (printerId: number) => void;
  onRemovePrinter: (printerId: number) => void;
}) {
  const unassigned = allCategories.filter((c) => !assignedCategories.some((a) => a.id === c.id));
  const unassignedPrinters = allPrinters.filter((p) => p.kitchenEnabled && !assignedPrinters.some((a) => a.id === p.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingTop: "4px" }}>
      {/* Categorie */}
      <div>
        <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
          Categorie
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          {assignedCategories.map((cat) => (
            <span key={cat.id} style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              padding: "3px 10px", borderRadius: "20px",
              background: "rgba(23,102,60,0.1)", color: "var(--color-brand)",
              fontSize: "var(--text-xs)", fontWeight: 600,
            }}>
              {cat.name}
              <button onClick={() => onRemoveCategory(cat.id)} title="Rimuovi"
                style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: "0", color: "var(--color-brand)", opacity: 0.7 }}>
                <XMarkIcon style={{ width: "12px", height: "12px" }} />
              </button>
            </span>
          ))}
          {assignedCategories.length === 0 && (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>Nessuna categoria assegnata</span>
          )}
          {unassigned.length > 0 && (
            <div style={{ position: "relative" }}>
              <button onClick={onToggleAddDropdown} style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                padding: "5px 12px", borderRadius: "20px",
                border: "1.5px dashed var(--color-gray-300)", background: "transparent",
                cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-gray-500)",
              }}>
                <PlusIcon style={{ width: "12px", height: "12px" }} />
                Aggiungi categoria
              </button>
              {addDropdownOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0,
                  background: "var(--color-white)", borderRadius: "var(--radius-lg)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                  border: "1px solid var(--color-gray-200)", minWidth: "200px", zIndex: 100, overflow: "hidden",
                }}>
                  {unassigned.map((cat, i) => (
                    <button key={cat.id} onClick={() => onAssignCategory(cat.id)} style={{
                      width: "100%", padding: "10px 14px", border: "none",
                      borderBottom: i < unassigned.length - 1 ? "1px solid var(--color-gray-100)" : "none",
                      background: "transparent", cursor: "pointer", textAlign: "left",
                      fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-gray-700)", fontFamily: "var(--font)",
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
        </div>
      </div>

      {/* Stampanti */}
      <div>
        <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
          Stampanti cucina
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          {assignedPrinters.map((p) => (
            <span key={p.id} style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              padding: "3px 10px", borderRadius: "20px",
              background: "rgba(99,102,241,0.1)", color: "#4f46e5",
              fontSize: "var(--text-xs)", fontWeight: 600,
            }}>
              <PrinterIcon style={{ width: "11px", height: "11px" }} />
              {p.name}
              <button onClick={() => onRemovePrinter(p.id)}
                style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: "0", color: "#4f46e5", opacity: 0.7 }}>
                <XMarkIcon style={{ width: "12px", height: "12px" }} />
              </button>
            </span>
          ))}
          {assignedPrinters.length === 0 && (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>Fallback su tutte le stampanti kitchen</span>
          )}
          {unassignedPrinters.length > 0 && (
            <div style={{ position: "relative" }}>
              <button onClick={onTogglePrinterDropdown} style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                padding: "5px 12px", borderRadius: "20px",
                border: "1.5px dashed var(--color-gray-300)", background: "transparent",
                cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-gray-500)",
              }}>
                <PlusIcon style={{ width: "12px", height: "12px" }} />
                Assegna stampante
              </button>
              {printerDropdownOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0,
                  background: "var(--color-white)", borderRadius: "var(--radius-lg)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid var(--color-gray-200)",
                  minWidth: "200px", zIndex: 100, overflow: "hidden",
                }}>
                  {unassignedPrinters.map((p, i) => (
                    <button key={p.id} onClick={() => onAssignPrinter(p.id)} style={{
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
      </div>

      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)" }}>
        Scontrino: {center.receiptPrintMode === "separate" ? "documento separato" : "incluso nello scontrino unico"}
      </div>
    </div>
  );
}
