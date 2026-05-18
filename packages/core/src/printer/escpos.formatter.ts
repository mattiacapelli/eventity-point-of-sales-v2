export interface ReceiptLine {
  type: "text" | "divider" | "item" | "total" | "header";
  content?: string;
  left?: string;
  right?: string;
  bold?: boolean;
  width?: number;
}

const DEFAULT_WIDTH = 42;

function pad(left: string, right: string, width: number): string {
  const gap = width - left.length - right.length;
  return gap > 0 ? `${left}${" ".repeat(gap)}${right}` : `${left} ${right}`;
}

export function formatReceipt(lines: ReceiptLine[], width = DEFAULT_WIDTH): string {
  return lines.map((line) => {
    const w = line.width ?? width;
    switch (line.type) {
      case "divider":
        return "-".repeat(w);
      case "header":
        return (line.content ?? "").toUpperCase().padStart(Math.floor((w + (line.content ?? "").length) / 2));
      case "text":
        return line.content ?? "";
      case "item":
        return pad(line.left ?? "", line.right ?? "", w);
      case "total":
        return pad((line.left ?? "TOTALE").toUpperCase(), line.right ?? "", w);
    }
  }).join("\n");
}
