import { useEffect, useMemo, useRef, useState } from "react";
import { api, driverPortalApi } from "../../lib/api";
import { Button } from "../../components/Button";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { InstallPrompt } from "../../components/InstallPrompt";
import "../../styles/login.css";
import "./DriverPortal.css";

import {
  TripPortal,
  AssignmentPortal,
  FuelLogPortal,
  FuelStation,
  InspectionPortal,
  DriverNotification,
  FreeTripListPortal,
  FreeTripPortal,
  PortalVehicle,
  AvailabilityBlockPortal,
  InspectionChecklistItem,
} from "./types";

import { CHECKLIST_ITEMS, toInputDate } from "./utils";

import { DriverSidebar } from "./components/DriverSidebar";
import { DriverHeader } from "./components/DriverHeader";
import { DriverTracking } from "./components/DriverTracking";
import { DriverSchedule } from "./components/DriverSchedule";
import { DriverFreeTrips } from "./components/DriverFreeTrips";
import { DriverTrips } from "./components/DriverTrips";
import { DriverAlerts } from "./components/DriverAlerts";
import { DriverInspection } from "./components/DriverInspection";
import { DriverFuel } from "./components/DriverFuel";
import { DriverIncidentModal } from "./components/DriverIncidentModal";
import { DriverPassengersModal } from "./components/DriverPassengersModal";

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
  const [inspections, setInspections] = useState<InspectionPortal[]>([]);
  const [notifications, setNotifications] = useState<DriverNotification[]>([]);
  const [fuelForm, setFuelForm] = useState<{
    vehicle: number | "";
    fuel_station_id: number | "";
    filled_at: string;
    liters: string;
    price_per_liter: string;
    notes: string;
    receipt_image: File | null;
  }>({
    vehicle: "",
    fuel_station_id: "",
    filled_at: "",
    liters: "",
    price_per_liter: "",
    notes: "",
    receipt_image: null,
  });
  const [inspectionChecklist, setInspectionChecklist] = useState<InspectionChecklistItem[]>(
    CHECKLIST_ITEMS.map((item) => ({ ...item, status: "OK", note: "" }))
  );
  const [inspectionForm, setInspectionForm] = useState<{
    vehicle: number | "";
    inspection_date: string;
    odometer: string;
    notes: string;
    signature_name: string;
    damage_photos: File[];
  }>({
    vehicle: "",
    inspection_date: "",
    odometer: "",
    notes: "",
    signature_name: "",
    damage_photos: [],
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

  useEffect(() => {
    setInspectionForm((prev) =>
      prev.inspection_date ? prev : { ...prev, inspection_date: toInputDate(new Date()) }
    );
  }, []);

  const availableVehicles = useMemo(() => {
    const uniques = new Map<number, string>();
    trips.forEach((t) => uniques.set(t.vehicle_id, t.vehicle__license_plate));
    assignments.forEach((a) => uniques.set(a.vehicle.id, a.vehicle.license_plate));
    return Array.from(uniques.entries()).map(([id, plate]) => ({ id, plate }));
  }, [assignments, trips]);

  const activeTrip = useMemo(() => trips.find((trip) => trip.status === "IN_PROGRESS") || null, [trips]);

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
        odometer_start: data.odometer_start != null ? String(data.odometer_start) : "",
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
      const accuracy = position.coords.accuracy;
      if (accuracy && accuracy > 1000) {
        setTrackingInfo("Sinal de GPS fraco. Aguardando melhor precisão...");
        return;
      }
      trackingLastSentAt.current = now;
      const payload = {
        trip_id: activeTrip.id,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy,
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
      maximumAge: 0,
      timeout: 20000,
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
      const inspectionsRes = await driverPortalApi.get<{ inspections: InspectionPortal[] }>("/drivers/portal/inspections/");
      setInspections(inspectionsRes.data.inspections);
      const notificationsRes = await driverPortalApi.get<{ notifications: DriverNotification[] }>("/drivers/portal/notifications/");
      setNotifications(notificationsRes.data.notifications);
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

  const handleStartTrip = async (tripId: number) => {
    setCompletingTripIds((ids) => (ids.includes(tripId) ? ids : [...ids, tripId]));
    try {
      await driverPortalApi.post(`/drivers/portal/trips/${tripId}/start/`);
      setTrips((prev) => prev.map((trip) => (trip.id === tripId ? { ...trip, status: "IN_PROGRESS" } : trip)));
      setInfo("Viagem iniciada.");
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Não foi possível iniciar a viagem.");
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
    if (!fuelForm.price_per_liter || Number(fuelForm.price_per_liter) <= 0) {
      setError("Informe o preço por litro (maior que zero).");
      return;
    }
    const fd = new FormData();
    fd.append("vehicle", String(fuelForm.vehicle));
    fd.append("fuel_station_id", String(fuelForm.fuel_station_id));
    fd.append("filled_at", fuelForm.filled_at);
    fd.append("liters", fuelForm.liters);
    fd.append("price_per_liter", fuelForm.price_per_liter);
    if (fuelForm.notes) fd.append("notes", fuelForm.notes);
    if (fuelForm.receipt_image) fd.append("receipt_image", fuelForm.receipt_image);
    try {
      await driverPortalApi.post("/drivers/portal/fuel_logs/", fd);
      setFuelForm({
        vehicle: fuelForm.vehicle,
        fuel_station_id: "",
        filled_at: "",
        liters: "",
        price_per_liter: "",
        notes: "",
        receipt_image: null,
      });
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

  const updateChecklistStatus = (key: string, status: "OK" | "ISSUE") => {
    setInspectionChecklist((prev) =>
      prev.map((item) => (item.key === key ? { ...item, status } : item))
    );
  };

  const updateChecklistNote = (key: string, note: string) => {
    setInspectionChecklist((prev) =>
      prev.map((item) => (item.key === key ? { ...item, note } : item))
    );
  };

  const handleInspectionSubmit = async (e: React.FormEvent, signatureDataUrl: string) => {
    e.preventDefault();
    if (!inspectionForm.vehicle) {
      setError("Selecione o veículo da inspeção.");
      return;
    }
    if (!inspectionForm.inspection_date) {
      setError("Informe a data da inspeção.");
      return;
    }
    if (!inspectionForm.signature_name.trim()) {
      setError("Informe seu nome na assinatura.");
      return;
    }
    if (!signatureDataUrl) {
      setError("Assine no campo indicado.");
      return;
    }
    const fd = new FormData();
    fd.append("vehicle", String(inspectionForm.vehicle));
    fd.append("inspection_date", inspectionForm.inspection_date);
    fd.append("signature_name", inspectionForm.signature_name);
    const signatureBlob = await (await fetch(signatureDataUrl)).blob();
    fd.append("signature_image", new File([signatureBlob], "signature.png", { type: "image/png" }));
    if (inspectionForm.odometer) fd.append("odometer", inspectionForm.odometer);
    if (inspectionForm.notes) fd.append("notes", inspectionForm.notes);
    fd.append("checklist_items", JSON.stringify(inspectionChecklist));
    inspectionForm.damage_photos.forEach((file) => fd.append("damage_photos", file));
    try {
      await driverPortalApi.post("/drivers/portal/inspections/", fd);
      setInspectionForm({
        vehicle: inspectionForm.vehicle,
        inspection_date: toInputDate(new Date()),
        odometer: "",
        notes: "",
        signature_name: "",
        damage_photos: [],
      });
      setInspectionChecklist(CHECKLIST_ITEMS.map((item) => ({ ...item, status: "OK", note: "" })));
      setInfo("Checklist diário registrado.");
      loadPortalData();
    } catch (err: any) {
      const data = err.response?.data;
      const firstError =
        data?.detail ||
        (data && typeof data === "object" ? Object.values(data as Record<string, any>).flat().find(Boolean) : null);
      setError(firstError || "Erro ao registrar checklist.");
    }
  };

  const logout = () => {
    localStorage.removeItem("driver_portal_token");
    setToken(null);
    setTrips([]);
    setAssignments([]);
    setFuelLogs([]);
    setInspections([]);
    setDriverName("");
    setIncidentTrip(null);
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

  return (
    <div className="driver-portal">
      <InstallPrompt />

      <DriverSidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <DriverHeader
        driverName={driverName}
        setSidebarOpen={setSidebarOpen}
        onLogout={logout}
      />

      <main className="driver-portal__main" ref={mainRef}>
        <DriverAlerts notifications={notifications} />

        <div className="driver-portal__alerts">
          {error && <div className="driver-portal__alert driver-portal__alert--error">{error}</div>}
          {info && <div className="driver-portal__alert driver-portal__alert--success">{info}</div>}
          {availabilityError && <div className="driver-portal__alert driver-portal__alert--error">{availabilityError}</div>}
        </div>

        {activeSection === "rastreamento" && (
          <DriverTracking
            trackingEnabled={trackingEnabled}
            setTrackingEnabled={setTrackingEnabled}
            trackingError={trackingError}
            trackingInfo={trackingInfo}
            trackingLastPing={trackingLastPing}
          />
        )}

        {activeSection === "agenda" && (
          <DriverSchedule
            assignments={assignments}
            availabilityBlocks={availabilityBlocks}
            loadAvailabilityBlocks={loadAvailabilityBlocks}
          />
        )}

        {activeSection === "viagem-livre" && (
          <DriverFreeTrips
            freeTrips={freeTrips}
            freeTripVehicles={freeTripVehicles}
            freeTripStart={freeTripStart}
            setFreeTripStart={setFreeTripStart}
            startFreeTrip={startFreeTrip}
            freeTripClose={freeTripClose}
            setFreeTripClose={setFreeTripClose}
            closeFreeTrip={closeFreeTrip}
            reportFreeTripIncident={reportFreeTripIncident}
            freeTripError={freeTripError}
            loadFreeTrips={loadFreeTrips}
            loadPortalVehicles={loadPortalVehicles}
          />
        )}

        {activeSection === "viagens" && (
          <DriverTrips
            trips={trips}
            handleStartTrip={handleStartTrip}
            handleCompleteTrip={handleCompleteTrip}
            openIncidentModal={openIncidentModal}
            setShowPassengersModal={setShowPassengersModal}
            completingTripIds={completingTripIds}
          />
        )}

        {activeSection === "inspecao" && (
          <DriverInspection
            inspections={inspections}
            inspectionForm={inspectionForm}
            setInspectionForm={setInspectionForm}
            inspectionChecklist={inspectionChecklist}
            updateChecklistStatus={updateChecklistStatus}
            updateChecklistNote={updateChecklistNote}
            handleInspectionSubmit={handleInspectionSubmit}
            availableVehicles={availableVehicles}
          />
        )}

        {activeSection === "abastecimento" && (
          <DriverFuel
            fuelLogs={fuelLogs}
            fuelForm={fuelForm}
            setFuelForm={setFuelForm}
            handleFuelSubmit={handleFuelSubmit}
            availableVehicles={availableVehicles}
            stations={stations}
          />
        )}
      </main>

      {/* Incident Modal */}
      <DriverIncidentModal
        trip={incidentTrip}
        text={incidentText}
        onTextChange={setIncidentText}
        error={incidentError}
        onClose={() => setIncidentTrip(null)}
        onSubmit={handleSubmitIncident}
      />

      {/* Passengers Modal */}
      <DriverPassengersModal
        isOpen={showPassengersModal}
        onClose={() => setShowPassengersModal(false)}
        trips={trips}
      />
    </div>
  );
};
