export interface ReceiptTemplate {
  id: string;
  name: string;
  headerText: string | null;
  footerText: string | null;
  showLogo: boolean;
  showOrderNumber: boolean;
  showTimestamp: boolean;
  showPaymentMethod: boolean;
  active: boolean;
}
