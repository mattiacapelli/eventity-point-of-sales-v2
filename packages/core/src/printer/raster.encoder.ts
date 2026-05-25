import { loadImage, createCanvas } from "canvas";

const GS = 0x1d;
const LF = 0x0a;
const ESC = 0x1b;

export async function pngToEscposRaster(pngBuffer: Buffer, printerWidth = 576): Promise<Buffer> {
  const img = await loadImage(pngBuffer);

  // Scale image to fit printer width if needed
  const scale = printerWidth / img.width;
  const w = printerWidth;
  const h = Math.ceil(img.height * scale);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;

  // Convert to grayscale float array for Floyd-Steinberg dithering
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = pixels[i * 4]!;
    const g = pixels[i * 4 + 1]!;
    const b = pixels[i * 4 + 2]!;
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // Floyd-Steinberg dithering in-place on gray[]
  const mono = new Uint8Array(w * h); // 0 = white, 1 = black
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const idx = row * w + col;
      const old = gray[idx]!;
      const val = old < 128 ? 0 : 255;
      mono[idx] = val === 0 ? 1 : 0;
      const err = old - val;
      if (col + 1 < w)           gray[idx + 1]!           = Math.min(255, Math.max(0, gray[idx + 1]! + err * 7 / 16));
      if (row + 1 < h) {
        if (col - 1 >= 0)        gray[idx + w - 1]!       = Math.min(255, Math.max(0, gray[idx + w - 1]! + err * 3 / 16));
                                 gray[idx + w]!            = Math.min(255, Math.max(0, gray[idx + w]! + err * 5 / 16));
        if (col + 1 < w)         gray[idx + w + 1]!       = Math.min(255, Math.max(0, gray[idx + w + 1]! + err * 1 / 16));
      }
    }
  }

  // Round width up to nearest byte boundary
  const widthBytes = Math.ceil(w / 8);

  // Build 1bpp bitmap row by row from dithered mono array
  const bitmapRows: number[] = [];
  for (let row = 0; row < h; row++) {
    for (let byteIdx = 0; byteIdx < widthBytes; byteIdx++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const col = byteIdx * 8 + bit;
        if (col < w && mono[row * w + col]) {
          byte |= (0x80 >> bit);
        }
      }
      bitmapRows.push(byte);
    }
  }

  const bitmap = Buffer.from(bitmapRows);

  // xL xH = width in bytes (little-endian)
  const xL = widthBytes & 0xff;
  const xH = (widthBytes >> 8) & 0xff;
  // yL yH = height in dots (little-endian)
  const yL = h & 0xff;
  const yH = (h >> 8) & 0xff;

  // GS v 0: [1D 76 30 m xL xH yL yH data...]
  // m=0: normal density
  const header = Buffer.from([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH]);

  // Feed and cut after image
  const tail = Buffer.from([LF, LF, LF, GS, 0x56, 0x41, 0x00]);

  // ESC @ init
  const init = Buffer.from([ESC, 0x40]);

  return Buffer.concat([init, header, bitmap, tail]);
}

