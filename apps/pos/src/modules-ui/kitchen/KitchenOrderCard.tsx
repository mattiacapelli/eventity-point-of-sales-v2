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

const cardBorder: Partial<Record<OrderStatus, string>> = {
  pending:   "var(--status-pending)",
  confirmed: "var(--status-confirmed)",
  preparing: "var(--status-preparing)",
  ready:     "var(--status-ready)",
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
  if (mins >= 20) return "#dc2626"; // red — late
  if (mins >= 10) return "#f59e0b"; // amber — approaching
  return null;
}

interface Props {
  order: Order;
  onUpdated: (order: Order) => void;
}

export function KitchenOrderCard({ order, onUpdated }: Props) {
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

  return (
    <div
      style={{
        background: isReady ? "rgba(34,197,94,0.06)" : "var(--color-gray-800)",
        border: `2px solid ${delay ?? cardBorder[order.status] ?? "var(--color-gray-700)"}`,
        boxShadow: delay ? `0 0 0 1px ${delay}` : undefined,
        borderRadius: "var(--radius-xl)",
        padding: "var(--sp-lg)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-md)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: delay ?? "var(--color-gray-400)", fontSize: "var(--text-xs)", fontWeight: delay ? 700 : 600 }}>
            {elapsedLabel(order.createdAt)}
          </div>
          <div style={{ color: "var(--color-white)", fontSize: "var(--text-lg)", fontWeight: 700, marginTop: "2px" }}>
            #{order.id}
          </div>
          {order.tableId && (
            <div style={{ color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>
              Tavolo {order.tableId}
            </div>
          )}
        </div>
        <Badge variant={order.status as OrderStatus} />
      </div>

      {/* Items */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          borderTop: "1px solid var(--color-gray-700)",
          paddingTop: "var(--sp-sm)",
        }}
      >
        {order.items.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <span style={{ color: "var(--color-white)", fontSize: "var(--text-md)", fontWeight: 500 }}>
              {item.name}
            </span>
            <span
              style={{
                background: "var(--color-gray-700)",
                color: "var(--color-gray-200)",
                borderRadius: "var(--radius-pill)",
                padding: "1px 10px",
                fontSize: "var(--text-sm)",
                fontWeight: 700,
              }}
            >
              ×{item.quantity}
            </span>
          </div>
        ))}
      </div>

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
        <div
          style={{
            textAlign: "center",
            color: "var(--color-success)",
            fontWeight: 700,
            fontSize: "var(--text-lg)",
            padding: "var(--sp-sm)",
            background: "rgba(34,197,94,0.1)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          ✓ Pronto per il ritiro
        </div>
      )}
    </div>
  );
}
