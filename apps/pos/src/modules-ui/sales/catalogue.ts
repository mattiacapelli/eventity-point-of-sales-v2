import type { ComponentType, SVGProps } from "react";
import {
  FireIcon,
  BeakerIcon,
  TagIcon,
  GlobeAltIcon,
  CakeIcon,
} from "../../components/ui/icons.js";

export interface Product {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly category: string;
}

export interface Category {
  readonly name: string;
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const CATEGORIES: Category[] = [
  { name: "Primi",    icon: FireIcon },
  { name: "Secondi",  icon: TagIcon },
  { name: "Contorni", icon: GlobeAltIcon },
  { name: "Bevande",  icon: BeakerIcon },
  { name: "Dessert",  icon: CakeIcon },
];

export const PRODUCTS: Product[] = [
  // Primi
  { id: "p1",  name: "Pasta al sugo",      price: 5.00,  category: "Primi"    },
  { id: "p2",  name: "Pasta al ragù",       price: 6.00,  category: "Primi"    },
  { id: "p3",  name: "Risotto ai funghi",   price: 7.00,  category: "Primi"    },
  // Secondi
  { id: "p4",  name: "Salsiccia grigliata", price: 6.50,  category: "Secondi"  },
  { id: "p5",  name: "Pollo alla griglia",  price: 8.00,  category: "Secondi"  },
  { id: "p6",  name: "Bistecca",            price: 12.00, category: "Secondi"  },
  // Contorni
  { id: "p7",  name: "Patatine fritte",     price: 3.50,  category: "Contorni" },
  { id: "p8",  name: "Insalata mista",      price: 3.00,  category: "Contorni" },
  { id: "p9",  name: "Verdure grigliate",   price: 4.00,  category: "Contorni" },
  // Bevande
  { id: "p10", name: "Acqua naturale",      price: 1.50,  category: "Bevande"  },
  { id: "p11", name: "Acqua frizzante",     price: 1.50,  category: "Bevande"  },
  { id: "p12", name: "Vino rosso",          price: 3.00,  category: "Bevande"  },
  { id: "p13", name: "Birra",               price: 3.00,  category: "Bevande"  },
  { id: "p14", name: "Bibita",              price: 2.50,  category: "Bevande"  },
  // Dessert
  { id: "p15", name: "Tiramisù",            price: 4.00,  category: "Dessert"  },
  { id: "p16", name: "Gelato",              price: 3.50,  category: "Dessert"  },
];
