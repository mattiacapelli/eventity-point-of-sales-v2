const DEFAULT_WIDTH = 42;

export interface KitchenTicketItemOption {
  optionName: string;
  priceDelta: number;
}

export interface KitchenTicketItem {
  name: string;
  quantity: number;
  options?: KitchenTicketItemOption[];
  removals?: string[];
  notes?: string;
}

export interface KitchenTicketData {
  orderId: number;
  receiptDisplay?: string;
  tableId?: string | null;
  customerName?: string | null;
  centerName: string;
  timestamp: Date;
  orderNotes?: string | null;
  pax?: number | null;
  items: KitchenTicketItem[];
  isModification?: boolean;
}

function divider(width: number): string {
  return "=".repeat(width);
}

function center(text: string, width: number): string {
  const padded = Math.floor((width + text.length) / 2);
  return text.padStart(padded);
}

function bigOrderNumber(displayNum: string, width: number): string {
  const short = `#${displayNum}`;
  // Double-width simulation with spaces between chars (ESC/POS would use GS ! 0x11 but plain text fallback)
  const spaced = short.split("").join(" ");
  return center(spaced, width);
}

export function formatKitchenTicket(data: KitchenTicketData, width = DEFAULT_WIDTH): string {
  const lines: string[] = [];

  lines.push(divider(width));
  if (data.isModification) {
    lines.push(center("*** MODIFICA ***", width));
  }
  lines.push(center(data.centerName.toUpperCase(), width));
  lines.push(divider(width));
  lines.push(bigOrderNumber(data.receiptDisplay ?? String(data.orderId), width));
  if (data.tableId) {
    lines.push(center(`Tavolo ${data.tableId}`, width));
  }
  if (data.customerName) {
    lines.push(center(`Cliente: ${data.customerName}`, width));
  }
  if (data.pax) {
    lines.push(center(`Coperti: ${data.pax}`, width));
  }
  lines.push(center(data.timestamp.toLocaleString("it-IT"), width));
  lines.push(divider(width));
  if (data.orderNotes) {
    lines.push(`NOTE: ${data.orderNotes}`);
    lines.push(divider(width));
  }
  lines.push("");

  for (const item of data.items) {
    const qty = String(item.quantity).padStart(2);
    lines.push(`${qty}x  ${item.name}`);

    // Options (additions)
    for (const opt of item.options ?? []) {
      lines.push(`      + ${opt.optionName}`);
    }

    // Removals
    for (const rem of item.removals ?? []) {
      lines.push(`      NO ${rem}`);
    }

    // Notes
    if (item.notes) {
      lines.push(`      >> ${item.notes}`);
    }

    lines.push("");
  }

  lines.push(divider(width));
  lines.push("");

  return lines.join("\n");
}
