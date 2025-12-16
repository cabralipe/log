import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { api, driverPortalApi } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import "../styles/login.css";

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(12,17,24,0.78)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  zIndex: 50,
};

const modalContentStyle: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  maxWidth: "820px",
  width: "100%",
  maxHeight: "80vh",
  overflow: "auto",
  boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
  padding: "1rem",
};

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

type PortalVehicle = { id: number; license_plate: string; brand?: string; model?: string };

export const DriverPortalPage = () => {
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
  const specialNeedLabel = (value?: string) => {
    switch (value) {
      case "TEA":
        return "TEA";
      case "ELDERLY":
        return "Idoso";
      case "PCD":
        return "Pessoa com deficiência";
      case "OTHER":
        return "Outra";
      default:
        return "Nenhuma";
    }
  };

  const statusLabel = (value: string) => {
    switch (value) {
      case "PLANNED":
        return "Planejada";
      case "IN_PROGRESS":
        return "Em andamento";
      case "COMPLETED":
        return "Concluída";
      case "CANCELLED":
        return "Cancelada";
      default:
        return value;
    }
  };

  const assignmentStatusLabel = (value: AssignmentPortal["status"]) => {
    switch (value) {
      case "DRAFT":
        return "Rascunho";
      case "CONFIRMED":
        return "Confirmado";
      case "CANCELLED":
        return "Cancelado";
      default:
        return value;
    }
  };

  const parseDateOnly = (value: string) => new Date(`${value}T00:00:00`);

  const formatDateLabel = (value: string) =>
    parseDateOnly(value).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });

  const formatPeriod = (assignment: AssignmentPortal) => {
    const trimTime = (timeValue?: string | null) => (timeValue ? timeValue.slice(0, 5) : "--:--");
    const start = assignment.period_start ? new Date(assignment.period_start) : null;
    const end = assignment.period_end ? new Date(assignment.period_end) : null;
    if (start && end) {
      const startLabel = start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const endLabel = end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      return `${startLabel} - ${endLabel}`;
    }
    if (start) {
      return start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    if (assignment.route.time_window_start || assignment.route.time_window_end) {
      return `${trimTime(assignment.route.time_window_start)} - ${trimTime(assignment.route.time_window_end)}`;
    }
    return "Horário a definir";
  };

  const availableVehicles = useMemo(() => {
    const uniques = new Map<number, string>();
    trips.forEach((t) => uniques.set(t.vehicle_id, t.vehicle__license_plate));
    assignments.forEach((a) => uniques.set(a.vehicle.id, a.vehicle.license_plate));
    return Array.from(uniques.entries()).map(([id, plate]) => ({ id, plate }));
  }, [assignments, trips]);

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

  const startFreeTrip = async () => {
    if (!freeTripStart.vehicle_id || !freeTripStart.odometer_start) return;
    try {
      const fd = new FormData();
      fd.append("vehicle_id", String(freeTripStart.vehicle_id));
      fd.append("odometer_start", freeTripStart.odometer_start);
      if (freeTripStart.photo) fd.append("odometer_start_photo", freeTripStart.photo);
      await driverPortalApi.post("/drivers/portal/free_trips/start/", fd);
      setFreeTripStart({ vehicle_id: "", odometer_start: "", photo: null });
      await loadFreeTrips();
    } catch (err: any) {
      setFreeTripError(err.response?.data?.detail || "Não foi possível iniciar a viagem livre.");
    }
  };

  const closeFreeTrip = async () => {
    const openTrip = freeTrips?.open_trip;
    if (!openTrip || !freeTripClose.odometer_end) return;
    try {
      const fd = new FormData();
      fd.append("odometer_end", freeTripClose.odometer_end);
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
      setFreeTripError(err.response?.data?.detail || "Não foi possível encerrar a viagem livre.");
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

  if (!token) {
    return (
      <div className="login" style={{ minHeight: "100vh" }}>
        <div className="login-card card">
          <h1>Acesso do motorista</h1>
          <p>Informe o código fornecido pela prefeitura para ver suas viagens e prestar contas de abastecimentos.</p>
          <form onSubmit={handleLogin} className="grid form-grid">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Código do motorista" required />
            <Button type="submit">Entrar</Button>
            {error && <div className="error">{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ margin: "1rem auto", maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h2>Portal do motorista</h2>
          <p style={{ color: "var(--muted)" }}>Bem-vindo, {driverName || "motorista"}</p>
        </div>
        <Button variant="ghost" onClick={logout}>
          Sair
        </Button>
      </div>
      {error && <div className="card" style={{ color: "#f87171" }}>{error}</div>}
      {info && <div className="card" style={{ color: "#22c55e" }}>{info}</div>}
      <div className="card" style={{ background: "#0f1724", border: "1px solid var(--border)", marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <div>
            <h3 style={{ margin: 0 }}>Viagem livre (uso avulso do veículo)</h3>
            <p style={{ color: "var(--muted)", margin: 0 }}>
              Registre qual veículo está usando, quilometragem inicial/final e trocas durante o dia.
            </p>
          </div>
          <Button variant="ghost" onClick={() => { loadFreeTrips(); loadPortalVehicles(); }}>
            Atualizar
          </Button>
        </div>
        {freeTripError && <div className="card" style={{ color: "#f87171" }}>{freeTripError}</div>}
        {!freeTrips?.open_trip ? (
          <div className="grid form-grid responsive">
            <select
              value={freeTripStart.vehicle_id}
              onChange={(e) => setFreeTripStart((f) => ({ ...f, vehicle_id: Number(e.target.value) }))}
            >
              <option value="">Selecione o veículo</option>
              {freeTripVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.license_plate} {v.brand || v.model ? `— ${v.brand || ""} ${v.model || ""}` : ""}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Odômetro inicial"
              value={freeTripStart.odometer_start}
              onChange={(e) => setFreeTripStart((f) => ({ ...f, odometer_start: e.target.value }))}
            />
            <label>
              Foto do painel (opcional)
              <input type="file" accept="image/*" onChange={(e) => setFreeTripStart((f) => ({ ...f, photo: e.target.files?.[0] || null }))} />
            </label>
            <Button onClick={startFreeTrip} disabled={!freeTripStart.vehicle_id || !freeTripStart.odometer_start}>
              Iniciar viagem livre
            </Button>
          </div>
        ) : (
          <div className="grid form-grid responsive">
            <div>
              <div style={{ color: "var(--muted)" }}>Veículo em uso</div>
              <strong>{freeTrips.open_trip.vehicle_plate}</strong>
            </div>
            <div>
              <div style={{ color: "var(--muted)" }}>Início</div>
              <strong>{new Date(freeTrips.open_trip.started_at).toLocaleString("pt-BR")}</strong>
            </div>
            <div>
              <div style={{ color: "var(--muted)" }}>KM inicial</div>
              <strong>{freeTrips.open_trip.odometer_start}</strong>
            </div>
            <input
              type="number"
              placeholder="Odômetro final"
              value={freeTripClose.odometer_end}
              onChange={(e) => setFreeTripClose((f) => ({ ...f, odometer_end: e.target.value }))}
            />
            <label>
              Foto do painel (opcional)
              <input type="file" accept="image/*" onChange={(e) => setFreeTripClose((f) => ({ ...f, photo: e.target.files?.[0] || null }))} />
            </label>
            <textarea
              rows={3}
              placeholder="Relatar ocorrência (opcional)"
              value={freeTripClose.incident}
              onChange={(e) => setFreeTripClose((f) => ({ ...f, incident: e.target.value }))}
            />
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <Button onClick={closeFreeTrip} disabled={!freeTripClose.odometer_end}>
                Encerrar viagem livre
              </Button>
              <Button variant="ghost" onClick={reportFreeTripIncident} disabled={!freeTripClose.incident.trim()}>
                Registrar ocorrência
              </Button>
            </div>
          </div>
        )}
        {freeTrips?.recent_closed?.length ? (
          <div style={{ marginTop: "0.75rem" }}>
            <p className="eyebrow">Últimas encerradas</p>
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
          </div>
        ) : null}
      </div>
      <div className="card" style={{ background: "#0f1724", border: "1px solid var(--border)", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "0.75rem" }}>
          <div>
            <h3 style={{ margin: 0 }}>Escala do planejamento</h3>
            <p style={{ color: "var(--muted)", margin: "0.25rem 0 0" }}>
              Integração com o planejador de viagens para que você veja a rotina da semana e do mês.
            </p>
          </div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "0.75rem" }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "0.75rem", background: "#0b1422" }}>
            <h4 style={{ margin: "0 0 0.5rem 0" }}>Semana atual</h4>
            {thisWeekAssignments.length === 0 ? (
              <p style={{ color: "var(--muted)", margin: 0 }}>Nenhuma escala cadastrada para esta semana.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.55rem" }}>
                {thisWeekAssignments.map((assignment) => (
                  <li
                    key={assignment.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      padding: "0.65rem",
                      background: "#0f1a2b",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{formatDateLabel(assignment.date)}</div>
                        <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
                          {assignment.route.code} · {assignment.route.name}
                        </div>
                        <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                          Veículo {assignment.vehicle.license_plate}
                        </div>
                        {assignment.route.service_name && (
                          <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{assignment.route.service_name}</div>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "var(--accent)", fontWeight: 700 }}>{formatPeriod(assignment)}</div>
                        <div
                          style={{
                            display: "inline-block",
                            marginTop: "0.35rem",
                            padding: "0.15rem 0.55rem",
                            borderRadius: "999px",
                            border: "1px solid var(--border)",
                            background: assignment.status === "CONFIRMED" ? "#0f5132" : "#2a2438",
                            color: assignment.status === "CONFIRMED" ? "#c6f6d5" : "var(--muted)",
                            fontSize: "0.9rem",
                          }}
                        >
                          {assignmentStatusLabel(assignment.status)}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 style={{ margin: "0 0 0.35rem 0" }}>Agenda do mês</h4>
            <Table
              columns={[
                { key: "date", label: "Data", render: (row) => formatDateLabel(row.date) },
                { key: "period_start", label: "Horário", render: (row) => formatPeriod(row) },
                { key: "route", label: "Rota", render: (row) => `${row.route.code} — ${row.route.name}` },
                {
                  key: "service",
                  label: "Serviço",
                  render: (row) => row.route.service_name || "—",
                },
                { key: "vehicle", label: "Veículo", render: (row) => row.vehicle.license_plate },
                { key: "status", label: "Status", render: (row) => assignmentStatusLabel(row.status) },
              ]}
              data={thisMonthAssignments}
            />
          </div>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: "1rem" }}>
        <div className="card" style={{ background: "#0f1724", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <h3 style={{ margin: 0 }}>Minhas viagens</h3>
            <Button variant="ghost" onClick={() => setShowPassengersModal(true)} disabled={!hasPassengers} title={hasPassengers ? undefined : "Nenhum passageiro cadastrado"}>
              Ver passageiros
            </Button>
          </div>
          <Table
            columns={[
              { key: "origin", label: "Origem" },
              { key: "destination", label: "Destino" },
              { key: "category", label: "Categoria" },
              { key: "status", label: "Status", render: (row) => statusLabel(row.status) },
              { key: "departure_datetime", label: "Saída" },
              { key: "passengers_count", label: "Passageiros" },
              { key: "vehicle__license_plate", label: "Veículo" },
              {
                key: "actions",
                label: "Ações",
                render: (row) => (
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                    {row.status !== "COMPLETED" && (
                      <Button
                        variant="ghost"
                        onClick={() => handleCompleteTrip(row.id)}
                        disabled={completingTripIds.includes(row.id)}
                        title={completingTripIds.includes(row.id) ? "Enviando..." : "Marcar como concluída"}
                        style={{ padding: "0.4rem 0.6rem" }}
                      >
                        {completingTripIds.includes(row.id) ? "Enviando..." : "Concluir"}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => openIncidentModal(row)}
                      style={{ padding: "0.4rem 0.6rem" }}
                    >
                      Relatar ocorrido
                    </Button>
                  </div>
                ),
              },
            ]}
            data={sortedTrips}
          />
          {!hasPassengers && <p style={{ color: "var(--muted)", marginTop: "0.25rem" }}>Nenhum passageiro cadastrado nas viagens.</p>}
        </div>
        <div className="card" style={{ background: "#0f1724", border: "1px solid var(--border)" }}>
          <h3>Prestação de contas de abastecimento</h3>
          <form className="grid form-grid responsive" onSubmit={handleFuelSubmit}>
            <select value={fuelForm.vehicle} onChange={(e) => setFuelForm((f) => ({ ...f, vehicle: Number(e.target.value) }))} required>
              <option value="">Veículo</option>
              {availableVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate}
                </option>
              ))}
            </select>
            <select
              value={fuelForm.fuel_station_id}
              onChange={(e) => setFuelForm((f) => ({ ...f, fuel_station_id: Number(e.target.value) }))}
              required
            >
              <option value="">Posto credenciado</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <label>
              Data do abastecimento
              <input type="date" value={fuelForm.filled_at} onChange={(e) => setFuelForm((f) => ({ ...f, filled_at: e.target.value }))} required />
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="Litros"
              value={fuelForm.liters}
              onChange={(e) => setFuelForm((f) => ({ ...f, liters: e.target.value }))}
              required
            />
            <textarea placeholder="Observações" value={fuelForm.notes} onChange={(e) => setFuelForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            <label>
              Comprovante (foto)
              <input type="file" accept="image/*" onChange={(e) => setFuelForm((f) => ({ ...f, receipt_image: e.target.files?.[0] || null }))} />
            </label>
            <Button type="submit">Registrar abastecimento</Button>
          </form>
          <Table
            columns={[
              { key: "filled_at", label: "Data" },
              { key: "fuel_station", label: "Posto" },
              { key: "liters", label: "Litros" },
              { key: "vehicle__license_plate", label: "Veículo" },
              {
                key: "receipt_image",
                label: "Nota",
                render: (row) => (row.receipt_image ? <a href={row.receipt_image}>Ver imagem</a> : "—"),
              },
            ]}
            data={fuelLogs}
          />
        </div>
      </div>
      {showPassengersModal && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle} role="dialog" aria-modal="true">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "0.5rem" }}>
              <div>
                <h3 style={{ margin: 0 }}>Passageiros das viagens</h3>
                <p style={{ margin: 0, color: "var(--muted)" }}>Lista organizada pela data e horário de saída.</p>
              </div>
              <Button variant="ghost" onClick={() => setShowPassengersModal(false)}>
                Fechar
              </Button>
            </div>
            {passengerTrips.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: "0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  background: "#0b1422",
                  marginBottom: "0.75rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.5rem" }}>
                  <div>
                    <strong>Viagem #{t.id}</strong>
                    <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
                      {t.origin} → {t.destination}
                    </div>
                  </div>
                  <div style={{ color: "var(--accent)", fontWeight: 600, fontSize: "0.95rem" }}>
                    {new Date(t.departure_datetime).toLocaleString("pt-BR")}
                  </div>
                </div>
                <ul style={{ margin: 0, paddingLeft: "1rem", display: "grid", gap: "0.4rem" }}>
                  {t.passengers_details?.map((p, idx) => (
                    <li key={`${t.id}-${idx}`} style={{ listStyle: "disc" }}>
                      <div>
                        <strong>{p.name}</strong>
                        {p.age !== undefined && p.age !== null ? ` — ${p.age} anos` : ""}
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                        Necessidade especial: {p.special_need ? specialNeedLabel(p.special_need) : "Nenhuma"}
                        {p.special_need === "OTHER" && p.special_need_other ? ` (${p.special_need_other})` : ""}
                        {p.observation ? ` — Obs: ${p.observation}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      {incidentTrip && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: "620px" }} role="dialog" aria-modal="true">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "0.5rem" }}>
              <div>
                <h3 style={{ margin: 0 }}>Registrar ocorrência</h3>
                <p style={{ margin: 0, color: "var(--muted)" }}>
                  Viagem #{incidentTrip.id} — {incidentTrip.origin} → {incidentTrip.destination}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setIncidentTrip(null)}>
                Fechar
              </Button>
            </div>
            <form className="grid form-grid" onSubmit={handleSubmitIncident}>
              <textarea
                rows={4}
                placeholder="Descreva o ocorrido..."
                value={incidentText}
                onChange={(e) => {
                  setIncidentText(e.target.value);
                  setIncidentError(null);
                }}
              />
              {incidentError && <div className="error">{incidentError}</div>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <Button variant="ghost" type="button" onClick={() => setIncidentTrip(null)}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar relato</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
