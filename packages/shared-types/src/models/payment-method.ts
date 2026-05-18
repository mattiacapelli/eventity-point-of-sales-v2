export interface PaymentMethodRecord {
  id: string;
  name: string;
  type: string;
  active: boolean;
  sortOrder: number;
  icon: string | null;
}
