export interface Terminal {
  id: number;
  name: string;
  active: boolean;
  createdAt: number;
  lastSeenAt: number | null;
  defaultViewMode: string | null;
}
