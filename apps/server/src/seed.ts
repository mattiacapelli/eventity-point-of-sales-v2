/**
 * Seed script — popola categories, products e production centers.
 * Esegui con: pnpm --filter @pos/server exec tsx src/seed.ts
 */
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

const catIds: Record<string, number> = {};

for (const cat of CATS) {
  const [row] = await db.insert(categories).values({ name: cat.name }).onConflictDoNothing().returning({ id: categories.id });
  if (row) {
    catIds[cat.name] = row.id;
    console.log(`  category: ${cat.name} → ${row.id}`);
  } else {
    // Already exists — look it up
    const existing = await db.select({ id: categories.id }).from(categories).where((await import("@pos/db")).eq(categories.name, cat.name)).limit(1);
    if (existing[0]) {
      catIds[cat.name] = existing[0].id;
      console.log(`  category: ${cat.name} → ${existing[0].id} (existing)`);
    }
  }
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
  const [row] = await db.insert(products).values({
    name: p.name,
    price: p.price,
    categoryId: catId,
    active: true,
  }).onConflictDoNothing().returning({ id: products.id });
  if (row) {
    console.log(`  product: ${p.name} (€${p.price}) → ${row.id}`);
  }
}

// ── Production Centers ────────────────────────────────────────────────────────

const CENTERS: { name: string; categories: string[] }[] = [
  { name: "Cucina calda",  categories: ["Primi", "Secondi"] },
  { name: "Friggitoria",   categories: ["Contorni"] },
  { name: "Bar",           categories: ["Bevande", "Dessert"] },
];

for (const center of CENTERS) {
  const [centerRow] = await db.insert(productionCenters).values({ name: center.name }).onConflictDoNothing().returning({ id: productionCenters.id });
  const centerId = centerRow?.id;
  if (!centerId) { console.warn(`  SKIP center (already exists?): ${center.name}`); continue; }
  console.log(`  center: ${center.name} → ${centerId}`);

  for (const catName of center.categories) {
    const catId = catIds[catName];
    if (!catId) continue;
    await db.insert(productionCenterCategories)
      .values({ productionCenterId: centerId, categoryId: catId })
      .onConflictDoNothing();
    console.log(`    mapped: ${center.name} ↔ ${catName}`);
  }
}

console.log("\n✓ Seed completato.");
