export type Scope = "trip" | "family" | "personal";
export type Kind = "itinerary" | "places" | "checklist" | "tasks";
export type Item = {
  id: string;
  trip_id: string;
  kind: Kind;
  title: string;
  scope: Scope;
  family_id: string | null;
  owner_id: string | null;
  version: number;
  created_at: string;
  deleted_at: string | null;
  data: Record<string, any>;
};
export type Trip = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  timezone: string;
  archived_at: string | null;
  version: number;
};
export type Member = {
  user_id: string;
  family_id: string;
  role: "admin" | "member";
  display_name: string;
  active: boolean;
};
export type Family = {
  id: string;
  name: string;
  participation_end: string | null;
};
export type Request = {
  id: string;
  item_id: string;
  base_version: number;
  before: Partial<Item>;
  patch: Partial<Item>;
  status: string;
  proposed_by: string;
  processed_by?: string;
  request_type?: "change" | "publication";
};
export type Bundle = {
  trip: Trip;
  items: Item[];
  members: Member[];
  families: Family[];
  requests: Request[];
  userId: string;
  serverTime: string;
};
