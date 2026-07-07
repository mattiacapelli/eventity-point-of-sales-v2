import { existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { registerFont } from "canvas";

const BUNDLED_FONTS_DIR = new URL("../../assets/fonts", import.meta.url).pathname;
const CUSTOM_FONTS_DIR = "/data/fonts";

let fontsRegistered = false;

export function ensureFontsRegistered(): void {
  if (fontsRegistered) return;
  fontsRegistered = true;

  const dirs = [BUNDLED_FONTS_DIR, CUSTOM_FONTS_DIR].filter(existsSync);
  for (const dir of dirs) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".ttf"))) {
      try {
        const family = basename(file, ".ttf").replace(/-Bold$/, "").replace(/-/g, " ");
        const weight = file.includes("Bold") ? "bold" : "normal";
        registerFont(join(dir, file), { family, weight });
      } catch {
        // skip unreadable font
      }
    }
  }
}

export function resolveFont(bold: boolean, fontSize: number, fontFamily: string): string {
  const weight = bold ? "bold" : "normal";
  return `${weight} ${fontSize}px "${fontFamily}"`;
}

export function ctxAlign(align: "left" | "center" | "right"): "center" | "right" | "left" {
  return align === "center" ? "center" : align === "right" ? "right" : "left";
}

export function xForAlign(align: "left" | "center" | "right", width: number, padding: number): number {
  if (align === "center") return width / 2;
  if (align === "right") return width - padding;
  return padding;
}

export const CANVAS_PADDING = 20;
export const CANVAS_LINE_GAP = 4;
