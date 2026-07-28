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
  requireTableId: boolean;
  requireCustomerName: boolean;
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
  id: number;
  tenantId: string;
  name: string;
  emoji: string | null;
  sortOrder: number;
}

export interface ProductRecord {
  id: number;
  tenantId: string;
  categoryId: number;
  name: string;
  price: number;
  active: boolean;
  sortOrder: number;
  availableDates: string[] | null;
  imagePath: string | null;
}
