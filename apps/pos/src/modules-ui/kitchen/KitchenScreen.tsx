import React, { useEffect, useState, useCallback, useRef } from "react";
import type { Order } from "@pos/shared-types";
import { KitchenLayout } from "../../layout/KitchenLayout.js";
import { KitchenOrderCard } from "./KitchenOrderCard.js";
import { apiClient } from "../../core/api-client.js";
import { wsClient } from "../../core/ws-client.js";
import { useStore } from "../../state/global-store.js";

const KITCHEN_STATUSES = ["pending", "confirmed", "preparing", "ready"];

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => { void ctx.close(); };
  } catch {
    // AudioContext not available (e.g. during SSR/test)
  }
}

export function KitchenScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(() => localStorage.getItem("kitchen_mute") === "true");
  const mutedRef = useRef(muted);
  const upsertOrder = useStore((s) => s.upsertOrder);

  function toggleMute() {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      localStorage.setItem("kitchen_mute", String(next));
      return next;
    });
  }

  const loadQueue = useCallback(async () => {
    try {
      const res = await apiClient.kitchen.queue();
      setOrders(res.orders);
      res.orders.forEach((o) => upsertOrder(o));
    } catch {
      // silent — keep stale data
    } finally {
      setLoading(false);
    }
  }, [upsertOrder]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  // Subscribe to live updates
  useEffect(() => {
    const unsub1 = wsClient.on("ORDER_CREATED", (payload) => {
      if (KITCHEN_STATUSES.includes(payload.order.status)) {
        setOrders((prev) => {
          if (prev.some((o) => o.id === payload.order.id)) return prev;
          return [payload.order, ...prev];
        });
        if (!mutedRef.current) playBeep();
      }
    });

    const unsub2 = wsClient.on("ORDER_UPDATED", (payload) => {
      setOrders((prev) => {
        if (!KITCHEN_STATUSES.includes(payload.order.status)) {
          return prev.filter((o) => o.id !== payload.order.id);
        }
        return prev.map((o) => (o.id === payload.order.id ? payload.order : o));
      });
    });

    const unsub3 = wsClient.on("ORDER_CANCELLED", (payload) => {
      setOrders((prev) => prev.filter((o) => o.id !== payload.orderId));
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const handleOrderUpdated = useCallback((updated: Order) => {
    setOrders((prev) => {
      if (!KITCHEN_STATUSES.includes(updated.status)) {
        return prev.filter((o) => o.id !== updated.id);
      }
      return prev.map((o) => (o.id === updated.id ? updated : o));
    });
    upsertOrder(updated);
  }, [upsertOrder]);

  // Sort: preparing first, then confirmed, then pending, then ready
  const sortedOrders = [...orders].sort((a, b) => {
    const rank: Record<string, number> = { preparing: 0, confirmed: 1, pending: 2, ready: 3 };
    return (rank[a.status] ?? 99) - (rank[b.status] ?? 99);
  });

  return (
    <KitchenLayout>
      {/* Mute toggle — fixed top-right */}
      <button
        onClick={toggleMute}
        title={muted ? "Attiva suoni" : "Silenzia"}
        style={{
          position: "fixed",
          top: "12px",
          right: "12px",
          zIndex: 300,
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          border: "2px solid var(--color-gray-300)",
          background: muted ? "#fef2f2" : "var(--color-white)",
          cursor: "pointer",
          fontSize: "18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
        }}
      >
        {muted ? "🔇" : "🔔"}
      </button>

      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "200px",
            color: "var(--color-gray-500)",
            fontSize: "var(--text-lg)",
          }}
        >
          Caricamento coda...
        </div>
      ) : sortedOrders.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "40vh",
            gap: "var(--sp-md)",
            color: "var(--color-gray-600)",
          }}
        >
          <span style={{ fontSize: "64px" }}>✓</span>
          <span style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>Coda vuota</span>
          <span style={{ fontSize: "var(--text-md)" }}>Nessun ordine in attesa</span>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--sp-md)",
          }}
        >
          {sortedOrders.map((order) => (
            <KitchenOrderCard
              key={order.id}
              order={order}
              onUpdated={handleOrderUpdated}
            />
          ))}
        </div>
      )}
    </KitchenLayout>
  );
}
