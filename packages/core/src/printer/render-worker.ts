import { parentPort } from "node:worker_threads";
import { renderReceiptImage } from "./image-receipt.renderer.js";
import { renderKitchenImage } from "./kitchen-image.renderer.js";
import { pngToEscposRaster } from "./raster.encoder.js";
import type { ReceiptRenderData } from "./image-receipt.renderer.js";
import type { KitchenRenderData } from "./kitchen-image.renderer.js";

if (!parentPort) throw new Error("render-worker must run as a Worker Thread");

type ReceiptMsg = {
  id: number;
  type: "receipt";
  canvasWidth: number;
  data: Omit<ReceiptRenderData, "paidAt"> & { paidAt: string };
};

type KitchenMsg = {
  id: number;
  type: "kitchen";
  canvasWidth: number;
  data: Omit<KitchenRenderData, "timestamp"> & { timestamp: string };
};

type WorkerMsg = ReceiptMsg | KitchenMsg;

parentPort.on("message", async (msg: WorkerMsg) => {
  const port = parentPort!;
  try {
    let pngBuffer: Buffer;

    if (msg.type === "receipt") {
      pngBuffer = await renderReceiptImage({
        ...msg.data,
        paidAt: new Date(msg.data.paidAt),
      });
    } else {
      pngBuffer = await renderKitchenImage({
        ...msg.data,
        timestamp: new Date(msg.data.timestamp),
      });
    }

    const rasterBuffer = await pngToEscposRaster(pngBuffer, msg.canvasWidth);
    const ab = rasterBuffer.buffer.slice(rasterBuffer.byteOffset, rasterBuffer.byteOffset + rasterBuffer.byteLength);
    port.postMessage({ id: msg.id, ok: true, buffer: ab }, [ab as ArrayBuffer]);
  } catch (err) {
    port.postMessage({ id: msg.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});
