export type TripPortal = {
    id: number;
    origin: string;
    destination: string;
    status: string;
    category: string;
    departure_datetime: string;
    return_datetime_expected: string;
    passengers_count: number;
    passengers_details?: {
        name: string;
        cpf?: string;
        age?: number | null;
        special_need?: string;
        special_need_other?: string;
        observation?: string;
    }[];
    cargo_description?: string;
    cargo_size?: string;
    cargo_quantity?: number;
    cargo_purpose?: string;
    vehicle_id: number;
    vehicle__license_plate: string;
};

export type AssignmentPortal = {
    id: number;
    status: "DRAFT" | "CONFIRMED" | "CANCELLED";
    date: string;
    period_start?: string | null;
    period_end?: string | null;
    notes?: string | null;
    generated_trip_id?: number | null;
    route: {
        id: number;
        code: string;
        name: string;
        route_type: string;
        service_name?: string | null;
        time_window_start?: string | null;
        time_window_end?: string | null;
        planned_capacity?: number | null;
    };
    vehicle: { id: number; license_plate: string };
};

export type FuelLogPortal = {
    id: number;
    filled_at: string;
    liters: string;
    price_per_liter?: string;
    total_cost?: string;
    fuel_station: string;
    fuel_station_ref_id?: number | null;
    notes?: string;
    receipt_image?: string;
    vehicle__license_plate: string;
};

export type FuelStation = { id: number; name: string; address?: string };

export type InspectionChecklistItem = { key: string; label: string; status: "OK" | "ISSUE"; note?: string };

export type InspectionDamagePhoto = {
    id: number;
    image: string;
    notes?: string;
    created_at?: string;
};

export type InspectionPortal = {
    id: number;
    vehicle: number;
    vehicle_plate?: string;
    inspection_date: string;
    inspected_at: string;
    odometer?: number | null;
    condition_status: "OK" | "ATTENTION";
    checklist_items: InspectionChecklistItem[];
    notes?: string;
    signature_name?: string;
    signature_image?: string;
    damage_photos: InspectionDamagePhoto[];
};

export type DriverNotification = {
    id: number;
    title: string;
    message: string;
    event_type: string;
    channel: "IN_APP" | "EMAIL" | "PUSH";
    is_read: boolean;
    created_at: string;
};

export type FreeTripPortal = {
    id: number;
    vehicle: number;
    vehicle_plate: string;
    odometer_start: number;
    odometer_end?: number | null;
    status: "OPEN" | "CLOSED";
    started_at: string;
    ended_at?: string | null;
    distance?: number | null;
};

export type FreeTripListPortal = {
    open_trip: FreeTripPortal | null;
    recent_closed: FreeTripPortal[];
};

export type PortalVehicle = {
    id: number;
    license_plate: string;
    brand?: string;
    model?: string;
    odometer_current?: number;
    odometer_initial?: number;
};

export type AvailabilityBlockPortal = {
    id: number;
    type: string;
    type_label: string;
    start_datetime: string;
    end_datetime: string;
    reason?: string | null;
    all_day?: boolean;
    is_current: boolean;
};
