/**
 * Demo seed — Cucina
 * Carica solo categorie e prodotti della cucina.
 * Esegui con: pnpm --filter @pos/server exec tsx src/seed-demo.ts
 */
import { randomUUID, createHash } from "node:crypto";
import { createDbClient, runMigrations, sql, eq } from "@pos/db";

function stableId(name: string): string {
  const h = createHash("sha1").update("demo:" + name).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

import {
  appSettings, users, categories, products,
  productionCenters, productionCenterCategories, productionCenterPrinters,
  paymentMethods, printers, receiptTemplates,
} from "@pos/db";
import { AuthService } from "@pos/core";

const DB_PATH = process.env["DATABASE_URL"] ?? "./pos.db";
runMigrations(DB_PATH);
const db = createDbClient(DB_PATH);

// ─────────────────────────────────────────────────────────────────────────────
// 1. APP SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── App settings");
const settings: [string, string][] = [
  ["restaurant_name",        "Ristorante"],
  ["receipt_number_prefix",  "R"],
  ["receipt_number_padding", "4"],
  ["express_mode",           "false"],
  ["multi_terminal_enabled", "false"],
];
for (const [key, value] of settings) {
  await db.insert(appSettings).values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: sql`excluded.value` } });
  console.log(`  ${key} = ${value}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. METODI DI PAGAMENTO
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Metodi di pagamento");
const pmRows = [
  { id: "cash",           name: "Contanti",         type: "cash",           active: true, sortOrder: 0, excludeFromTotal: false },
  { id: "card",           name: "Carta",             type: "card",           active: true, sortOrder: 1, excludeFromTotal: false },
  { id: "digital_wallet", name: "Satispay / Wallet", type: "digital_wallet", active: true, sortOrder: 2, excludeFromTotal: false },
];
for (const pm of pmRows) {
  await db.insert(paymentMethods).values({ ...pm, icon: null }).onConflictDoNothing();
  console.log(`  ${pm.name}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. UTENTI
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Utenti");
type UserSpec = { name: string; username: string; role: "admin" | "cashier" | "kitchen" | "waiter"; pin: string };
const USERS_SPEC: UserSpec[] = [
  { name: "Admin",          username: "admin",  role: "admin",   pin: "1234" },
  { name: "Cassa",          username: "cassa",  role: "cashier", pin: "0000" },
];
const authService = new AuthService(db);
for (const u of USERS_SPEC) {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, u.username)).limit(1);
  if (existing.length > 0) {
    console.log(`  ${u.username} (${u.role}) PIN:${u.pin} [già esistente]`);
    continue;
  }
  await authService.createUser({ name: u.name, username: u.username, role: u.role, pin: u.pin });
  console.log(`  ${u.username} (${u.role}) PIN:${u.pin}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CATEGORIE
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Categorie");
type CatKey = "antipasti" | "primi" | "secondi" | "griglia" | "contorni" | "dolci";
const CATS: Record<CatKey, { name: string; color: string; sortOrder: number }> = {
  antipasti: { name: "Antipasti",      color: "#F59E0B", sortOrder: 0 },
  primi:     { name: "Primi piatti",   color: "#EF4444", sortOrder: 1 },
  secondi:   { name: "Secondi piatti", color: "#8B5CF6", sortOrder: 2 },
  griglia:   { name: "Griglia",        color: "#DC2626", sortOrder: 3 },
  contorni:  { name: "Contorni",       color: "#10B981", sortOrder: 4 },
  dolci:     { name: "Dolci / Dessert",color: "#EC4899", sortOrder: 5 },
};
const catIds: Record<CatKey, string> = {} as never;
for (const [key, cat] of Object.entries(CATS) as [CatKey, typeof CATS[CatKey]][]) {
  const id = stableId(`cat:${key}`);
  catIds[key] = id;
  await db.insert(categories).values({ id, name: cat.name, color: cat.color, sortOrder: cat.sortOrder, active: true }).onConflictDoNothing();
  console.log(`  ${cat.name}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. PRODOTTI
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Prodotti");
type Prod = { name: string; price: number; cat: CatKey; description?: string };
const PRODS: Prod[] = [
  // Antipasti
  { name: "Piatto salumi misti",                  price:  7.50, cat: "antipasti", description: "Crudo, salame, pancetta" },
  { name: "Piatto formaggi misti",                price:  6.50, cat: "antipasti", description: "Grana, taleggio, formagella, branzi" },
  { name: "Crudo e melone",                       price:  6.50, cat: "antipasti" },
  { name: "Alici al prezzemolo con polenta",      price:  4.00, cat: "antipasti" },
  { name: "Insalata di mare",                     price: 12.00, cat: "antipasti", description: "Solo giorni 18/19/25/26 luglio - 01/02 agosto" },

  // Primi piatti
  { name: "I nostri casoncelli",                  price:  7.50, cat: "primi" },
  { name: "Tagliatelle al sugo di lepre",         price:  9.00, cat: "primi" },
  { name: "Tagliatelle al pomodoro",              price:  4.50, cat: "primi" },
  { name: "Tagliatelle in bianco",                price:  4.00, cat: "primi" },
  { name: "Linguine alle vongole",                price:  9.00, cat: "primi" },
  { name: "Linguine allo scoglio",                price: 12.00, cat: "primi" },

  // Secondi piatti
  { name: "Moscardini con polenta",               price: 10.00, cat: "secondi" },
  { name: "Tagliata di roast beef rucola e grana",price: 11.00, cat: "secondi" },
  { name: "Roast beef",                           price:  8.00, cat: "secondi" },
  { name: "Tonnato",                              price:  7.00, cat: "secondi" },
  { name: "Polenta e gorgonzola",                 price:  6.00, cat: "secondi" },
  { name: "Brasato d'asino",                      price:  8.50, cat: "secondi" },
  { name: "Brasato d'asino con polenta",          price: 10.00, cat: "secondi" },
  { name: "Brasato d'asino con taragna",          price: 12.00, cat: "secondi" },
  { name: "Stinco di maiale intero con polenta",  price: 10.00, cat: "secondi" },
  { name: "Stinco di maiale mezzo con polenta",   price:  6.00, cat: "secondi" },

  // Griglia
  { name: "Costine di maiale (n°4)",              price:  6.00, cat: "griglia" },
  { name: "Cotechino",                            price:  3.50, cat: "griglia" },
  { name: "Spiedini (n°2)",                       price:  7.50, cat: "griglia" },
  { name: "Grigliata mista",                      price: 10.00, cat: "griglia", description: "3 costine, 1 spiedino, 1 cotechino" },

  // Contorni
  { name: "Patatine",                             price:  3.00, cat: "contorni" },
  { name: "Pomodori",                             price:  2.00, cat: "contorni" },
  { name: "Verdure grigliate",                    price:  4.00, cat: "contorni" },
  { name: "Polenta bergamasca",                   price:  2.00, cat: "contorni" },
  { name: "Polenta taragna",                      price:  4.00, cat: "contorni" },
  { name: "Bocconcino di pane (n°1)",             price:  0.20, cat: "contorni" },

  // Dolci / Dessert
  { name: "Anguria",                              price:  2.50, cat: "dolci" },
  { name: "Fetta di torta",                       price:  4.00, cat: "dolci" },
  { name: "Semifreddo",                           price:  4.50, cat: "dolci" },
  { name: "Crème Caramel",                        price:  1.50, cat: "dolci" },
];

for (const p of PRODS) {
  const id = stableId(`prod:${p.name}`);
  await db.insert(products).values({
    id, name: p.name, price: p.price, categoryId: catIds[p.cat],
    active: true, vatRate: 10,
    description: p.description ?? null, sortOrder: 0,
  }).onConflictDoNothing();
  console.log(`  ${p.name} €${p.price}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CENTRO DI PRODUZIONE — Cucina
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Centro di produzione");
const cucinaId = stableId("center:cucina");
await db.insert(productionCenters).values({ id: cucinaId, name: "Cucina", active: true }).onConflictDoNothing();
for (const cat of Object.keys(CATS) as CatKey[]) {
  await db.insert(productionCenterCategories).values({ productionCenterId: cucinaId, categoryId: catIds[cat] }).onConflictDoNothing();
}
console.log(`  Cucina → [${Object.keys(CATS).join(", ")}]`);

// ─────────────────────────────────────────────────────────────────────────────
// 7. STAMPANTE
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Stampanti");
const printerId = stableId("printer:cassa");
await db.insert(printers).values({
  id: printerId, name: "Stampante cassa",
  host: "192.168.1.100", port: 9100,
  active: true, receiptEnabled: true, kitchenEnabled: false,
  printMode: "text",
}).onConflictDoNothing();
console.log("  Stampante cassa (192.168.1.100:9100)");

const kitchenPrinterId = stableId("printer:cucina");
await db.insert(printers).values({
  id: kitchenPrinterId, name: "Stampante cucina",
  host: "192.168.1.101", port: 9100,
  active: true, receiptEnabled: false, kitchenEnabled: true,
  printMode: "text",
}).onConflictDoNothing();
console.log("  Stampante cucina (192.168.1.101:9100)");

await db.insert(productionCenterPrinters).values({ productionCenterId: cucinaId, printerId: kitchenPrinterId }).onConflictDoNothing();

// ─────────────────────────────────────────────────────────────────────────────
// 8. RECEIPT TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Receipt template");
await db.insert(receiptTemplates).values({
  id: stableId("receipt-template:master"), name: "Template principale", role: "master",
  headerText: "Ristorante", footerText: "Grazie per la visita!",
  showLogo: false, showOrderNumber: true, showTimestamp: true,
  showPaymentMethod: true, showItemCategory: false,
  printMode: "text", printMethod: "single",
  active: true, canvasWidth: 576,
}).onConflictDoNothing();
console.log("  Template principale");

console.log("\n✅ Seed completato.\n");
console.log("  Credenziali:");
console.log("  admin   PIN: 1234  (admin)");
console.log("  cassa   PIN: 0000  (cashier)");
