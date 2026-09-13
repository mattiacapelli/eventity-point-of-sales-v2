/**
 * stress-print-test.mjs
 *
 * Stress test reale: crea N ordini in parallelo da W worker thread simulati,
 * paga ognuno e aspetta che le stampe partano. Poi esporta il print_log in CSV.
 *
 * Uso:
 *   node stress-print-test.mjs [opzioni]
 *
 * Opzioni (env o argomenti):
 *   --host        URL base server  (default: http://localhost:3000)
 *   --pin         PIN admin        (default: 1234)
 *   --orders      Totale ordini    (default: 50)
 *   --concurrency Ordini paralleli (default: 10)
 *   --terminal    terminalId       (default: 1)
 *   --method      payment method   (default: cash)
 *   --delay-ms    ms tra batch     (default: 0)
 *   --wait-ms     ms attesa stampe (default: 5000)
 *   --out         file CSV output  (default: stress-print-log-<ts>.csv)
 */

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

// ── Config ────────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    host:        { type: "string",  default: "http://localhost:3000" },
    pin:         { type: "string",  default: "1234" },
    orders:      { type: "string",  default: "50" },
    concurrency: { type: "string",  default: "10" },
    terminal:    { type: "string",  default: "1" },  // singolo id oppure "1,2,3" per rotazione
    method:      { type: "string",  default: "cash" },
    "delay-ms":  { type: "string",  default: "0" },
    "wait-ms":   { type: "string",  default: "5000" },
    out:         { type: "string",  default: "" },
  },
  allowPositionals: true,
  strict: false,
});

const HOST        = args.host;
const PIN         = args.pin;
const N_ORDERS    = parseInt(args.orders, 10);
const CONCURRENCY = parseInt(args.concurrency, 10);
// Supporta "1" oppure "1,2,3" per rotazione round-robin tra terminali
const TERMINAL_IDS = args.terminal.split(",").map((s) => parseInt(s.trim(), 10));
const TERMINAL_ID  = TERMINAL_IDS[0]; // usato solo nel summary
const PAY_METHOD  = args.method;
const DELAY_MS    = parseInt(args["delay-ms"], 10);
const WAIT_MS     = parseInt(args["wait-ms"], 10);
const OUT_FILE    = args.out || `stress-print-log-${Date.now()}.csv`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function api(token, method, path, body, extraHeaders = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${HOST}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

function bar(done, total, width = 40) {
  const filled = Math.round((done / total) * width);
  return `[${"█".repeat(filled)}${" ".repeat(width - filled)}] ${done}/${total}`;
}

// ── Login ─────────────────────────────────────────────────────────────────────

async function login() {
  const data = await api(null, "POST", "/auth/login", { pin: PIN });
  return data.token;
}

// ── Load catalog ──────────────────────────────────────────────────────────────

async function loadCatalog(token) {
  const [products, paymentMethods] = await Promise.all([
    api(token, "GET", "/products"),
    api(token, "GET", "/payment-methods"),
  ]);

  // Try to fetch open shift; 404 is OK (no shift required)
  let shiftId;
  try {
    const shift = await api(token, "GET", "/shifts/current");
    shiftId = shift?.id;
  } catch {
    shiftId = undefined;
  }

  const activeProducts = products.filter((p) => p.active !== false);
  if (activeProducts.length === 0) throw new Error("Nessun prodotto attivo trovato");

  const activeMethods = paymentMethods.filter((m) => m.active);
  // PAY_METHOD matches by id (UUID) or by name/type
  const method = activeMethods.find((m) => m.id === PAY_METHOD || m.name === PAY_METHOD || m.type === PAY_METHOD)
    ?? activeMethods[0];
  if (!method) throw new Error("Nessun metodo di pagamento attivo trovato");

  return { products: activeProducts, method, shiftId };
}

// ── Single order ──────────────────────────────────────────────────────────────

async function runOneOrder(token, catalog, index) {
  const { products, method, shiftId } = catalog;
  // Round-robin sui terminali configurati
  const terminalId = TERMINAL_IDS[(index - 1) % TERMINAL_IDS.length];

  // Pick 1-3 random products
  const count = 1 + Math.floor(Math.random() * Math.min(3, products.length));
  const picked = products
    .slice()
    .sort(() => Math.random() - 0.5)
    .slice(0, count);

  const items = picked.map((p) => ({
    productId: p.id,
    name:      p.name,
    quantity:  1 + Math.floor(Math.random() * 3),
    unitPrice: p.price,
  }));

  const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const orderBody = {
    items,
    ...(shiftId !== undefined ? { shiftId: String(shiftId) } : {}),
    notes: `stress-test #${index}`,
  };

  // terminalId va nell'header x-terminal-id, non nel body
  const order = await api(token, "POST", "/orders", orderBody, {
    "x-terminal-id": String(terminalId),
  });

  const payment = await api(token, "POST", "/payments", {
    orderId: order.id,
    method:  method.id,
    amount:  total,
  }, {
    "x-terminal-id": String(terminalId),
  });

  return { orderId: order.id, paymentId: payment.id, total, itemCount: items.length };
}

// ── Run in batches ────────────────────────────────────────────────────────────

async function runBatches(token, catalog) {
  const results = { ok: [], failed: [] };
  let done = 0;

  for (let start = 0; start < N_ORDERS; start += CONCURRENCY) {
    const batchSize = Math.min(CONCURRENCY, N_ORDERS - start);
    const batch = Array.from({ length: batchSize }, (_, i) => start + i + 1);

    const settled = await Promise.allSettled(
      batch.map((idx) => runOneOrder(token, catalog, idx))
    );

    for (let i = 0; i < settled.length; i++) {
      const r = settled[i];
      if (r.status === "fulfilled") {
        results.ok.push({ index: batch[i], ...r.value });
      } else {
        results.failed.push({ index: batch[i], error: r.reason?.message ?? String(r.reason) });
      }
      done++;
    }

    process.stdout.write(`\r${bar(done, N_ORDERS)}  ${results.failed.length} errori`);

    if (DELAY_MS > 0 && start + CONCURRENCY < N_ORDERS) {
      await sleep(DELAY_MS);
    }
  }

  console.log(""); // newline dopo la progress bar
  return results;
}

// ── Fetch print log ───────────────────────────────────────────────────────────

async function fetchPrintLog(token, orderIds) {
  // Fetch in chunks of 50 ordini per evitare risposte troppo grandi
  const allRows = [];
  const chunkSize = 50;
  for (let i = 0; i < orderIds.length; i += chunkSize) {
    const chunk = orderIds.slice(i, i + chunkSize);
    // Fetch per ogni ordine individualmente (la API non supporta multi-id)
    const settled = await Promise.allSettled(
      chunk.map((id) =>
        api(token, "GET", `/admin/print-log?orderId=${id}&limit=100`)
          .then((r) => r.rows ?? [])
      )
    );
    for (const r of settled) {
      if (r.status === "fulfilled") allRows.push(...r.value);
    }
  }
  return allRows;
}

// ── Export CSV ────────────────────────────────────────────────────────────────

function exportCsv(rows) {
  const header = [
    "id","ts","orderId","jobType","printerId","printerName",
    "connectionType","printerHost","printerPort",
    "terminalId","terminalIp","event","attempt","bytes","centerName","errorMsg",
  ].join(",");

  const lines = rows
    .sort((a, b) => a.id - b.id)
    .map((r) => [
      r.id,
      new Date(r.ts).toISOString(),
      r.orderId ?? "",
      r.jobType,
      r.printerId ?? "",
      r.printerName ?? "",
      r.connectionType ?? "",
      r.printerHost ?? "",
      r.printerPort ?? "",
      r.terminalId ?? "",
      r.terminalIp ?? "",
      r.event,
      r.attempt ?? "",
      r.bytes ?? "",
      r.centerName ?? "",
      r.errorMsg ?? "",
    ].map((v) => `"${String(v).replace(/"/g, "'")}"`).join(","));

  writeFileSync(OUT_FILE, [header, ...lines].join("\n"), "utf8");
}

// ── Summary ───────────────────────────────────────────────────────────────────

function printSummary(results, printRows) {
  const eventCounts = {};
  for (const r of printRows) {
    eventCounts[r.event] = (eventCounts[r.event] ?? 0) + 1;
  }

  const okOrders    = results.ok.length;
  const failOrders  = results.failed.length;
  const okPrints    = eventCounts["ok"]     ?? 0;
  const failPrints  = eventCounts["failed"] ?? 0;
  const retryPrints = eventCounts["retry"]  ?? 0;

  console.log("\n─────────────────────────────────────────");
  console.log(`  Ordini inviati:    ${N_ORDERS}`);
  console.log(`  Ordini OK:         ${okOrders}`);
  console.log(`  Ordini falliti:    ${failOrders}`);
  console.log(`  Print log eventi:  ${printRows.length}`);
  console.log(`  Stampe OK:         ${okPrints}`);
  console.log(`  Stampe retry:      ${retryPrints}`);
  console.log(`  Stampe fallite:    ${failPrints}`);
  console.log("─────────────────────────────────────────");
  console.log(`  CSV salvato in:    ${OUT_FILE}`);

  if (results.failed.length > 0) {
    console.log("\n  Ordini falliti:");
    for (const f of results.failed.slice(0, 10)) {
      console.log(`    #${f.index}: ${f.error}`);
    }
    if (results.failed.length > 10) {
      console.log(`    ... e altri ${results.failed.length - 10}`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\n🖨  Stress Print Test`);
  console.log(`   Host:        ${HOST}`);
  console.log(`   Ordini:      ${N_ORDERS}`);
  console.log(`   Concurrency: ${CONCURRENCY}`);
  console.log(`   Terminal ID: ${TERMINAL_IDS.join(", ")}${TERMINAL_IDS.length > 1 ? " (round-robin)" : ""}`);
  console.log(`   Metodo:      ${PAY_METHOD}`);
  console.log(`   Attesa:      ${WAIT_MS}ms dopo ultimo ordine\n`);

  let token;
  try {
    process.stdout.write("  Login... ");
    token = await login();
    console.log("✓");
  } catch (err) {
    console.error(`\n  ERRORE login: ${err.message}`);
    process.exit(1);
  }

  let catalog;
  try {
    process.stdout.write("  Carico catalogo... ");
    catalog = await loadCatalog(token);
    console.log(`✓  (${catalog.products.length} prodotti, metodo: ${catalog.method.name}${catalog.shiftId ? `, turno #${catalog.shiftId}` : " [nessun turno aperto]"})\n`);
  } catch (err) {
    console.error(`\n  ERRORE catalogo: ${err.message}`);
    process.exit(1);
  }

  console.log(`  Invio ${N_ORDERS} ordini (batch da ${CONCURRENCY})...`);
  const results = await runBatches(token, catalog);

  if (results.ok.length === 0) {
    console.error("  Nessun ordine completato — interrompo.");
    process.exit(1);
  }

  console.log(`\n  Attendo ${WAIT_MS}ms per le stampe...`);
  await sleep(WAIT_MS);

  const orderIds = results.ok.map((r) => r.orderId);
  process.stdout.write("  Scarico print log... ");
  const printRows = await fetchPrintLog(token, orderIds);
  console.log(`✓  (${printRows.length} eventi)`);

  exportCsv(printRows);
  printSummary(results, printRows);
})();
