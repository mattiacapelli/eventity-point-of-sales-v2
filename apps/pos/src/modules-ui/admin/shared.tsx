import React, { useMemo, useState } from "react";
import { ChevronUpIcon, ChevronDownIcon, MagnifyingGlassIcon, PlusIcon, PencilSquareIcon, TrashIcon } from "../../components/ui/icons.js";
import { Button } from "../../components/ui/Button.js";
import { Modal } from "../../components/ui/Modal.js";

export const tableHeaderStyle: React.CSSProperties = {
  padding: "10px 16px",
  textAlign: "left",
  fontSize: "var(--text-xs)",
  fontWeight: 700,
  color: "var(--color-gray-500)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  borderBottom: "1px solid var(--color-gray-200)",
  background: "var(--color-gray-50)",
};

export const tableCellStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "var(--text-sm)",
  color: "var(--color-gray-700)",
  borderBottom: "1px solid var(--color-gray-100)",
  verticalAlign: "middle",
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "44px",
  padding: "0 14px",
  borderRadius: "var(--radius-lg)",
  border: "2px solid var(--color-gray-200)",
  fontSize: "var(--text-md)",
  fontFamily: "var(--font)",
  color: "var(--color-gray-800)",
  background: "var(--color-white)",
  outline: "none",
  boxSizing: "border-box",
};

export const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  color: "var(--color-gray-600)",
  marginBottom: "6px",
};

/**
 * Standard wrapper for admin data-grid tables: rounded card with shadow,
 * plus consistent loading / empty states. Use for any top-level tabular list.
 */
export function DataTable({
  loading,
  empty,
  emptyMessage = "Nessun elemento.",
  children,
}: {
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
      {loading ? (
        <div style={{ padding: "32px", textAlign: "center", color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>Caricamento...</div>
      ) : empty ? (
        <div style={{ padding: "32px", textAlign: "center", color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>{emptyMessage}</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>{children}</table>
      )}
    </div>
  );
}

/**
 * Standard page header: title + subtitle + optional right-aligned actions.
 * Use at the top of every admin tab content.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", marginBottom: "var(--sp-lg)" }}>
      <div>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", margin: 0 }}>{title}</h2>
        {subtitle && (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)", margin: "4px 0 0" }}>{subtitle}</p>
        )}
      </div>
      {actions && <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

/**
 * Standard responsive field grid for settings/form pages: no card wrapper,
 * fields flow into columns of minmax(240px, 1fr) as space allows.
 */
export function FormGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "18px" }}>
      {children}
    </div>
  );
}

/** A field that should span the full width of its FormGrid row. */
export function FormFieldFull({ children }: { children: React.ReactNode }) {
  return <div style={{ gridColumn: "1 / -1" }}>{children}</div>;
}

/** Section heading used to divide a form page into named groups, no card. */
export function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginTop: "var(--sp-xl)", marginBottom: "var(--sp-sm)" }}>
      <h3 style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--color-gray-800)", margin: 0 }}>{title}</h3>
      {subtitle && <p style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", margin: "2px 0 0" }}>{subtitle}</p>}
    </div>
  );
}

const reorderBtnStyle: React.CSSProperties = {
  padding: "4px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-gray-200)",
  background: "var(--color-white)", cursor: "pointer", color: "var(--color-gray-500)",
  display: "flex", alignItems: "center", justifyContent: "center",
};

/** Up/down arrow pair for reordering rows in a DataTable, replacing drag & drop. */
export function ReorderButtons({
  onUp,
  onDown,
  disabledUp,
  disabledDown,
}: {
  onUp: () => void;
  onDown: () => void;
  disabledUp?: boolean;
  disabledDown?: boolean;
}) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: "2px" }}>
      <button type="button" onClick={onUp} disabled={disabledUp} title="Sposta su"
        style={{ ...reorderBtnStyle, opacity: disabledUp ? 0.35 : 1, cursor: disabledUp ? "default" : "pointer" }}>
        <ChevronUpIcon style={{ width: "13px", height: "13px" }} />
      </button>
      <button type="button" onClick={onDown} disabled={disabledDown} title="Sposta giù"
        style={{ ...reorderBtnStyle, opacity: disabledDown ? 0.35 : 1, cursor: disabledDown ? "default" : "pointer" }}>
        <ChevronDownIcon style={{ width: "13px", height: "13px" }} />
      </button>
    </div>
  );
}

/** Standard small icon-button used in table action columns (edit/delete/expand/...). */
export function IconButton({
  icon,
  title,
  onClick,
  variant = "default",
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        padding: "6px",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${variant === "danger" ? "var(--color-danger)" : "var(--color-gray-200)"}`,
        background: "var(--color-white)",
        cursor: "pointer",
        color: variant === "danger" ? "var(--color-danger)" : "var(--color-gray-600)",
        display: "flex",
        alignItems: "center",
      }}
    >
      {icon}
    </button>
  );
}

/** Convenience edit+delete action pair for use inside a table's actions column. */
export function EditDeleteActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
      {onEdit && <IconButton icon={<PencilSquareIcon style={{ width: "16px", height: "16px" }} />} title="Modifica" onClick={onEdit} />}
      {onDelete && <IconButton icon={<TrashIcon style={{ width: "16px", height: "16px" }} />} title="Elimina" onClick={onDelete} variant="danger" />}
    </div>
  );
}

/** Shared delete-confirmation modal: pass the pending target (or null) and the confirm handler. */
export function DeleteConfirmModal({
  open,
  title = "Elimina elemento",
  message = "Sei sicuro di voler eliminare questo elemento? L'operazione non è reversibile.",
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p style={{ color: "var(--color-gray-600)", fontSize: "var(--text-sm)", marginBottom: "20px" }}>{message}</p>
      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <Button variant="ghost" size="sm" onClick={onClose}>Annulla</Button>
        <Button variant="danger" size="sm" loading={loading ?? false} onClick={onConfirm}>Elimina</Button>
      </div>
    </Modal>
  );
}

export interface AdminTableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  width?: string;
  render: (row: T) => React.ReactNode;
}

export interface AdminTableFilter<T> {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  /** Client-side predicate. Omit when filtering is handled by the caller (e.g. server refetch). */
  predicate?: (row: T, value: string) => boolean;
}

interface AdminTablePageProps<T> {
  title: string;
  subtitle?: string;

  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyMessage?: string;

  /** Placeholder for the search box. Omit `searchPredicate` to hide the search box entirely. */
  searchPlaceholder?: string;
  searchPredicate?: (row: T, query: string) => boolean;

  filters?: Array<AdminTableFilter<T>>;

  columns: Array<AdminTableColumn<T>>;

  /** Optional per-row inline style, e.g. to highlight low-stock rows. */
  rowStyle?: (row: T) => React.CSSProperties | undefined;

  /** Free-form actions column content (edit/delete/expand/test/...). Omit to hide the Azioni column. */
  rowActions?: (row: T) => React.ReactNode;

  /** Renders a full-width expanded row under the given row when `isExpanded(row)` is true. */
  isExpanded?: (row: T) => boolean;
  renderExpanded?: (row: T) => React.ReactNode;

  /** Reorder column (ReorderButtons) as the first column. */
  reorderable?: boolean;
  onReorderUp?: (row: T, index: number) => void;
  onReorderDown?: (row: T, index: number) => void;

  /** Header "Nuovo ..." button. Omit to hide it (read-only lists, or a bespoke header action). */
  createLabel?: string;
  onCreateClick?: () => void;

  /** Extra content rendered in the header actions area, alongside/instead of the create button. */
  extraHeaderActions?: React.ReactNode;

  /** Extra content rendered between the header and the search/filter toolbar (e.g. an upload dropzone). */
  belowHeader?: React.ReactNode;
}

/**
 * Standard admin list page: title + search + filters + create button, a DataTable
 * with a uniform actions column, and optional reorder / expandable-row support.
 * Create/edit/delete forms stay owned by the caller (as sibling Modals) — this
 * component only standardizes the list chrome around them.
 */
export function AdminTablePage<T>({
  title,
  subtitle,
  rows,
  rowKey,
  loading,
  emptyMessage = "Nessun elemento.",
  searchPlaceholder = "Cerca...",
  searchPredicate,
  filters,
  columns,
  rowStyle,
  rowActions,
  isExpanded,
  renderExpanded,
  reorderable,
  onReorderUp,
  onReorderDown,
  createLabel,
  onCreateClick,
  extraHeaderActions,
  belowHeader,
}: AdminTablePageProps<T>) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let result = rows;
    if (searchPredicate && query.trim()) {
      result = result.filter((row) => searchPredicate(row, query.trim()));
    }
    if (filters) {
      for (const f of filters) {
        if (f.predicate && f.value) {
          result = result.filter((row) => f.predicate!(row, f.value));
        }
      }
    }
    return result;
  }, [rows, query, searchPredicate, filters]);

  const hasToolbar = Boolean(searchPredicate) || Boolean(filters && filters.length > 0);

  return (
    <div style={{ padding: "var(--sp-lg)" }}>
      <PageHeader
        title={title}
        {...(subtitle !== undefined ? { subtitle } : {})}
        actions={
          <>
            {extraHeaderActions}
            {createLabel && onCreateClick && (
              <Button size="sm" onClick={onCreateClick} icon={<PlusIcon style={{ width: "16px", height: "16px" }} />}>
                {createLabel}
              </Button>
            )}
          </>
        }
      />

      {belowHeader && <div style={{ marginBottom: "var(--sp-md)" }}>{belowHeader}</div>}

      {hasToolbar && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "var(--sp-md)" }}>
          {searchPredicate && (
            <div style={{ position: "relative", flex: "1 1 240px", minWidth: "200px", maxWidth: "360px" }}>
              <MagnifyingGlassIcon
                style={{
                  position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)",
                  width: "16px", height: "16px", color: "var(--color-gray-400)", pointerEvents: "none",
                }}
              />
              <input
                style={{ ...inputStyle, paddingLeft: "38px" }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
              />
            </div>
          )}
          {filters?.map((f) => (
            <select
              key={f.key}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              style={{ ...inputStyle, width: "auto", minWidth: "160px" }}
            >
              <option value="">{f.label}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ))}
        </div>
      )}

      <DataTable loading={loading ?? false} empty={filtered.length === 0} emptyMessage={emptyMessage}>
        <thead>
          <tr>
            {reorderable && <th style={{ ...tableHeaderStyle, width: "1%" }}>Ordine</th>}
            {columns.map((c) => (
              <th key={c.key} style={{ ...tableHeaderStyle, textAlign: c.align ?? "left", width: c.width }}>
                {c.header}
              </th>
            ))}
            {rowActions && <th style={{ ...tableHeaderStyle, textAlign: "right" }}>Azioni</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map((row, index) => (
            <React.Fragment key={rowKey(row)}>
              <tr style={rowStyle?.(row)}>
                {reorderable && (
                  <td style={tableCellStyle}>
                    <ReorderButtons
                      onUp={() => onReorderUp?.(row, index)}
                      onDown={() => onReorderDown?.(row, index)}
                      disabledUp={index === 0}
                      disabledDown={index === filtered.length - 1}
                    />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} style={{ ...tableCellStyle, textAlign: c.align ?? "left" }}>
                    {c.render(row)}
                  </td>
                ))}
                {rowActions && (
                  <td style={{ ...tableCellStyle, textAlign: "right" }}>
                    {rowActions(row)}
                  </td>
                )}
              </tr>
              {isExpanded?.(row) && renderExpanded && (
                <tr>
                  <td colSpan={columns.length + (reorderable ? 1 : 0) + (rowActions ? 1 : 0)} style={{ ...tableCellStyle, background: "var(--color-gray-50)" }}>
                    {renderExpanded(row)}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: "42px", height: "24px", borderRadius: "12px", border: "none",
        background: value ? "var(--color-brand)" : "var(--color-gray-300)",
        cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: "3px", left: value ? "20px" : "3px",
        width: "18px", height: "18px", borderRadius: "50%",
        background: "var(--color-white)", transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}
