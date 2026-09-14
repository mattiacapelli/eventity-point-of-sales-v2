import { useEffect, useRef, useState } from "react";
import { PencilSquareIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";
import type { ProductRecord } from "../../core/types.js";
import { listProducts, listCategories, renameProduct, updateProductAvailability, uploadProductImage, deleteProductImage, API_BASE } from "../../core/api-client.js";
import { Input } from "../../components/Input.js";
import { ErrorRetry } from "../../components/ErrorRetry.js";
import { EmptyState } from "../../components/EmptyState.js";
import { AvailableDatesEditor } from "../../components/AvailableDatesEditor.js";
import { Table, TableHead, Th, Tr, Td } from "../../components/Table.js";
import { IconButton } from "../../components/IconButton.js";
import { useToast } from "../../components/Toast.js";

function formatEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

export function ProductsPanel({ tenantId }: { tenantId: string }) {
  const { showToast } = useToast();
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [categoryNameById, setCategoryNameById] = useState<Record<number, string>>({});
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingProductId, setSavingProductId] = useState<number | null>(null);
  const [editingAvailabilityId, setEditingAvailabilityId] = useState<number | null>(null);
  const [uploadingImageId, setUploadingImageId] = useState<number | null>(null);
  const [imageTargetProductId, setImageTargetProductId] = useState<number | null>(null);
  const productImageInputRef = useRef<HTMLInputElement>(null);
  const availabilityBtnRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  function loadProducts() {
    setProductsError(null);
    listProducts(tenantId)
      .then(setProducts)
      .catch((err) => setProductsError(err instanceof Error ? err.message : "Impossibile caricare i prodotti"));
  }

  useEffect(loadProducts, [tenantId]);

  useEffect(() => {
    listCategories(tenantId)
      .then((rows) => setCategoryNameById(Object.fromEntries(rows.map((c) => [c.id, c.name]))))
      .catch(() => setCategoryNameById({}));
  }, [tenantId]);

  function startEditing(product: ProductRecord) {
    setEditingProductId(product.id);
    setEditingName(product.name);
  }

  async function saveProductName(product: ProductRecord) {
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === product.name) {
      setEditingProductId(null);
      return;
    }
    setSavingProductId(product.id);
    try {
      const updated = await renameProduct(tenantId, product.id, trimmed);
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
      showToast("Prodotto rinominato");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile rinominare il prodotto", "error");
    } finally {
      setSavingProductId(null);
      setEditingProductId(null);
    }
  }

  async function handleAvailabilityChange(product: ProductRecord, dates: string[]) {
    const nextDates = dates.length > 0 ? dates : null;
    try {
      const updated = await updateProductAvailability(tenantId, product.id, nextDates);
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile aggiornare la disponibilità", "error");
    }
  }

  function openImagePicker(productId: number) {
    setImageTargetProductId(productId);
    productImageInputRef.current?.click();
  }

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    const productId = imageTargetProductId;
    if (!file || productId === null) return;
    setUploadingImageId(productId);
    try {
      const updated = await uploadProductImage(tenantId, productId, file);
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile caricare l'immagine", "error");
    } finally {
      setUploadingImageId(null);
      setImageTargetProductId(null);
    }
  }

  async function handleRemoveImage(product: ProductRecord) {
    setUploadingImageId(product.id);
    try {
      await deleteProductImage(tenantId, product.id);
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, imagePath: null } : p)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile rimuovere l'immagine", "error");
    } finally {
      setUploadingImageId(null);
    }
  }

  return (
    <div>
      {productsError ? (
        <ErrorRetry message={productsError} onRetry={loadProducts} />
      ) : products.length === 0 ? (
        <EmptyState>Nessun prodotto</EmptyState>
      ) : (
        <>
          <input
            ref={productImageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => void handleImageSelected(e)}
            style={{ display: "none" }}
          />
          <Table>
            <TableHead>
              <Th width="56px" align="center">Foto</Th>
              <Th width="70px">ID</Th>
              <Th>Nome</Th>
              <Th>Categoria</Th>
              <Th width="100px" align="right">Prezzo</Th>
              <Th width="180px" align="right">Disponibilità</Th>
            </TableHead>
            <tbody>
              {products.map((p) => (
                <Tr key={p.id}>
                  <Td align="center">
                    <div style={{ position: "relative", display: "inline-block" }}>
                      <IconButton
                        variant="outline"
                        onClick={() => openImagePicker(p.id)}
                        disabled={uploadingImageId === p.id}
                        aria-label="Carica immagine"
                        style={{ width: "36px", height: "36px", overflow: "hidden" }}
                      >
                        {p.imagePath ? (
                          <img src={`${API_BASE}/api/static/${p.imagePath}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>＋</span>
                        )}
                      </IconButton>
                      {p.imagePath && (
                        <button
                          onClick={() => void handleRemoveImage(p)}
                          disabled={uploadingImageId === p.id}
                          aria-label="Rimuovi immagine"
                          style={{
                            position: "absolute", top: "-6px", right: "-6px",
                            width: "16px", height: "16px", borderRadius: "50%",
                            background: "var(--color-danger)", color: "var(--color-white)",
                            fontSize: "9px", fontWeight: 700, lineHeight: "16px", textAlign: "center",
                            border: "2px solid var(--color-white)",
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <code style={{ color: "var(--color-gray-400)" }}>#{p.id}</code>
                  </Td>
                  <Td>
                    {editingProductId === p.id ? (
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveProductName(p);
                          if (e.key === "Escape") setEditingProductId(null);
                        }}
                        onBlur={() => void saveProductName(p)}
                        autoFocus
                        disabled={savingProductId === p.id}
                      />
                    ) : (
                      <button
                        onClick={() => startEditing(p)}
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", textAlign: "left" }}
                      >
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                        <PencilSquareIcon width={14} height={14} color="var(--color-gray-400)" />
                      </button>
                    )}
                  </Td>
                  <Td>
                    <span style={{ color: "var(--color-gray-500)" }}>{categoryNameById[p.categoryId] ?? "—"}</span>
                  </Td>
                  <Td align="right">
                    <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatEur(p.price)}</span>
                  </Td>
                  <Td align="right">
                    <button
                      ref={(el) => { if (el) availabilityBtnRefs.current.set(p.id, el); else availabilityBtnRefs.current.delete(p.id); }}
                      onClick={() => setEditingAvailabilityId(editingAvailabilityId === p.id ? null : p.id)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "6px",
                        padding: "6px 10px", borderRadius: "var(--radius-md)",
                        border: `1px solid ${p.availableDates ? "var(--color-brand)" : "var(--color-gray-200)"}`,
                        background: "var(--color-white)",
                        color: p.availableDates ? "var(--color-brand)" : "var(--color-gray-500)",
                        fontSize: "var(--text-xs)", fontWeight: 600,
                      }}
                    >
                      <CalendarDaysIcon width={14} height={14} />
                      {p.availableDates ? `${p.availableDates.length} giorni` : "Sempre visibile"}
                    </button>
                    {editingAvailabilityId === p.id && availabilityBtnRefs.current.has(p.id) && (
                      <AvailableDatesEditor
                        anchorRef={{ current: availabilityBtnRefs.current.get(p.id)! }}
                        dates={p.availableDates ?? []}
                        onChange={(dates) => void handleAvailabilityChange(p, dates)}
                        onClose={() => setEditingAvailabilityId(null)}
                      />
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </div>
  );
}
