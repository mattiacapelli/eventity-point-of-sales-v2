export interface Terminal {
  id: string;
  name: string;
  active: boolean;
  createdAt: number;
  lastSeenAt: number | null;
  defaultViewMode: string | null;
}
