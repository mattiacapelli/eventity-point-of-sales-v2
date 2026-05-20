const DEFAULT_WIDTH = 42;

export interface KitchenTicketItem {
  name: string;
  quantity: number;
  options?: string[];   // selected options / additions
  removals?: string[];  // "NO onion" style removals
  notes?: string;
}

export interface KitchenTicketData {
  orderId: string;
  centerName: string;
  timestamp: Date;
  items: KitchenTicketItem[];
}

function divider(width: number): string {
  return "=".repeat(width);
}

function center(text: string, width: number): string {
  const padded = Math.floor((width + text.length) / 2);
  return text.padStart(padded);
}

function bigOrderNumber(orderId: string, width: number): string {
  const short = `#${orderId.slice(-6).toUpperCase()}`;
  // Double-width simulation with spaces between chars (ESC/POS would use GS ! 0x11 but plain text fallback)
  const spaced = short.split("").join(" ");
  return center(spaced, width);
}

export function formatKitchenTicket(data: KitchenTicketData, width = DEFAULT_WIDTH): string {
  const lines: string[] = [];

  lines.push(divider(width));
  lines.push(center(data.centerName.toUpperCase(), width));
  lines.push(divider(width));
  lines.push(bigOrderNumber(data.orderId, width));
  lines.push(center(data.timestamp.toLocaleString("it-IT"), width));
  lines.push(divider(width));
  lines.push("");

  for (const item of data.items) {
    // Main item line: qty × name
    const qty = String(item.quantity).padStart(2);
    lines.push(`${qty}x  ${item.name}`);

    // Options (additions)
    for (const opt of item.options ?? []) {
      lines.push(`      + ${opt}`);
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
