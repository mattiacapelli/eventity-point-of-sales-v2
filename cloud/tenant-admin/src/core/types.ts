export interface Tenant {
  id: string;
  slug: string;
  name: string;
  apiKey: string;
  active: boolean;
  createdAt: number;
}

export interface TenantStats {
  categoriesCount: number;
  productsCount: number;
  ordersCount: number;
  totalRevenue: number;
  recentOrders: {
    id: string;
    orderCode: string;
    tableId: string;
    customerName: string | null;
    totalAmount: number;
    createdAt: number;
  }[];
}
