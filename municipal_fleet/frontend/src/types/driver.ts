export type DriverStatus = "ACTIVE" | "INACTIVE";
export type CNHCategory = "A" | "B" | "C" | "D" | "E";

export interface Driver {
  id: number;
  name: string;
  cpf: string;
  phone: string;
  status: DriverStatus;
  cnh_number: string;
  cnh_category: CNHCategory;
  cnh_expiration_date: string;
  access_code: string;
  created_at?: string;
  updated_at?: string;
}

export interface DriverFilters {
  search?: string;
  status?: DriverStatus;
  cnh_category?: CNHCategory;
  cnh_expired?: boolean;
}