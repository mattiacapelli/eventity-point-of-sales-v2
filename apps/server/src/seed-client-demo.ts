/**
 * Demo seed — Festival Estivo
 * Popola un ambiente completo e realistico per demo cliente: categorie, prodotti,
 * centri di produzione, stampanti, terminali, turni chiusi e storico ordini/pagamenti.
 *
 * Esegui con: pnpm --filter @pos/server exec tsx src/seed-client-demo.ts
 */
import { createDbClient, runMigrations, sql, eq, orders, orderItems, payments, shifts } from "@pos/db";
import {
  appSettings, users, categories, products,
  productionCenters, productionCenterCategories, productionCenterPrinters,
  paymentMethods, printers, receiptTemplates, terminals, terminalCategories,
} from "@pos/db";
import { AuthService } from "@pos/core";

const DB_PATH = process.env["DATABASE_URL"] ?? "./pos.db";
runMigrations(DB_PATH);
const db = createDbClient(DB_PATH);

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. APP SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── App settings");
const settings: [string, string][] = [
  ["restaurant_name",        "Festival Estivo — Arena Eventi"],
  ["receipt_number_prefix",  "F"],
  ["receipt_number_padding", "4"],
  ["express_mode",           "false"],
  ["multi_terminal_enabled", "true"],
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
  { id: "voucher",        name: "Buono pasto",       type: "voucher",        active: true, sortOrder: 3, excludeFromTotal: false },
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
  { name: "Marco Bianchi",  username: "admin",   role: "admin",   pin: "1234" },
  { name: "Giulia Rossi",   username: "cassa1",  role: "cashier", pin: "1111" },
  { name: "Luca Verdi",     username: "cassa2",  role: "cashier", pin: "2222" },
  { name: "Sara Ferrari",   username: "cucina",  role: "kitchen", pin: "3333" },
];
const authService = new AuthService(db, 86400);
const userIds: Record<string, number> = {};
for (const u of USERS_SPEC) {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, u.username)).limit(1);
  if (existing.length > 0) {
    userIds[u.username] = existing[0]!.id;
    console.log(`  ${u.username} (${u.role}) PIN:${u.pin} [già esistente]`);
    continue;
  }
  const id = await authService.createUser({ name: u.name, username: u.username, role: u.role, pin: u.pin });
  userIds[u.username] = id;
  console.log(`  ${u.username} (${u.role}) PIN:${u.pin}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CATEGORIE
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Categorie");
type CatKey = "panini" | "griglia" | "cucina" | "fritti" | "pizza" | "dolci" | "bibite" | "birra" | "vino" | "caffe";
const CATS: Record<CatKey, { name: string; color: string; sortOrder: number }> = {
  panini:  { name: "Panini & Gastronomia", color: "#F59E0B", sortOrder: 0 },
  griglia: { name: "Griglia",              color: "#DC2626", sortOrder: 1 },
  cucina:  { name: "Cucina calda",         color: "#EF4444", sortOrder: 2 },
  fritti:  { name: "Fritti",               color: "#F97316", sortOrder: 3 },
  pizza:   { name: "Pizza al trancio",     color: "#8B5CF6", sortOrder: 4 },
  dolci:   { name: "Dolci & Gelati",       color: "#EC4899", sortOrder: 5 },
  bibite:  { name: "Bibite & Acqua",       color: "#3B82F6", sortOrder: 6 },
  birra:   { name: "Birra",                color: "#EAB308", sortOrder: 7 },
  vino:    { name: "Vino & Cocktail",      color: "#A855F7", sortOrder: 8 },
  caffe:   { name: "Caffetteria",          color: "#78350F", sortOrder: 9 },
};
const catIds: Record<CatKey, number> = {} as never;
for (const [key, cat] of Object.entries(CATS) as [CatKey, typeof CATS[CatKey]][]) {
  const existingCat = await db.select({ id: categories.id }).from(categories).where(eq(categories.name, cat.name)).limit(1);
  if (existingCat[0]) {
    catIds[key] = existingCat[0].id;
    console.log(`  ${cat.name} [già esistente]`);
  } else {
    const [row] = await db.insert(categories).values({ name: cat.name, color: cat.color, sortOrder: cat.sortOrder, active: true }).returning({ id: categories.id });
    catIds[key] = row!.id;
    console.log(`  ${cat.name}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. PRODOTTI
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Prodotti");
type Prod = { name: string; price: number; cat: CatKey; description?: string; vatRate?: number };
const PRODS: Prod[] = [
  // Panini & Gastronomia
  { name: "Panino con salamella",          price: 5.00, cat: "panini" },
  { name: "Panino con salamella e cipolle",price: 5.50, cat: "panini" },
  { name: "Panino con porchetta",          price: 6.00, cat: "panini" },
  { name: "Panino con hamburger",          price: 6.50, cat: "panini", description: "150g, con insalata e pomodoro" },
  { name: "Panino vegetariano",            price: 5.00, cat: "panini", description: "Verdure grigliate e formaggio" },
  { name: "Piadina classica",              price: 5.50, cat: "panini" },
  { name: "Tagliere salumi e formaggi",    price: 9.00, cat: "panini" },

  // Griglia
  { name: "Salamella (n°1)",               price: 3.50, cat: "griglia" },
  { name: "Costine di maiale (n°4)",       price: 7.00, cat: "griglia" },
  { name: "Spiedini di carne (n°2)",       price: 7.50, cat: "griglia" },
  { name: "Grigliata mista",               price: 11.00, cat: "griglia", description: "Salamella, costine, spiedino" },
  { name: "Pollo alla griglia",            price: 8.00, cat: "griglia" },
  { name: "Hamburger di Angus",            price: 8.50, cat: "griglia" },

  // Cucina calda
  { name: "Pasta al pomodoro",             price: 5.00, cat: "cucina" },
  { name: "Pasta al ragù",                 price: 6.00, cat: "cucina" },
  { name: "Risotto ai funghi",             price: 7.50, cat: "cucina" },
  { name: "Gnocchi al gorgonzola",         price: 6.50, cat: "cucina" },
  { name: "Polenta e spezzatino",          price: 8.00, cat: "cucina" },
  { name: "Zuppa di legumi",               price: 5.50, cat: "cucina" },

  // Fritti
  { name: "Patatine fritte",               price: 3.50, cat: "fritti" },
  { name: "Anelli di cipolla",             price: 4.00, cat: "fritti" },
  { name: "Frittura di pesce",             price: 9.00, cat: "fritti" },
  { name: "Arancini di riso (n°3)",        price: 4.50, cat: "fritti" },
  { name: "Crocchette di patate (n°5)",    price: 4.00, cat: "fritti" },

  // Pizza al trancio
  { name: "Pizza margherita (trancio)",    price: 3.00, cat: "pizza" },
  { name: "Pizza marinara (trancio)",      price: 2.80, cat: "pizza" },
  { name: "Pizza diavola (trancio)",       price: 3.50, cat: "pizza" },
  { name: "Pizza verdure (trancio)",       price: 3.30, cat: "pizza" },
  { name: "Focaccia",                      price: 2.50, cat: "pizza" },

  // Dolci & Gelati
  { name: "Gelato (2 gusti)",              price: 3.50, cat: "dolci" },
  { name: "Cono gigante (3 gusti)",        price: 5.00, cat: "dolci" },
  { name: "Frittelle (n°6)",               price: 4.00, cat: "dolci" },
  { name: "Fetta di torta",                price: 3.50, cat: "dolci" },
  { name: "Crepes Nutella",                price: 4.50, cat: "dolci" },
  { name: "Zucchero filato",               price: 3.00, cat: "dolci" },
  { name: "Anguria a fette",               price: 2.50, cat: "dolci" },

  // Bibite & Acqua
  { name: "Acqua naturale 0.5L",           price: 1.50, cat: "bibite" },
  { name: "Acqua frizzante 0.5L",          price: 1.50, cat: "bibite" },
  { name: "Coca Cola",                     price: 3.00, cat: "bibite" },
  { name: "Fanta",                         price: 3.00, cat: "bibite" },
  { name: "Tè freddo",                     price: 3.00, cat: "bibite" },
  { name: "Succo di frutta",               price: 2.50, cat: "bibite" },
  { name: "Chinotto",                      price: 3.00, cat: "bibite" },

  // Birra
  { name: "Birra alla spina 0.4L",         price: 5.00, cat: "birra" },
  { name: "Birra alla spina 0.2L",         price: 3.50, cat: "birra" },
  { name: "Birra artigianale in bottiglia",price: 6.00, cat: "birra" },
  { name: "Birra analcolica",              price: 4.00, cat: "birra" },

  // Vino & Cocktail
  { name: "Vino rosso (calice)",           price: 3.50, cat: "vino" },
  { name: "Vino bianco (calice)",          price: 3.50, cat: "vino" },
  { name: "Prosecco (calice)",             price: 4.00, cat: "vino" },
  { name: "Spritz",                        price: 6.00, cat: "vino" },
  { name: "Mojito",                        price: 7.00, cat: "vino" },
  { name: "Gin Tonic",                     price: 7.00, cat: "vino" },
  { name: "Sangria",                       price: 5.50, cat: "vino" },

  // Caffetteria
  { name: "Caffè espresso",                price: 1.50, cat: "caffe" },
  { name: "Cappuccino",                    price: 2.00, cat: "caffe" },
  { name: "Caffè freddo",                  price: 2.50, cat: "caffe" },
  { name: "Cornetto",                      price: 1.80, cat: "caffe" },
];

const productIdByName: Record<string, number> = {};
for (const p of PRODS) {
  const existing = await db.select({ id: products.id }).from(products).where(eq(products.name, p.name)).limit(1);
  if (existing[0]) {
    productIdByName[p.name] = existing[0].id;
    continue;
  }
  const [row] = await db.insert(products).values({
    name: p.name, price: p.price, categoryId: catIds[p.cat],
    active: true, vatRate: p.vatRate ?? 10,
    description: p.description ?? null, sortOrder: 0,
  }).onConflictDoNothing().returning({ id: products.id });
  if (row) productIdByName[p.name] = row.id;
  console.log(`  ${p.name} €${p.price.toFixed(2)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CENTRI DI PRODUZIONE
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Centri di produzione");
type CenterKey = "cucina" | "griglia" | "bar" | "gastronomia";
const CENTERS: Record<CenterKey, { name: string; cats: CatKey[]; color: string; icon: string }> = {
  cucina:      { name: "Cucina",       cats: ["cucina", "fritti", "pizza"], color: "#EF4444", icon: "utensils" },
  griglia:     { name: "Griglia",      cats: ["griglia"],                   color: "#DC2626", icon: "flame" },
  bar:         { name: "Bar",          cats: ["bibite", "birra", "vino", "caffe"], color: "#3B82F6", icon: "coffee" },
  gastronomia: { name: "Gastronomia",  cats: ["panini", "dolci"],           color: "#F59E0B", icon: "sandwich" },
};
const centerIds: Record<CenterKey, number> = {} as never;
for (const [key, c] of Object.entries(CENTERS) as [CenterKey, typeof CENTERS[CenterKey]][]) {
  const existing = await db.select({ id: productionCenters.id }).from(productionCenters).where(eq(productionCenters.name, c.name)).limit(1);
  let id: number;
  if (existing[0]) {
    id = existing[0].id;
  } else {
    const [row] = await db.insert(productionCenters).values({ name: c.name, color: c.color, icon: c.icon }).returning({ id: productionCenters.id });
    id = row!.id;
  }
  centerIds[key] = id;
  for (const cat of c.cats) {
    await db.insert(productionCenterCategories).values({ productionCenterId: id, categoryId: catIds[cat] }).onConflictDoNothing();
  }
  console.log(`  ${c.name} → [${c.cats.join(", ")}]`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. STAMPANTI
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Stampanti");
async function upsertPrinter(name: string, host: string, port: number, receiptEnabled: boolean, kitchenEnabled: boolean): Promise<number> {
  const existing = await db.select({ id: printers.id }).from(printers).where(eq(printers.name, name)).limit(1);
  if (existing[0]) return existing[0].id;
  const [row] = await db.insert(printers).values({
    name, host, port, active: true, receiptEnabled, kitchenEnabled, printMode: "text",
  }).returning({ id: printers.id });
  console.log(`  ${name} (${host}:${port})`);
  return row!.id;
}
const printerCassa1 = await upsertPrinter("Stampante cassa 1", "192.168.1.100", 9100, true, false);
const printerCassa2 = await upsertPrinter("Stampante cassa 2", "192.168.1.103", 9100, true, false);
const printerCucina = await upsertPrinter("Stampante cucina", "192.168.1.101", 9100, false, true);
const printerGriglia = await upsertPrinter("Stampante griglia", "192.168.1.102", 9100, false, true);
const printerBar = await upsertPrinter("Stampante bar", "192.168.1.104", 9100, false, true);
const printerGastro = await upsertPrinter("Stampante gastronomia", "192.168.1.105", 9100, false, true);

await db.insert(productionCenterPrinters).values({ productionCenterId: centerIds.cucina, printerId: printerCucina }).onConflictDoNothing();
await db.insert(productionCenterPrinters).values({ productionCenterId: centerIds.griglia, printerId: printerGriglia }).onConflictDoNothing();
await db.insert(productionCenterPrinters).values({ productionCenterId: centerIds.bar, printerId: printerBar }).onConflictDoNothing();
await db.insert(productionCenterPrinters).values({ productionCenterId: centerIds.gastronomia, printerId: printerGastro }).onConflictDoNothing();

// ─────────────────────────────────────────────────────────────────────────────
// 8. TERMINALI
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Terminali");
async function upsertTerminal(name: string): Promise<number> {
  const existing = await db.select({ id: terminals.id }).from(terminals).where(eq(terminals.name, name)).limit(1);
  if (existing[0]) return existing[0].id;
  const [row] = await db.insert(terminals).values({ name, active: true, createdAt: Date.now() }).returning({ id: terminals.id });
  console.log(`  ${name}`);
  return row!.id;
}
const terminalCassa1 = await upsertTerminal("Cassa 1 — Ingresso");
const terminalCassa2 = await upsertTerminal("Cassa 2 — Area food");
const terminalBar = await upsertTerminal("Cassa Bar");

for (const cat of Object.keys(CATS) as CatKey[]) {
  await db.insert(terminalCategories).values({ terminalId: terminalCassa1, categoryId: catIds[cat], sortOrder: 0 }).onConflictDoNothing();
}
for (const cat of ["panini", "griglia", "cucina", "fritti", "pizza", "dolci"] as CatKey[]) {
  await db.insert(terminalCategories).values({ terminalId: terminalCassa2, categoryId: catIds[cat], sortOrder: 0 }).onConflictDoNothing();
}
for (const cat of ["bibite", "birra", "vino", "caffe", "dolci"] as CatKey[]) {
  await db.insert(terminalCategories).values({ terminalId: terminalBar, categoryId: catIds[cat], sortOrder: 0 }).onConflictDoNothing();
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. RECEIPT TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Receipt template");
await db.insert(receiptTemplates).values({
  name: "Template principale", role: "master",
  headerText: "Festival Estivo — Arena Eventi", footerText: "Grazie per la visita! #FestivalEstivo",
  showLogo: false, showOrderNumber: true, showTimestamp: true,
  showPaymentMethod: true, showItemCategory: false,
  printMode: "text", printMethod: "single",
  active: true, canvasWidth: 576,
}).onConflictDoNothing();
console.log("  Template principale");

// ─────────────────────────────────────────────────────────────────────────────
// 10. STORICO TURNI + ORDINI + PAGAMENTI (ultimi 6 giorni)
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Storico turni e ordini");

const DAYS_OF_HISTORY = 6;
const cashierUsernames = ["cassa1", "cassa2"];
const allProductNames = Object.keys(productIdByName);
const paymentMethodIds = pmRows.map((p) => p.id);

let receiptCounter = 1;
const now = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

for (let dayOffset = DAYS_OF_HISTORY; dayOffset >= 1; dayOffset--) {
  const dayStart = now - dayOffset * DAY_MS;
  const cashierUsername = rand(cashierUsernames);
  const cashierId = userIds[cashierUsername]!;

  // Turno: apre verso le 18:00, chiude verso le 23:30
  const shiftOpenedAt = dayStart + 18 * 60 * 60 * 1000;
  const shiftClosedAt = dayStart + 23.5 * 60 * 60 * 1000;
  const openingCash = 100;

  const ordersCount = randInt(35, 60);
  let shiftTotalSales = 0;

  const [shiftRow] = await db.insert(shifts).values({
    userId: cashierId,
    openedAt: shiftOpenedAt,
    closedAt: shiftClosedAt,
    openingCash,
    closingCash: 0, // aggiornato dopo
    totalSales: 0,
    totalOrders: ordersCount,
    notes: null,
  }).returning({ id: shifts.id });
  const shiftId = shiftRow!.id;

  for (let i = 0; i < ordersCount; i++) {
    const orderTime = shiftOpenedAt + Math.random() * (shiftClosedAt - shiftOpenedAt);
    const itemsCount = randInt(1, 5);
    const chosenNames = new Set<string>();
    while (chosenNames.size < itemsCount) chosenNames.add(rand(allProductNames));

    let totalAmount = 0;
    const itemsToInsert: { name: string; price: number; qty: number }[] = [];
    for (const name of chosenNames) {
      const prod = PRODS.find((p) => p.name === name)!;
      const qty = randInt(1, 3);
      totalAmount += prod.price * qty;
      itemsToInsert.push({ name, price: prod.price, qty });
    }
    totalAmount = Math.round(totalAmount * 100) / 100;

    const status = Math.random() < 0.03 ? "cancelled" : Math.random() < 0.02 ? "refunded" : "completed";

    const [orderRow] = await db.insert(orders).values({
      terminalId: rand([terminalCassa1, terminalCassa2, terminalBar]),
      shiftId,
      status,
      totalAmount,
      discountAmount: 0,
      notes: null,
      pax: randInt(1, 4),
      receiptNumber: receiptCounter++,
      createdAt: new Date(orderTime),
      updatedAt: new Date(orderTime),
    }).returning({ id: orders.id });
    const orderId = orderRow!.id;

    for (const item of itemsToInsert) {
      await db.insert(orderItems).values({
        orderId,
        productId: productIdByName[item.name]!,
        name: item.name,
        quantity: item.qty,
        unitPrice: item.price,
      });
    }

    if (status !== "cancelled") {
      const payStatus = status === "refunded" ? "refunded" : "completed";
      await db.insert(payments).values({
        orderId,
        method: rand(paymentMethodIds),
        status: payStatus,
        amount: totalAmount,
        currency: "EUR",
        terminalId: rand([terminalCassa1, terminalCassa2, terminalBar]),
        createdAt: new Date(orderTime),
      });
      if (status === "completed") shiftTotalSales += totalAmount;
    }
  }

  const closingCash = Math.round((openingCash + shiftTotalSales * 0.35) * 100) / 100; // stima contante
  await db.update(shifts).set({ totalSales: Math.round(shiftTotalSales * 100) / 100, closingCash })
    .where(eq(shifts.id, shiftId));

  console.log(`  Giorno -${dayOffset}: ${ordersCount} ordini, incasso €${shiftTotalSales.toFixed(2)} (${cashierUsername})`);
}

// Turno di oggi, ancora aperto
console.log("\n── Turno odierno (aperto)");
const todayOpenedAt = now - 3 * 60 * 60 * 1000; // apre 3h fa
const todayCashier = userIds["cassa1"]!;
const [openShiftRow] = await db.insert(shifts).values({
  userId: todayCashier,
  openedAt: todayOpenedAt,
  closedAt: null,
  openingCash: 100,
  closingCash: null,
  totalSales: 0,
  totalOrders: 0,
}).returning({ id: shifts.id });
const openShiftId = openShiftRow!.id;

let todayTotal = 0;
const todayOrdersCount = randInt(15, 25);
for (let i = 0; i < todayOrdersCount; i++) {
  const orderTime = todayOpenedAt + Math.random() * (now - todayOpenedAt);
  const itemsCount = randInt(1, 4);
  const chosenNames = new Set<string>();
  while (chosenNames.size < itemsCount) chosenNames.add(rand(allProductNames));

  let totalAmount = 0;
  const itemsToInsert: { name: string; price: number; qty: number }[] = [];
  for (const name of chosenNames) {
    const prod = PRODS.find((p) => p.name === name)!;
    const qty = randInt(1, 3);
    totalAmount += prod.price * qty;
    itemsToInsert.push({ name, price: prod.price, qty });
  }
  totalAmount = Math.round(totalAmount * 100) / 100;

  const [orderRow] = await db.insert(orders).values({
    terminalId: rand([terminalCassa1, terminalCassa2, terminalBar]),
    shiftId: openShiftId,
    status: "completed",
    totalAmount,
    discountAmount: 0,
    pax: randInt(1, 4),
    receiptNumber: receiptCounter++,
    createdAt: new Date(orderTime),
    updatedAt: new Date(orderTime),
  }).returning({ id: orders.id });
  const orderId = orderRow!.id;

  for (const item of itemsToInsert) {
    await db.insert(orderItems).values({
      orderId,
      productId: productIdByName[item.name]!,
      name: item.name,
      quantity: item.qty,
      unitPrice: item.price,
    });
  }

  await db.insert(payments).values({
    orderId,
    method: rand(paymentMethodIds),
    status: "completed",
    amount: totalAmount,
    currency: "EUR",
    terminalId: rand([terminalCassa1, terminalCassa2, terminalBar]),
    createdAt: new Date(orderTime),
  });
  todayTotal += totalAmount;
}
await db.update(shifts).set({ totalSales: Math.round(todayTotal * 100) / 100, totalOrders: todayOrdersCount })
  .where(eq(shifts.id, openShiftId));
console.log(`  ${todayOrdersCount} ordini, incasso parziale €${todayTotal.toFixed(2)} (cassa1, turno aperto)`);

console.log("\n✅ Seed demo completato.\n");
console.log("  Credenziali:");
for (const u of USERS_SPEC) {
  console.log(`  ${u.username.padEnd(8)} PIN: ${u.pin}  (${u.role})`);
}
