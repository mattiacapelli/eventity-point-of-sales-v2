/**
 * Demo seed — Festival Estivo tenant
 * Crea un tenant pubblico con catalogo completo per testare l'app di ordinazione mobile.
 * Esegui con: pnpm --filter @epos-cloud/web-ui-server exec tsx src/seed-demo-tenant.ts
 */
import { randomUUID, randomBytes } from "node:crypto";
import { createDb, eq } from "./db/client.js";
import { tenants, categories, products } from "./db/schema.js";

const DB_PATH = process.env["DB_PATH"] ?? "./data/web-ui.db";
const db = createDb(DB_PATH);

const SLUG = "festival-men";

console.log("\n── Tenant");
let tenantId: string;
const existing = db.select().from(tenants).where(eq(tenants.slug, SLUG)).all();
if (existing[0]) {
  tenantId = existing[0].id;
  console.log(`  ${SLUG} [già esistente]`);
} else {
  tenantId = randomUUID();
  db.insert(tenants).values({
    id: tenantId,
    slug: SLUG,
    name: "Festival Estivo",
    apiKey: randomBytes(24).toString("hex"),
    active: true,
    createdAt: Date.now(),
    colorBrand: "#17663C",
    colorAccent: "#17663C",
    requireTableId: true,
    requireCustomerName: false,
  }).run();
  console.log(`  ${SLUG} → ${tenantId}`);
}

console.log("\n── Categorie");
type CatKey = "panini" | "griglia" | "cucina" | "fritti" | "pizza" | "dolci" | "bibite" | "birra" | "vino" | "caffe";
const CATS: Record<CatKey, { name: string; emoji: string; sortOrder: number }> = {
  panini:  { name: "Panini & Gastronomia", emoji: "🥪", sortOrder: 0 },
  griglia: { name: "Griglia",              emoji: "🍖", sortOrder: 1 },
  cucina:  { name: "Cucina calda",         emoji: "🍝", sortOrder: 2 },
  fritti:  { name: "Fritti",               emoji: "🍟", sortOrder: 3 },
  pizza:   { name: "Pizza al trancio",     emoji: "🍕", sortOrder: 4 },
  dolci:   { name: "Dolci & Gelati",       emoji: "🍰", sortOrder: 5 },
  bibite:  { name: "Bibite & Acqua",       emoji: "🥤", sortOrder: 6 },
  birra:   { name: "Birra",                emoji: "🍺", sortOrder: 7 },
  vino:    { name: "Vino & Cocktail",      emoji: "🍷", sortOrder: 8 },
  caffe:   { name: "Caffetteria",          emoji: "☕", sortOrder: 9 },
};
const catIds: Record<CatKey, number> = {} as never;
for (const [key, cat] of Object.entries(CATS) as [CatKey, typeof CATS[CatKey]][]) {
  const existingCat = db.select().from(categories).where(eq(categories.tenantId, tenantId)).all()
    .find((c) => c.name === cat.name);
  if (existingCat) {
    catIds[key] = existingCat.id;
    console.log(`  ${cat.name} [già esistente]`);
  } else {
    const [row] = db.insert(categories).values({
      tenantId, name: cat.name, emoji: cat.emoji, sortOrder: cat.sortOrder,
    }).returning().all();
    catIds[key] = row!.id;
    console.log(`  ${cat.name}`);
  }
}

console.log("\n── Prodotti");
type Prod = { name: string; price: number; cat: CatKey };
const PRODS: Prod[] = [
  { name: "Panino con hamburger",           price: 6.5, cat: "panini" },
  { name: "Panino con porchetta",           price: 6,   cat: "panini" },
  { name: "Panino con salamella",           price: 5,   cat: "panini" },
  { name: "Panino vegetariano",             price: 5,   cat: "panini" },
  { name: "Piadina classica",               price: 5.5, cat: "panini" },
  { name: "Tagliere salumi e formaggi",     price: 9,   cat: "panini" },
  { name: "Costine di maiale",              price: 11,  cat: "griglia" },
  { name: "Grigliata mista",                price: 14,  cat: "griglia" },
  { name: "Spiedino di pollo",               price: 6,   cat: "griglia" },
  { name: "Salamella singola",              price: 3.5, cat: "griglia" },
  { name: "Pasta al ragù",                  price: 7,   cat: "cucina" },
  { name: "Polenta e spezzatino",           price: 9,   cat: "cucina" },
  { name: "Zuppa di ceci",                  price: 6,   cat: "cucina" },
  { name: "Patatine fritte",                price: 4,   cat: "fritti" },
  { name: "Olive ascolane",                 price: 5,   cat: "fritti" },
  { name: "Anelli di cipolla",              price: 4.5, cat: "fritti" },
  { name: "Pizza margherita",               price: 3,   cat: "pizza" },
  { name: "Pizza marinara",                 price: 2.5, cat: "pizza" },
  { name: "Pizza diavola",                  price: 3.5, cat: "pizza" },
  { name: "Fetta di torta",                 price: 3.5, cat: "dolci" },
  { name: "Cono gigante",                   price: 4,   cat: "dolci" },
  { name: "Granita al limone",              price: 3,   cat: "dolci" },
  { name: "Acqua frizzante 0.5L",           price: 1.5, cat: "bibite" },
  { name: "Acqua naturale 0.5L",            price: 1.5, cat: "bibite" },
  { name: "Cola 33cl",                      price: 2.5, cat: "bibite" },
  { name: "Birra media 0.4L",               price: 5,   cat: "birra" },
  { name: "Birra piccola 0.2L",             price: 3,   cat: "birra" },
  { name: "Birra artigianale",              price: 6,   cat: "birra" },
  { name: "Calice di rosso",                price: 4,   cat: "vino" },
  { name: "Spritz",                         price: 6,   cat: "vino" },
  { name: "Gin Tonic",                      price: 7,   cat: "vino" },
  { name: "Caffè espresso",                 price: 1.2, cat: "caffe" },
  { name: "Cappuccino",                     price: 1.8, cat: "caffe" },
  { name: "Tè freddo",                      price: 2.5, cat: "caffe" },
];

for (const p of PRODS) {
  const existingProd = db.select().from(products).where(eq(products.tenantId, tenantId)).all()
    .find((x) => x.name === p.name);
  if (existingProd) continue;
  db.insert(products).values({
    tenantId, categoryId: catIds[p.cat], name: p.name, price: p.price, active: true, sortOrder: 0,
  }).run();
  console.log(`  ${p.name} €${p.price.toFixed(2)}`);
}

console.log("\n✅ Seed completato.\n");
console.log(`  Link menu: http://localhost:5174/?t=${SLUG}\n`);
