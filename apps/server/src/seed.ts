/**
 * Seed script — popola categories, products e production centers.
 * Esegui con: pnpm --filter @pos/server exec tsx src/seed.ts
 */
import { randomUUID } from "node:crypto";
import { createDbClient, runMigrations } from "@pos/db";
import {
  categories,
  products,
  productionCenters,
  productionCenterCategories,
} from "@pos/db";

const DB_PATH = process.env["DATABASE_URL"] ?? "./pos.db";

runMigrations(DB_PATH);
const db = createDbClient(DB_PATH);

// ── Categories ────────────────────────────────────────────────────────────────

const CATS = [
  { name: "Primi" },
  { name: "Secondi" },
  { name: "Contorni" },
  { name: "Bevande" },
  { name: "Dessert" },
] as const;

const catIds: Record<string, string> = {};

for (const cat of CATS) {
  const id = randomUUID();
  await db.insert(categories).values({ id, name: cat.name }).onConflictDoNothing();
  catIds[cat.name] = id;
  console.log(`  category: ${cat.name} → ${id}`);
}

// ── Products ──────────────────────────────────────────────────────────────────

const PRODS: { name: string; price: number; category: string }[] = [
  // Primi
  { name: "Pasta al sugo",       price: 5.00,  category: "Primi"    },
  { name: "Pasta al ragù",        price: 6.00,  category: "Primi"    },
  { name: "Risotto ai funghi",    price: 7.00,  category: "Primi"    },
  { name: "Pasta e fagioli",      price: 5.50,  category: "Primi"    },
  // Secondi
  { name: "Salsiccia grigliata",  price: 6.50,  category: "Secondi"  },
  { name: "Pollo alla griglia",   price: 8.00,  category: "Secondi"  },
  { name: "Bistecca",             price: 12.00, category: "Secondi"  },
  { name: "Costine BBQ",          price: 9.00,  category: "Secondi"  },
  { name: "Arrosticini (5 pz)",   price: 7.00,  category: "Secondi"  },
  // Contorni
  { name: "Patatine fritte",      price: 3.50,  category: "Contorni" },
  { name: "Insalata mista",       price: 3.00,  category: "Contorni" },
  { name: "Verdure grigliate",    price: 4.00,  category: "Contorni" },
  { name: "Pane",                 price: 1.00,  category: "Contorni" },
  // Bevande
  { name: "Acqua naturale 0.5L",  price: 1.00,  category: "Bevande"  },
  { name: "Acqua frizzante 0.5L", price: 1.00,  category: "Bevande"  },
  { name: "Vino rosso (calice)",  price: 2.50,  category: "Bevande"  },
  { name: "Vino bianco (calice)", price: 2.50,  category: "Bevande"  },
  { name: "Birra alla spina",     price: 3.00,  category: "Bevande"  },
  { name: "Birra in bottiglia",   price: 3.50,  category: "Bevande"  },
  { name: "Bibita in lattina",    price: 2.00,  category: "Bevande"  },
  { name: "Succo di frutta",      price: 1.50,  category: "Bevande"  },
  // Dessert
  { name: "Tiramisù",             price: 4.00,  category: "Dessert"  },
  { name: "Gelato (2 gusti)",     price: 3.50,  category: "Dessert"  },
  { name: "Crostata",             price: 3.00,  category: "Dessert"  },
  { name: "Torta della nonna",    price: 4.00,  category: "Dessert"  },
];

for (const p of PRODS) {
  const catId = catIds[p.category];
  if (!catId) { console.warn(`  SKIP: no category for ${p.name}`); continue; }
  const id = randomUUID();
  await db.insert(products).values({
    id,
    name: p.name,
    price: p.price,
    categoryId: catId,
    active: true,
  }).onConflictDoNothing();
  console.log(`  product: ${p.name} (€${p.price}) → ${id}`);
}

// ── Production Centers ────────────────────────────────────────────────────────

const CENTERS: { name: string; categories: string[] }[] = [
  { name: "Cucina calda",  categories: ["Primi", "Secondi"] },
  { name: "Friggitoria",   categories: ["Contorni"] },
  { name: "Bar",           categories: ["Bevande", "Dessert"] },
];

for (const center of CENTERS) {
  const id = randomUUID();
  await db.insert(productionCenters).values({ id, name: center.name }).onConflictDoNothing();
  console.log(`  center: ${center.name} → ${id}`);

  for (const catName of center.categories) {
    const catId = catIds[catName];
    if (!catId) continue;
    await db.insert(productionCenterCategories)
      .values({ productionCenterId: id, categoryId: catId })
      .onConflictDoNothing();
    console.log(`    mapped: ${center.name} ↔ ${catName}`);
  }
}

console.log("\n✓ Seed completato.");
