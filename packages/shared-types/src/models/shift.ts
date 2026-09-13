export interface Shift {
  id: number;
  userId: number;
  openedAt: number;
  closedAt: number | null;
  openingCash: number;
  closingCash: number | null;
  totalSales: number;
  totalOrders: number;
  notes: string | null;
}
