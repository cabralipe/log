export type TransportService = {
  id: number;
  name: string;
  service_type: "SCHEDULED" | "ON_DEMAND" | "MIXED";
  description?: string;
  requires_authorization: boolean;
  active: boolean;
  form_template?: number | null;
};

export type ServiceUnit = {
  id: number;
  name: string;
  unit_type: "SCHOOL" | "HEALTH" | "SOCIAL_ASSISTANCE" | "OTHER";
  address?: string;
  lat?: number | null;
  lng?: number | null;
  active: boolean;
};

export type RouteStop = {
  id: number;
  order: number;
  description: string;
  lat?: number | null;
  lng?: number | null;
  scheduled_time?: string | null;
  stop_type: "PICKUP" | "DROPOFF" | "WAYPOINT";
};

export type Route = {
  id: number;
  code: string;
  name: string;
  transport_service: number;
  route_type: "URBAN" | "RURAL" | "SPECIAL" | "EVENT";
  days_of_week: number[];
  time_window_start?: string | null;
  time_window_end?: string | null;
  estimated_duration_minutes?: number;
  planned_capacity?: number;
  active: boolean;
  preferred_vehicles?: number[];
  preferred_drivers?: number[];
  contract?: number | null;
  notes?: string;
  stops?: RouteStop[];
};

export type EligibilityPolicy = {
  id: number;
  transport_service: number;
  route?: number | null;
  name: string;
  rules_json: Record<string, any>;
  decision_mode: "AUTO_APPROVE" | "AUTO_DENY" | "AUTO_THEN_REVIEW" | "MANUAL_REVIEW_ONLY";
  active: boolean;
};

export type Person = {
  id: number;
  full_name: string;
  cpf: string;
};

export type ServiceApplication = {
  id: number;
  person: number;
  transport_service: number;
  route?: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_CORRECTION";
  status_notes?: string;
  created_at: string;
  person_detail?: Person;
};

export type Assignment = {
  id: number;
  route: number;
  date: string;
  vehicle: number;
  driver: number;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  generated_trip?: number | null;
  notes?: string;
};
