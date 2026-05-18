export interface Shift {
  id: string;
  userId: string;
  openedAt: number;
  closedAt: number | null;
  openingCash: number;
  closingCash: number | null;
  totalSales: number;
  totalOrders: number;
  notes: string | null;
}
