export interface Tenant {
  id: string;
  slug: string;
  name: string;
  apiKey: string;
  active: boolean;
  createdAt: number;
  logoPath: string | null;
  colorBrand: string | null;
  colorAccent: string | null;
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

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CurrentUser {
  id: string;
  email: string;
  isSuperAdmin: boolean;
}

export type TenantUserRole = "owner" | "operator";

export interface TenantUser {
  id: string;
  userId: string;
  email: string;
  role: TenantUserRole;
  createdAt: number;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  tenantId: string | null;
  action: string;
  metadataJson: string | null;
  createdAt: number;
}

export interface CategoryRecord {
  id: string;
  tenantId: string;
  name: string;
  sortOrder: number;
}

export interface ProductRecord {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  price: number;
  active: boolean;
  sortOrder: number;
}
