export type MaintenanceStatus = "scheduled" | "in_progress" | "completed" | "overdue";
export type MaintenanceType = "preventive" | "corrective";

export interface MaintenanceRecord {
  id: string;
  vehicle_id: string;
  maintenance_type: MaintenanceType;
  description: string;
  scheduled_date: string;
  completed_date?: string;
  cost?: number;
  status: MaintenanceStatus;
  mechanic_name?: string;
  service_location?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceFilters {
  search?: string;
  status?: MaintenanceStatus;
  type?: MaintenanceType;
  vehicle_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface MaintenanceStats {
  total: number;
  scheduled: number;
  in_progress: number;
  completed: number;
  overdue: number;
  total_cost: number;
}