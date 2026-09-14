import React, { useState } from "react";
import type { Order, OrderStatus } from "@pos/shared-types";
import { Badge } from "../../components/ui/Badge.js";
import { Button } from "../../components/ui/Button.js";
import { apiClient } from "../../core/api-client.js";
import { useToastStore } from "../../components/ui/Toast.js";

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending:   "confirmed",
  confirmed: "preparing",
  preparing: "ready",
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  pending:   "Conferma",
  confirmed: "Inizia preparazione",
  preparing: "Pronto ✓",
};

function elapsedMinutes(createdAt: Date | string): number {
  const diff = Date.now() - new Date(createdAt).getTime();
  return Math.floor(diff / 60_000);
}

function elapsedLabel(createdAt: Date | string): string {
  const mins = elapsedMinutes(createdAt);
  if (mins < 1) return "Adesso";
  if (mins === 1) return "1 min fa";
  return `${mins} min fa`;
}

function delayColor(mins: number): string | null {
  if (mins >= 20) return "var(--color-danger)"; // late
  if (mins >= 10) return "var(--color-warning)"; // approaching
  return null;
}

interface Props {
  order: Order;
  onUpdated: (order: Order) => void;
  centerNames?: Record<number, string>;
}

export function KitchenOrderCard({ order, onUpdated, centerNames }: Props) {
  const [loading, setLoading] = useState(false);
  const nextStatus = NEXT_STATUS[order.status];

  const handleAdvance = async () => {
    if (!nextStatus) return;
    setLoading(true);
    try {
      const updated = await apiClient.kitchen.transition(order.id, nextStatus);
      onUpdated(updated);
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore nell'aggiornamento dell'ordine");
    } finally {
      setLoading(false);
    }
  };

  const isReady = order.status === "ready";
  const delay = isReady ? null : delayColor(elapsedMinutes(order.createdAt));
  const code = order.centerNumbers && centerNames
    ? Object.entries(order.centerNumbers).map(([cid, num]) => `${centerNames[Number(cid)] ?? `#${cid}`}: #${num}`).join(" · ")
    : `#${order.id}`;

  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--color-gray-100)", display: "flex", flexDirection: "column", gap: "9px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "17px", fontWeight: 700, color: "var(--color-gray-900)" }}>{code}</span>
        <span style={{
          padding: "3px 8px", borderRadius: "7px", fontSize: "12.5px", fontWeight: 700,
          background: delay ? "rgba(154,44,34,0.1)" : "var(--color-gray-100)",
          color: delay ?? "var(--color-gray-700)",
        }}>
          {elapsedLabel(order.createdAt)}
        </span>
        <span style={{ flex: 1 }} />
        <Badge variant={order.status as OrderStatus} size="sm" />
      </div>
      {order.tableId && (
        <div style={{ fontSize: "13px", color: "var(--color-gray-600)", marginTop: "-4px" }}>
          Tavolo {order.tableId}
        </div>
      )}

      {/* Items */}
      {order.items.map((item) => (
        <div key={item.id} style={{ display: "flex", gap: "10px", fontSize: "15px" }}>
          <span style={{ fontWeight: 700, color: "var(--color-brand)", minWidth: "28px" }}>{item.quantity}×</span>
          <span style={{ flex: 1, lineHeight: 1.35, color: "var(--color-gray-900)" }}>{item.name}</span>
        </div>
      ))}

      {/* Action */}
      {nextStatus && (
        <Button
          fullWidth
          size="lg"
          variant={order.status === "preparing" ? "accent" : "primary"}
          loading={loading}
          onClick={() => void handleAdvance()}
        >
          {NEXT_LABEL[order.status]}
        </Button>
      )}
      {isReady && (
        <div style={{
          textAlign: "center", color: "var(--color-brand)", fontWeight: 700, fontSize: "var(--text-md)",
          padding: "10px", background: "#E8F0EA", borderRadius: "11px",
        }}>
          ✓ Pronto per il ritiro
        </div>
      )}
    </div>
  );
}
