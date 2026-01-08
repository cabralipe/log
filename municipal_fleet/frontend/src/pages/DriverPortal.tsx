import { useEffect, useMemo, useState, useRef } from "react";
import { api, driverPortalApi } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { useMediaQuery } from "../hooks/useMediaQuery";
import "../styles/login.css";
import "./DriverPortal.css";

// Navigation items for sidebar
const NAV_ITEMS = [
  { id: "rastreamento", label: "Rastreamento", icon: "📍" },
  { id: "agenda", label: "Agenda", icon: "📅" },
  { id: "viagem-livre", label: "Viagem Livre", icon: "🚗" },
  { id: "escala", label: "Escala", icon: "📋" },
  { id: "viagens", label: "Minhas Viagens", icon: "🛣️" },
  { id: "abastecimento", label: "Abastecimento", icon: "⛽" },
];

type TripPortal = {
  id: number;
  origin: string;
  destination: string;
  status: string;
  category: string;
  departure_datetime: string;
  return_datetime_expected: string;
  passengers_count: number;
  passengers_details?: { name: string; cpf?: string; age?: number | null; special_need?: string; special_need_other?: string; observation?: string }[];
  cargo_description?: string;
  cargo_size?: string;
  cargo_quantity?: number;
  cargo_purpose?: string;
  vehicle_id: number;
  vehicle__license_plate: string;
};

type AssignmentPortal = {
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

type FuelLogPortal = {
  id: number;
  filled_at: string;
  liters: string;
  fuel_station: string;
  fuel_station_ref_id?: number | null;
  notes?: string;
  receipt_image?: string;
  vehicle__license_plate: string;
};

type FuelStation = { id: number; name: string; address?: string };

type FreeTripPortal = {
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

type FreeTripListPortal = {
  open_trip: FreeTripPortal | null;
  recent_closed: FreeTripPortal[];
};

type PortalVehicle = {
  id: number;
  license_plate: string;
  brand?: string;
  model?: string;
  odometer_current?: number;
  odometer_initial?: number;
};

type AvailabilityBlockPortal = {
  id: number;
  type: string;
  type_label: string;
  start_datetime: string;
  end_datetime: string;
  reason?: string | null;
  all_day?: boolean;
  is_current: boolean;
};

export const DriverPortalPage = () => {
  const { isMobile } = useMediaQuery();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("agenda");
  const mainRef = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState("");
  const [token, setToken] = useState<string | null>(localStorage.getItem("driver_portal_token"));
  const [driverName, setDriverName] = useState<string>("");
  const [trips, setTrips] = useState<TripPortal[]>([]);
  const [assignments, setAssignments] = useState<AssignmentPortal[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLogPortal[]>([]);
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [fuelForm, setFuelForm] = useState<{ vehicle: number | ""; fuel_station_id: number | ""; filled_at: string; liters: string; notes: string; receipt_image: File | null }>({
    vehicle: "",
    fuel_station_id: "",
    filled_at: "",
    liters: "",
    notes: "",
    receipt_image: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [completingTripIds, setCompletingTripIds] = useState<number[]>([]);
  const [showPassengersModal, setShowPassengersModal] = useState(false);
  const [incidentTrip, setIncidentTrip] = useState<TripPortal | null>(null);
  const [incidentText, setIncidentText] = useState("");
  const [incidentError, setIncidentError] = useState<string | null>(null);
  const [freeTrips, setFreeTrips] = useState<FreeTripListPortal | null>(null);
  const [freeTripError, setFreeTripError] = useState<string | null>(null);
  const [freeTripVehicles, setFreeTripVehicles] = useState<PortalVehicle[]>([]);
  const [freeTripStart, setFreeTripStart] = useState<{ vehicle_id: number | ""; odometer_start: string; photo: File | null }>({
    vehicle_id: "",
    odometer_start: "",
    photo: null,
  });
  const [freeTripClose, setFreeTripClose] = useState<{ odometer_end: string; photo: File | null; incident: string }>({
    odometer_end: "",
    photo: null,
    incident: "",
  });
  const [availabilityBlocks, setAvailabilityBlocks] = useState<AvailabilityBlockPortal[]>([]);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [trackingEnabled, setTrackingEnabled] = useState<boolean>(
    localStorage.getItem("driver_tracking_enabled") === "true"
  );
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [trackingInfo, setTrackingInfo] = useState<string | null>(null);
  const [trackingLastPing, setTrackingLastPing] = useState<string | null>(null);
  const trackingWatchId = useRef<number | null>(null);
  const trackingLastSentAt = useRef<number>(0);

  const specialNeedLabel = (value?: string) => {
    switch (value) {
      case "TEA": return "TEA";
      case "ELDERLY": return "Idoso";
      case "PCD": return "Pessoa com deficiência";
      case "OTHER": return "Outra";
      default: return "Nenhuma";
    }
  };

  const statusLabel = (value: string) => {
    switch (value) {
      case "PLANNED": return "Planejada";
      case "IN_PROGRESS": return "Em andamento";
      case "COMPLETED": return "Concluída";
      case "CANCELLED": return "Cancelada";
      default: return value;
    }
  };

  const assignmentStatusLabel = (value: AssignmentPortal["status"]) => {
    switch (value) {
      case "DRAFT": return "Rascunho";
      case "CONFIRMED": return "Confirmado";
      case "CANCELLED": return "Cancelado";
      default: return value;
    }
  };

  const parseDateOnly = (value: string) => new Date(`${value}T00:00:00`);

  const formatDateLabel = (value: string) =>
    parseDateOnly(value).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });

  const formatBlockPeriod = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const sameDay = startDate.toDateString() === endDate.toDateString();
    const dateLabel = startDate.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
    const startHour = startDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const endHour = endDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return sameDay
      ? `${dateLabel} · ${startHour} - ${endHour}`
      : `${startDate.toLocaleString("pt-BR")} - ${endDate.toLocaleString("pt-BR")}`;
  };

  const formatPeriod = (assignment: AssignmentPortal) => {
    const trimTime = (timeValue?: string | null) => (timeValue ? timeValue.slice(0, 5) : "--:--");
    const start = assignment.period_start ? new Date(assignment.period_start) : null;
    const end = assignment.period_end ? new Date(assignment.period_end) : null;
    if (start && end) {
      const startLabel = start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const endLabel = end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      return `${startLabel} - ${endLabel}`;
    }
    if (start) return start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (assignment.route.time_window_start || assignment.route.time_window_end) {
      return `${trimTime(assignment.route.time_window_start)} - ${trimTime(assignment.route.time_window_end)}`;
    }
    return "Horário a definir";
  };

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const availableVehicles = useMemo(() => {
    const uniques = new Map<number, string>();
    trips.forEach((t) => uniques.set(t.vehicle_id, t.vehicle__license_plate));
    assignments.forEach((a) => uniques.set(a.vehicle.id, a.vehicle.license_plate));
    return Array.from(uniques.entries()).map(([id, plate]) => ({ id, plate }));
  }, [assignments, trips]);

  const activeTrip = useMemo(() => trips.find((trip) => trip.status === "IN_PROGRESS") || null, [trips]);

  const sortedTrips = useMemo(() => {
    return [...trips].sort((a, b) => {
      const aTime = new Date(a.departure_datetime).getTime();
      const bTime = new Date(b.departure_datetime).getTime();
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
      return aTime - bTime;
    });
  }, [trips]);

  const sortedAssignments = useMemo(() => {
    return [...assignments].sort((a, b) => {
      const aDate = parseDateOnly(a.date).getTime();
      const bDate = parseDateOnly(b.date).getTime();
      if (aDate === bDate) {
        const aStart = a.period_start ? new Date(a.period_start).getTime() : 0;
        const bStart = b.period_start ? new Date(b.period_start).getTime() : 0;
        return aStart - bStart;
      }
      return aDate - bDate;
    });
  }, [assignments]);

  const sortedBlocks = useMemo(() => {
    return [...availabilityBlocks].sort(
      (a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
    );
  }, [availabilityBlocks]);

  const loadFreeTrips = async () => {
    if (!token) return;
    try {
      const { data } = await driverPortalApi.get<FreeTripListPortal>("/drivers/portal/free_trips/");
      setFreeTrips(data);
      setFreeTripError(null);
    } catch (err: any) {
      setFreeTripError(err.response?.data?.detail || "Erro ao carregar viagens livres.");
    }
  };

  const loadPortalVehicles = async () => {
    if (!token) return;
    try {
      const { data } = await driverPortalApi.get<{ vehicles: PortalVehicle[] }>("/drivers/portal/vehicles/");
      setFreeTripVehicles(data.vehicles);
      setFreeTripError(null);
    } catch (err: any) {
      setFreeTripVehicles([]);
      setFreeTripError(err.response?.data?.detail || "Erro ao carregar veículos disponíveis.");
    }
  };

  const loadAvailabilityBlocks = async () => {
    if (!token) return;
    try {
      const { data } = await driverPortalApi.get<{ blocks: AvailabilityBlockPortal[] }>("/drivers/portal/availability-blocks/");
      setAvailabilityBlocks(data.blocks || []);
      setAvailabilityError(null);
    } catch (err: any) {
      setAvailabilityBlocks([]);
      setAvailabilityError(err.response?.data?.detail || "Erro ao carregar bloqueios de agenda.");
    }
  };

  const startFreeTrip = async () => {
    if (!freeTripStart.vehicle_id) return;
    try {
      const fd = new FormData();
      fd.append("vehicle_id", String(freeTripStart.vehicle_id));
      if (freeTripStart.photo) fd.append("odometer_start_photo", freeTripStart.photo);
      const { data } = await driverPortalApi.post<FreeTripPortal>("/drivers/portal/free_trips/start/", fd);
      const startValue = data.odometer_start ?? "";
      setFreeTripStart({
        vehicle_id: "",
        odometer_start: startValue === "" ? "" : String(startValue),
        photo: null,
      });
      await loadFreeTrips();
    } catch (err: any) {
      const data = err.response?.data;
      const firstError =
        data?.detail ||
        (data && typeof data === "object" ? Object.values(data as Record<string, any>).flat().find(Boolean) : null);
      setFreeTripError(firstError || "Não foi possível iniciar a viagem livre.");
    }
  };

  const closeFreeTrip = async () => {
    const openTrip = freeTrips?.open_trip;
    if (!openTrip || !freeTripClose.odometer_end) return;
    const endValue = Number(freeTripClose.odometer_end);
    if (!Number.isFinite(endValue)) {
      setFreeTripError("Informe um odômetro final válido.");
      return;
    }
    if (typeof openTrip.odometer_start === "number" && endValue < openTrip.odometer_start) {
      setFreeTripError("Odômetro final não pode ser menor que o inicial.");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("odometer_end", String(endValue));
      if (freeTripClose.photo) fd.append("odometer_end_photo", freeTripClose.photo);
      await driverPortalApi.post(`/drivers/portal/free_trips/${openTrip.id}/close/`, fd);
      if (freeTripClose.incident.trim()) {
        await driverPortalApi.post(`/drivers/portal/free_trips/${openTrip.id}/incidents/`, {
          description: freeTripClose.incident,
        });
      }
      setFreeTripClose({ odometer_end: "", photo: null, incident: "" });
      await loadFreeTrips();
    } catch (err: any) {
      const data = err.response?.data;
      const firstError =
        data?.detail ||
        (data && typeof data === "object" ? Object.values(data as Record<string, any>).flat().find(Boolean) : null);
      setFreeTripError(firstError || "Não foi possível encerrar a viagem livre.");
    }
  };

  const reportFreeTripIncident = async () => {
    const openTrip = freeTrips?.open_trip;
    if (!openTrip || !freeTripClose.incident.trim()) return;
    try {
      await driverPortalApi.post(`/drivers/portal/free_trips/${openTrip.id}/incidents/`, {
        description: freeTripClose.incident,
      });
      setFreeTripClose((prev) => ({ ...prev, incident: "" }));
      await loadFreeTrips();
    } catch (err: any) {
      setFreeTripError(err.response?.data?.detail || "Não foi possível registrar a ocorrência.");
    }
  };

  const thisWeekAssignments = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    const weekday = start.getDay();
    const diff = weekday === 0 ? -6 : 1 - weekday;
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return sortedAssignments.filter((a) => {
      const dateValue = parseDateOnly(a.date);
      return dateValue >= start && dateValue <= end;
    });
  }, [sortedAssignments]);

  const thisMonthAssignments = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const monthData = sortedAssignments.filter((a) => {
      const dateValue = parseDateOnly(a.date);
      return dateValue.getMonth() === month && dateValue.getFullYear() === year;
    });
    return monthData.length ? monthData : sortedAssignments;
  }, [sortedAssignments]);

  const passengerTrips = useMemo(
    () => sortedTrips.filter((t) => (t.passengers_details?.length || 0) > 0),
    [sortedTrips]
  );

  useEffect(() => {
    if (token) {
      loadPortalData();
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem("driver_tracking_enabled", trackingEnabled ? "true" : "false");
  }, [trackingEnabled]);

  useEffect(() => {
    if (!trackingEnabled) {
      if (trackingWatchId.current !== null) {
        navigator.geolocation.clearWatch(trackingWatchId.current);
        trackingWatchId.current = null;
      }
      setTrackingInfo(null);
      setTrackingError(null);
      return;
    }
    if (!token) return;
    if (!navigator.geolocation) {
      setTrackingError("Geolocalização não disponível neste aparelho.");
      setTrackingEnabled(false);
      return;
    }
    const onSuccess = async (position: GeolocationPosition) => {
      const now = Date.now();
      if (now - trackingLastSentAt.current < 12000) return;
      if (!activeTrip) {
        setTrackingError("Nenhuma viagem em andamento para rastrear.");
        return;
      }
      trackingLastSentAt.current = now;
      const payload = {
        trip_id: activeTrip.id,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        recorded_at: new Date(position.timestamp).toISOString(),
      };
      try {
        await driverPortalApi.post("/drivers/portal/gps/ping/", payload);
        setTrackingError(null);
        setTrackingInfo("Rastreio ativo: posição enviada.");
        setTrackingLastPing(new Date(position.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      } catch (err: any) {
        setTrackingError(err.response?.data?.detail || "Erro ao enviar posição.");
      }
    };
    const onError = (err: GeolocationPositionError) => {
      const message = err.code === err.PERMISSION_DENIED
        ? "Permissão de localização negada."
        : "Não foi possível obter localização.";
      setTrackingError(message);
      setTrackingEnabled(false);
    };
    trackingWatchId.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    });
    return () => {
      if (trackingWatchId.current !== null) {
        navigator.geolocation.clearWatch(trackingWatchId.current);
        trackingWatchId.current = null;
      }
    };
  }, [trackingEnabled, token, activeTrip]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const normalizedCode = code.trim().toUpperCase();
      const { data } = await api.post("/drivers/portal/login/", { code: normalizedCode });
      localStorage.setItem("driver_portal_token", data.token);
      setToken(data.token);
      setDriverName(data.driver.name);
      setCode(normalizedCode);
      setError(null);
      loadPortalData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Código inválido.");
    }
  };

  const loadPortalData = async () => {
    try {
      const tripsRes = await driverPortalApi.get<{ driver: string; trips: TripPortal[] }>("/drivers/portal/trips/");
      setDriverName(tripsRes.data.driver);
      setTrips(tripsRes.data.trips);
      const assignmentsRes = await driverPortalApi.get<{ assignments: AssignmentPortal[] }>("/drivers/portal/assignments/");
      setAssignments(assignmentsRes.data.assignments || []);
      const fuelRes = await driverPortalApi.get<{ logs: FuelLogPortal[] }>("/drivers/portal/fuel_logs/");
      setFuelLogs(fuelRes.data.logs);
      const stationsRes = await driverPortalApi.get<{ stations: FuelStation[] }>("/drivers/portal/fuel_stations/");
      setStations(stationsRes.data.stations);
      await loadFreeTrips();
      await loadPortalVehicles();
      await loadAvailabilityBlocks();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Sessão expirada ou código inválido. Entre novamente.");
      localStorage.removeItem("driver_portal_token");
      setToken(null);
    }
  };

  const handleCompleteTrip = async (tripId: number) => {
    setCompletingTripIds((ids) => (ids.includes(tripId) ? ids : [...ids, tripId]));
    try {
      await driverPortalApi.post(`/drivers/portal/trips/${tripId}/complete/`);
      setTrips((prev) => prev.map((trip) => (trip.id === tripId ? { ...trip, status: "COMPLETED" } : trip)));
      setInfo("Viagem marcada como concluída.");
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Não foi possível concluir a viagem.");
    } finally {
      setCompletingTripIds((ids) => ids.filter((id) => id !== tripId));
      loadPortalData();
    }
  };

  const openIncidentModal = (trip: TripPortal) => {
    setIncidentTrip(trip);
    setIncidentText("");
    setIncidentError(null);
    setShowPassengersModal(false);
  };

  const handleSubmitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentTrip) return;
    if (!incidentText.trim()) {
      setIncidentError("Descreva o ocorrido.");
      return;
    }
    try {
      await driverPortalApi.post(`/drivers/portal/trips/${incidentTrip.id}/incidents/`, { description: incidentText });
      setInfo("Ocorrência registrada.");
      setIncidentTrip(null);
      setIncidentText("");
      setIncidentError(null);
      loadPortalData();
    } catch (err: any) {
      setIncidentError(err.response?.data?.detail || "Erro ao registrar ocorrência.");
    }
  };

  const handleFuelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fuelForm.vehicle) {
      setError("Escolha o veículo abastecido.");
      return;
    }
    if (!fuelForm.fuel_station_id) {
      setError("Escolha um posto credenciado.");
      return;
    }
    if (!fuelForm.liters || Number(fuelForm.liters) <= 0) {
      setError("Informe a quantidade de litros (maior que zero).");
      return;
    }
    const fd = new FormData();
    fd.append("vehicle", String(fuelForm.vehicle));
    fd.append("fuel_station_id", String(fuelForm.fuel_station_id));
    fd.append("filled_at", fuelForm.filled_at);
    fd.append("liters", fuelForm.liters);
    if (fuelForm.notes) fd.append("notes", fuelForm.notes);
    if (fuelForm.receipt_image) fd.append("receipt_image", fuelForm.receipt_image);
    try {
      await driverPortalApi.post("/drivers/portal/fuel_logs/", fd);
      setFuelForm({ vehicle: fuelForm.vehicle, fuel_station_id: "", filled_at: "", liters: "", notes: "", receipt_image: null });
      setInfo("Abastecimento registrado.");
      loadPortalData();
    } catch (err: any) {
      const data = err.response?.data;
      const firstError =
        data?.detail ||
        (data && typeof data === "object" ? Object.values(data as Record<string, any>).flat().find(Boolean) : null);
      setError(firstError || "Erro ao registrar abastecimento.");
    }
  };

  const logout = () => {
    localStorage.removeItem("driver_portal_token");
    setToken(null);
    setTrips([]);
    setAssignments([]);
    setFuelLogs([]);
    setDriverName("");
    setIncidentTrip(null);
  };

  const hasPassengers = passengerTrips.length > 0;

  // Navigation function for scrolling to sections
  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // =========== RENDER ===========

  if (!token) {
    return (
      <div className="login" style={{ minHeight: "100vh" }}>
        <div className="login-card card">
          <h1>Acesso do motorista</h1>
          <p>Informe o código fornecido pela prefeitura para ver suas viagens e prestar contas de abastecimentos.</p>
          <form onSubmit={handleLogin} className="grid form-grid">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Código do motorista" required />
            <Button type="submit" fullWidth>Entrar</Button>
            {error && <div className="error">{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  // Render Trip Cards for Mobile
  const renderTripCards = () => (
    <div className="driver-portal__trips-grid">
      {sortedTrips.map((trip) => (
        <div key={trip.id} className="driver-portal__trip-card">
          <div className="driver-portal__trip-route">
            <span>{trip.origin}</span>
            <span className="driver-portal__trip-route-arrow">→</span>
            <span>{trip.destination}</span>
          </div>
          <div className="driver-portal__trip-meta">
            <div className="driver-portal__trip-meta-item">
              <span className="driver-portal__trip-meta-label">Status</span>
              <span className="driver-portal__trip-meta-value">{statusLabel(trip.status)}</span>
            </div>
            <div className="driver-portal__trip-meta-item">
              <span className="driver-portal__trip-meta-label">Saída</span>
              <span className="driver-portal__trip-meta-value">{formatDateTime(trip.departure_datetime)}</span>
            </div>
            <div className="driver-portal__trip-meta-item">
              <span className="driver-portal__trip-meta-label">Passageiros</span>
              <span className="driver-portal__trip-meta-value">{trip.passengers_count}</span>
            </div>
            <div className="driver-portal__trip-meta-item">
              <span className="driver-portal__trip-meta-label">Veículo</span>
              <span className="driver-portal__trip-meta-value">{trip.vehicle__license_plate}</span>
            </div>
          </div>
          <div className="driver-portal__trip-actions">
            {trip.status !== "COMPLETED" && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleCompleteTrip(trip.id)}
                disabled={completingTripIds.includes(trip.id)}
              >
                {completingTripIds.includes(trip.id) ? "Enviando..." : "✓ Concluir"}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => openIncidentModal(trip)}>
              Relatar ocorrido
            </Button>
          </div>
        </div>
      ))}
      {sortedTrips.length === 0 && (
        <div className="driver-portal__empty">Nenhuma viagem encontrada.</div>
      )}
    </div>
  );

  // Render Fuel Cards for Mobile
  const renderFuelCards = () => (
    <div className="driver-portal__fuel-cards">
      {fuelLogs.map((log) => (
        <div key={log.id} className="driver-portal__fuel-card">
          <div className="driver-portal__fuel-card-info">
            <div className="driver-portal__fuel-card-station">{log.fuel_station}</div>
            <div className="driver-portal__fuel-card-details">
              {log.filled_at} · {log.vehicle__license_plate}
              {log.receipt_image && (
                <> · <a href={log.receipt_image} target="_blank" rel="noopener noreferrer">Ver nota</a></>
              )}
            </div>
          </div>
          <div className="driver-portal__fuel-card-liters">{log.liters} L</div>
        </div>
      ))}
      {fuelLogs.length === 0 && (
        <div className="driver-portal__empty">Nenhum abastecimento registrado.</div>
      )}
    </div>
  );

  return (
    <div className="driver-portal">
      {/* Mobile Menu Toggle */}
      <button
        className="driver-portal__menu-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Abrir menu"
      >
        {sidebarOpen ? "✕" : "☰"}
      </button>

      {/* Sidebar Overlay (mobile) */}
      <div
        className={`driver-portal__sidebar-overlay ${sidebarOpen ? "driver-portal__sidebar-overlay--visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar Navigation */}
      <aside className={`driver-portal__sidebar ${sidebarOpen ? "driver-portal__sidebar--open" : ""}`}>
        <div className="driver-portal__sidebar-header">
          <h2>🚐 Portal</h2>
          <p>Olá, {driverName || "motorista"}</p>
        </div>
        <nav className="driver-portal__sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`driver-portal__nav-item ${activeSection === item.id ? "driver-portal__nav-item--active" : ""}`}
              onClick={() => scrollToSection(item.id)}
            >
              <span className="driver-portal__nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="driver-portal__sidebar-footer">
          <Button variant="ghost" onClick={logout} fullWidth>
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="driver-portal__main" ref={mainRef}>
        {/* Alerts */}
        <div className="driver-portal__alerts">
          {error && <div className="driver-portal__alert driver-portal__alert--error">{error}</div>}
          {info && <div className="driver-portal__alert driver-portal__alert--success">{info}</div>}
          {availabilityError && <div className="driver-portal__alert driver-portal__alert--error">{availabilityError}</div>}
        </div>

        {/* Tracking Section */}
        <section id="rastreamento" className="driver-portal__section">
          <div className="driver-portal__section-header">
            <div>
              <span className="eyebrow">Rastreamento</span>
              <h3>Compartilhar localização em tempo real</h3>
              <p>Ative para enviar sua posição automaticamente durante a viagem em andamento.</p>
            </div>
            <Button
              variant={trackingEnabled ? "primary" : "ghost"}
              size="sm"
              onClick={() => setTrackingEnabled((prev) => !prev)}
            >
              {trackingEnabled ? "Desativar" : "Ativar"}
            </Button>
          </div>
          <div className="driver-portal__tracking-card">
            <div className="driver-portal__tracking-status">
              <span className={`driver-portal__tracking-pill ${trackingEnabled ? "active" : "inactive"}`}>
                {trackingEnabled ? "Ativo" : "Desativado"}
              </span>
              {activeTrip ? (
                <span className="driver-portal__tracking-trip">
                  Viagem em andamento: {activeTrip.origin} → {activeTrip.destination}
                </span>
              ) : (
                <span className="driver-portal__tracking-trip">Nenhuma viagem em andamento.</span>
              )}
            </div>
            <div className="driver-portal__tracking-meta">
              <div>
                <span className="label">Último envio</span>
                <strong>{trackingLastPing || "—"}</strong>
              </div>
              <div>
                <span className="label">Status</span>
                <strong>{trackingError || trackingInfo || (trackingEnabled ? "Aguardando localização..." : "—")}</strong>
              </div>
            </div>
          </div>
          {trackingError && <div className="driver-portal__alert driver-portal__alert--error">{trackingError}</div>}
        </section>

        {/* Availability Blocks Section */}
        <section id="agenda" className="driver-portal__section">
          <div className="driver-portal__section-header">
            <div>
              <span className="eyebrow">Agenda</span>
              <h3>Bloqueios e folgas</h3>
              <p>Se houver uma folga, férias ou afastamento ativo, novas viagens serão bloqueadas automaticamente.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={loadAvailabilityBlocks}>Atualizar</Button>
          </div>
          {sortedBlocks.length > 0 ? (
            <div className="driver-portal__blocks-grid">
              {sortedBlocks.map((block) => (
                <div
                  key={block.id}
                  className={`driver-portal__block-card ${block.is_current ? "driver-portal__block-card--active" : ""}`}
                >
                  <div className="driver-portal__block-header">
                    <strong>{block.type_label}</strong>
                    <span className={`driver-portal__block-badge ${block.is_current ? "driver-portal__block-badge--active" : "driver-portal__block-badge--scheduled"}`}>
                      {block.is_current ? "Em vigor" : "Agendado"}
                    </span>
                  </div>
                  <div style={{ color: "var(--muted)" }}>{formatBlockPeriod(block.start_datetime, block.end_datetime)}</div>
                  {block.reason && <p style={{ color: "var(--muted)", marginTop: "0.35rem", marginBottom: 0 }}>{block.reason}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="driver-portal__empty">Nenhum bloqueio ativo ou agendado.</div>
          )}
        </section>

        {/* Free Trip Section */}
        <section id="viagem-livre" className="driver-portal__section">
          <div className="driver-portal__section-header">
            <div>
              <h3>Viagem livre</h3>
              <p>Registre qual veículo está usando, quilometragem inicial/final e trocas durante o dia.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { loadFreeTrips(); loadPortalVehicles(); }}>Atualizar</Button>
          </div>

          {freeTripError && <div className="driver-portal__alert driver-portal__alert--error">{freeTripError}</div>}

          {!freeTrips?.open_trip ? (
            <div className="driver-portal__free-trip-form">
              <select
                value={freeTripStart.vehicle_id}
                onChange={(e) => {
                  const value = e.target.value;
                  const vehicleId = value ? Number(value) : "";
                  const selectedVehicle = typeof vehicleId === "number" ? freeTripVehicles.find((v) => v.id === vehicleId) : undefined;
                  const initialOdometer = selectedVehicle
                    ? selectedVehicle.odometer_current ?? selectedVehicle.odometer_initial ?? ""
                    : "";
                  setFreeTripStart((f) => ({
                    ...f,
                    vehicle_id: vehicleId,
                    odometer_start: initialOdometer === "" ? "" : String(initialOdometer),
                  }));
                }}
              >
                <option value="">Selecione o veículo</option>
                {freeTripVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.license_plate} {v.brand || v.model ? `— ${v.brand || ""} ${v.model || ""}` : ""}
                  </option>
                ))}
              </select>
              <label>
                Odômetro inicial
                <input type="number" placeholder="Km" value={freeTripStart.odometer_start} readOnly />
              </label>
              <label>
                Foto do painel (opcional)
                <input type="file" accept="image/*" onChange={(e) => setFreeTripStart((f) => ({ ...f, photo: e.target.files?.[0] || null }))} />
              </label>
              <Button onClick={startFreeTrip} disabled={!freeTripStart.vehicle_id || freeTripStart.odometer_start === ""} fullWidth>
                Iniciar viagem livre
              </Button>
            </div>
          ) : (
            <>
              <div className="driver-portal__free-trip-status">
                <div className="stat-item">
                  <span className="stat-label">Veículo</span>
                  <span className="stat-value">{freeTrips.open_trip.vehicle_plate}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Início</span>
                  <span className="stat-value">{new Date(freeTrips.open_trip.started_at).toLocaleString("pt-BR")}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">KM inicial</span>
                  <span className="stat-value">{freeTrips.open_trip.odometer_start}</span>
                </div>
              </div>
              <div className="driver-portal__free-trip-form">
                <label>
                  Odômetro final
                  <input
                    type="number"
                    placeholder="Km final"
                    value={freeTripClose.odometer_end}
                    onChange={(e) => setFreeTripClose((f) => ({ ...f, odometer_end: e.target.value }))}
                  />
                </label>
                <label>
                  Foto do painel (opcional)
                  <input type="file" accept="image/*" onChange={(e) => setFreeTripClose((f) => ({ ...f, photo: e.target.files?.[0] || null }))} />
                </label>
                <label className="full-width">
                  Relatar ocorrência (opcional)
                  <textarea
                    rows={2}
                    placeholder="Descreva o ocorrido..."
                    value={freeTripClose.incident}
                    onChange={(e) => setFreeTripClose((f) => ({ ...f, incident: e.target.value }))}
                  />
                </label>
                <div className="driver-portal__free-trip-actions full-width">
                  <Button onClick={closeFreeTrip} disabled={!freeTripClose.odometer_end}>
                    Encerrar viagem
                  </Button>
                  <Button variant="ghost" onClick={reportFreeTripIncident} disabled={!freeTripClose.incident.trim()}>
                    Registrar ocorrência
                  </Button>
                </div>
              </div>
            </>
          )}

          {freeTrips?.recent_closed?.length ? (
            <div style={{ marginTop: "1rem" }}>
              <h4 style={{ margin: "0 0 0.5rem", color: "var(--muted)", fontSize: "0.9rem" }}>Últimas encerradas</h4>
              {isMobile ? (
                <div className="driver-portal__fuel-cards">
                  {freeTrips.recent_closed.map((ft) => (
                    <div key={ft.id} className="driver-portal__fuel-card">
                      <div className="driver-portal__fuel-card-info">
                        <div className="driver-portal__fuel-card-station">{ft.vehicle_plate}</div>
                        <div className="driver-portal__fuel-card-details">
                          {ft.odometer_start} → {ft.odometer_end ?? "—"} km
                        </div>
                      </div>
                      <div className="driver-portal__fuel-card-liters">{ft.distance ?? "—"} km</div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table
                  columns={[
                    { key: "vehicle_plate", label: "Veículo" },
                    { key: "odometer_start", label: "KM inicial" },
                    { key: "odometer_end", label: "KM final" },
                    { key: "distance", label: "Rodado", render: (row) => row.distance ?? "—" },
                    { key: "ended_at", label: "Fim", render: (row) => new Date(row.ended_at || "").toLocaleString("pt-BR") },
                  ]}
                  data={freeTrips.recent_closed}
                />
              )}
            </div>
          ) : null}
        </section>

        {/* Schedule Section */}
        <section id="escala" className="driver-portal__section">
          <div className="driver-portal__section-header">
            <div>
              <h3>Escala do planejamento</h3>
              <p>Integração com o planejador de viagens para que você veja a rotina da semana e do mês.</p>
            </div>
          </div>
          <div className="driver-portal__schedule-grid">
            <div className="driver-portal__week-panel">
              <h4>Semana atual</h4>
              {thisWeekAssignments.length === 0 ? (
                <div className="driver-portal__empty">Nenhuma escala cadastrada para esta semana.</div>
              ) : (
                <div className="driver-portal__assignments-list">
                  {thisWeekAssignments.map((assignment) => (
                    <div key={assignment.id} className="driver-portal__assignment-card">
                      <div className="driver-portal__assignment-card-header">
                        <div>
                          <div className="driver-portal__assignment-date">{formatDateLabel(assignment.date)}</div>
                          <div className="driver-portal__assignment-route">
                            {assignment.route.code} · {assignment.route.name}
                          </div>
                          <div className="driver-portal__assignment-vehicle">
                            Veículo {assignment.vehicle.license_plate}
                          </div>
                          {assignment.route.service_name && (
                            <div className="driver-portal__assignment-vehicle">{assignment.route.service_name}</div>
                          )}
                        </div>
                        <div style={{ textAlign: isMobile ? "left" : "right" }}>
                          <div className="driver-portal__assignment-time">{formatPeriod(assignment)}</div>
                          <span className={`driver-portal__assignment-status ${assignment.status === "CONFIRMED" ? "driver-portal__assignment-status--confirmed" : "driver-portal__assignment-status--draft"}`}>
                            {assignmentStatusLabel(assignment.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="driver-portal__month-panel">
              <h4>Agenda do mês</h4>
              {isMobile ? (
                <div className="driver-portal__assignments-list">
                  {thisMonthAssignments.slice(0, 10).map((assignment) => (
                    <div key={assignment.id} className="driver-portal__assignment-card">
                      <div className="driver-portal__assignment-date">{formatDateLabel(assignment.date)}</div>
                      <div className="driver-portal__assignment-route">
                        {assignment.route.code} — {assignment.route.name}
                      </div>
                      <div className="driver-portal__assignment-time">{formatPeriod(assignment)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table
                  columns={[
                    { key: "date", label: "Data", render: (row) => formatDateLabel(row.date) },
                    { key: "period_start", label: "Horário", render: (row) => formatPeriod(row) },
                    { key: "route", label: "Rota", render: (row) => `${row.route.code} — ${row.route.name}` },
                    { key: "service", label: "Serviço", render: (row) => row.route.service_name || "—" },
                    { key: "vehicle", label: "Veículo", render: (row) => row.vehicle.license_plate },
                    { key: "status", label: "Status", render: (row) => assignmentStatusLabel(row.status) },
                  ]}
                  data={thisMonthAssignments}
                />
              )}
            </div>
          </div>
        </section>

        {/* Trips Section */}
        <section id="viagens" className="driver-portal__section">
          <div className="driver-portal__section-header">
            <h3>Minhas viagens</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowPassengersModal(true)} disabled={!hasPassengers}>
              Ver passageiros
            </Button>
          </div>
          {isMobile ? (
            renderTripCards()
          ) : (
            <Table
              columns={[
                { key: "origin", label: "Origem" },
                { key: "destination", label: "Destino" },
                { key: "category", label: "Categoria" },
                { key: "status", label: "Status", render: (row) => statusLabel(row.status) },
                { key: "departure_datetime", label: "Saída", render: (row) => formatDateTime(row.departure_datetime) },
                { key: "passengers_count", label: "Pass." },
                { key: "vehicle__license_plate", label: "Veículo" },
                {
                  key: "actions",
                  label: "Ações",
                  render: (row) => (
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      {row.status !== "COMPLETED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCompleteTrip(row.id)}
                          disabled={completingTripIds.includes(row.id)}
                        >
                          {completingTripIds.includes(row.id) ? "..." : "Concluir"}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openIncidentModal(row)}>
                        Ocorrência
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={sortedTrips}
            />
          )}
          {!hasPassengers && <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>Nenhum passageiro cadastrado nas viagens.</p>}
        </section>

        {/* Fuel Section */}
        <section id="abastecimento" className="driver-portal__section">
          <div className="driver-portal__section-header">
            <h3>Prestação de contas de abastecimento</h3>
          </div>
          <form className="driver-portal__fuel-form" onSubmit={handleFuelSubmit}>
            <select value={fuelForm.vehicle} onChange={(e) => setFuelForm((f) => ({ ...f, vehicle: Number(e.target.value) }))} required>
              <option value="">Veículo</option>
              {availableVehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.plate}</option>
              ))}
            </select>
            <select value={fuelForm.fuel_station_id} onChange={(e) => setFuelForm((f) => ({ ...f, fuel_station_id: Number(e.target.value) }))} required>
              <option value="">Posto credenciado</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <label>
              Data do abastecimento
              <input type="date" value={fuelForm.filled_at} onChange={(e) => setFuelForm((f) => ({ ...f, filled_at: e.target.value }))} required />
            </label>
            <label>
              Litros
              <input type="number" step="0.01" placeholder="0.00" value={fuelForm.liters} onChange={(e) => setFuelForm((f) => ({ ...f, liters: e.target.value }))} required />
            </label>
            <label className="full-width">
              Observações (opcional)
              <textarea placeholder="Observações" value={fuelForm.notes} onChange={(e) => setFuelForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </label>
            <label>
              Comprovante (foto)
              <input type="file" accept="image/*" onChange={(e) => setFuelForm((f) => ({ ...f, receipt_image: e.target.files?.[0] || null }))} />
            </label>
            <Button type="submit" fullWidth>Registrar abastecimento</Button>
          </form>

          <div className="driver-portal__fuel-history">
            <h4>Histórico de abastecimentos</h4>
            {isMobile ? renderFuelCards() : (
              <Table
                columns={[
                  { key: "filled_at", label: "Data" },
                  { key: "fuel_station", label: "Posto" },
                  { key: "liters", label: "Litros" },
                  { key: "vehicle__license_plate", label: "Veículo" },
                  { key: "receipt_image", label: "Nota", render: (row) => (row.receipt_image ? <a href={row.receipt_image} target="_blank" rel="noopener noreferrer">Ver</a> : "—") },
                ]}
                data={fuelLogs}
              />
            )}
          </div>
        </section>

        {/* Passengers Modal */}
        {showPassengersModal && (
          <div className="driver-portal__modal-overlay" onClick={() => setShowPassengersModal(false)}>
            <div className="driver-portal__modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className="driver-portal__modal-header">
                <div>
                  <h3>Passageiros das viagens</h3>
                  <p>Lista organizada pela data e horário de saída.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowPassengersModal(false)}>Fechar</Button>
              </div>
              <div className="driver-portal__passengers-list">
                {passengerTrips.map((t) => (
                  <div key={t.id} className="driver-portal__passenger-trip-card">
                    <div className="driver-portal__passenger-trip-header">
                      <strong>Viagem #{t.id}</strong>
                      <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{t.origin} → {t.destination}</div>
                      <div style={{ color: "var(--accent)", fontSize: "0.9rem" }}>{formatDateTime(t.departure_datetime)}</div>
                    </div>
                    <div className="driver-portal__passenger-list-items">
                      {t.passengers_details?.map((p, idx) => (
                        <div key={`${t.id}-${idx}`} className="driver-portal__passenger-item">
                          <div className="driver-portal__passenger-name">
                            {p.name}{p.age !== undefined && p.age !== null ? ` — ${p.age} anos` : ""}
                          </div>
                          <div className="driver-portal__passenger-details">
                            Necessidade especial: {p.special_need ? specialNeedLabel(p.special_need) : "Nenhuma"}
                            {p.special_need === "OTHER" && p.special_need_other ? ` (${p.special_need_other})` : ""}
                            {p.observation ? ` — Obs: ${p.observation}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Incident Modal */}
        {incidentTrip && (
          <div className="driver-portal__modal-overlay" onClick={() => setIncidentTrip(null)}>
            <div className="driver-portal__modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className="driver-portal__modal-header">
                <div>
                  <h3>Registrar ocorrência</h3>
                  <p>Viagem #{incidentTrip.id} — {incidentTrip.origin} → {incidentTrip.destination}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIncidentTrip(null)}>Fechar</Button>
              </div>
              <form className="grid form-grid" onSubmit={handleSubmitIncident}>
                <textarea
                  rows={4}
                  placeholder="Descreva o ocorrido..."
                  value={incidentText}
                  onChange={(e) => { setIncidentText(e.target.value); setIncidentError(null); }}
                />
                {incidentError && <div className="error">{incidentError}</div>}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", flexWrap: "wrap" }}>
                  <Button variant="ghost" type="button" onClick={() => setIncidentTrip(null)}>Cancelar</Button>
                  <Button type="submit">Salvar relato</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
