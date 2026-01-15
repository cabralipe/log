import { useEffect, useMemo, useRef, useState } from "react";
import { api, driverPortalApi } from "../../lib/api";
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
  PortalVehicle,
  AvailabilityBlockPortal,
  InspectionChecklistItem,
} from "./types";

import { CHECKLIST_ITEMS, toInputDate } from "./utils";

// Sub-components will be refactored progressively
import { DriverTrips } from "./components/DriverTrips";
import { DriverFreeTrips } from "./components/DriverFreeTrips";
import { DriverFuel } from "./components/DriverFuel";
import { DriverInspection } from "./components/DriverInspection";
import { DriverSchedule } from "./components/DriverSchedule";
import { DriverIncidentModal } from "./components/DriverIncidentModal";
import { DriverPassengersModal } from "./components/DriverPassengersModal";

export const DriverPortalPage = () => {
  const [activeSection, setActiveSection] = useState("home");
  const [code, setCode] = useState("");
  const [token, setToken] = useState<string | null>(localStorage.getItem("driver_portal_token"));
  const [driverName, setDriverName] = useState<string>("");

  // Data States
  const [trips, setTrips] = useState<TripPortal[]>([]);
  const [assignments, setAssignments] = useState<AssignmentPortal[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLogPortal[]>([]);
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [inspections, setInspections] = useState<InspectionPortal[]>([]);
  const [notifications, setNotifications] = useState<DriverNotification[]>([]);

  // Forms & UI States
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [completingTripIds, setCompletingTripIds] = useState<number[]>([]);
  const [showPassengersModal, setShowPassengersModal] = useState(false);
  const [incidentTrip, setIncidentTrip] = useState<TripPortal | null>(null);
  const [incidentText, setIncidentText] = useState("");
  const [incidentError, setIncidentError] = useState<string | null>(null);

  // Free Trip
  const [freeTrips, setFreeTrips] = useState<FreeTripListPortal | null>(null);
  const [freeTripError, setFreeTripError] = useState<string | null>(null);
  const [freeTripVehicles, setFreeTripVehicles] = useState<PortalVehicle[]>([]);
  const [freeTripStart, setFreeTripStart] = useState<{ vehicle_id: number | ""; odometer_start: string; photo: File | null }>({
    vehicle_id: "", odometer_start: "", photo: null,
  });
  const [freeTripClose, setFreeTripClose] = useState<{ odometer_end: string; photo: File | null; incident: string }>({
    odometer_end: "", photo: null, incident: "",
  });

  // Fuel Form
  const [fuelForm, setFuelForm] = useState<{
    vehicle: number | "";
    fuel_station_id: number | "";
    filled_at: string;
    liters: string;
    price_per_liter: string;
    notes: string;
    receipt_image: File | null;
  }>({
    vehicle: "", fuel_station_id: "", filled_at: "", liters: "", price_per_liter: "", notes: "", receipt_image: null,
  });

  // Inspection Form
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
    vehicle: "", inspection_date: "", odometer: "", notes: "", signature_name: "", damage_photos: [],
  });

  // Schedule
  const [availabilityBlocks, setAvailabilityBlocks] = useState<AvailabilityBlockPortal[]>([]);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  // Tracking
  const [trackingEnabled, setTrackingEnabled] = useState<boolean>(
    localStorage.getItem("driver_tracking_enabled") === "true"
  );
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [trackingInfo, setTrackingInfo] = useState<string | null>(null);
  const [trackingLastPing, setTrackingLastPing] = useState<string | null>(null);
  const trackingWatchId = useRef<number | null>(null);
  const trackingLastSentAt = useRef<number>(0);

  // --- Effects ---
  useEffect(() => {
    setInspectionForm((prev) =>
      prev.inspection_date ? prev : { ...prev, inspection_date: toInputDate(new Date()) }
    );
  }, []);

  useEffect(() => {
    if (token) loadPortalData();
  }, [token]);

  useEffect(() => {
    localStorage.setItem("driver_tracking_enabled", trackingEnabled ? "true" : "false");
  }, [trackingEnabled]);

  // Tracking Logic
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
      setTrackingError("GPS não disponível.");
      setTrackingEnabled(false);
      return;
    }
    const onSuccess = async (position: GeolocationPosition) => {
      const now = Date.now();
      if (now - trackingLastSentAt.current < 12000) return;
      const activeTrip = trips.find((trip) => trip.status === "IN_PROGRESS");
      if (!activeTrip) { setTrackingError("Sem viagem ativa."); return; }

      trackingLastSentAt.current = now;
      try {
        await driverPortalApi.post("/drivers/portal/gps/ping/", {
          trip_id: activeTrip.id,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          recorded_at: new Date(position.timestamp).toISOString(),
        });
        setTrackingError(null);
        setTrackingInfo("GPS Ativo.");
        setTrackingLastPing(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      } catch (err) { /* ignore */ }
    };
    const onError = () => { setTrackingError("Erro no GPS."); setTrackingEnabled(false); };
    trackingWatchId.current = navigator.geolocation.watchPosition(onSuccess, onError, { enableHighAccuracy: true, timeout: 20000 });
    return () => { if (trackingWatchId.current) navigator.geolocation.clearWatch(trackingWatchId.current); };
  }, [trackingEnabled, token, trips]);

  // --- Actions ---
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
      setError("Código inválido.");
    }
  };

  const logout = () => {
    localStorage.removeItem("driver_portal_token");
    setToken(null);
    setActiveSection("home");
  };

  const loadPortalData = async () => {
    try {
      const [tripsRes, assignRes, fuelRes, stRes, inspRes, notifRes] = await Promise.all([
        driverPortalApi.get("/drivers/portal/trips/"),
        driverPortalApi.get("/drivers/portal/assignments/"),
        driverPortalApi.get("/drivers/portal/fuel_logs/"),
        driverPortalApi.get("/drivers/portal/fuel_stations/"),
        driverPortalApi.get("/drivers/portal/inspections/"),
        driverPortalApi.get("/drivers/portal/notifications/"),
      ]);

      setDriverName((tripsRes.data as any).driver);
      setTrips((tripsRes.data as any).trips);
      setAssignments((assignRes.data as any).assignments || []);
      setFuelLogs((fuelRes.data as any).logs);
      setStations((stRes.data as any).stations);
      setInspections((inspRes.data as any).inspections);
      setNotifications((notifRes.data as any).notifications);

      await loadFreeTrips();
      await loadPortalVehicles();
      await loadAvailabilityBlocks();
      setError(null);
    } catch (err) {
      setError("Sessão expirada.");
      logout();
    }
  };

  const availableVehicles = useMemo(() => {
    const uniques = new Map<number, string>();
    trips.forEach((t) => uniques.set(t.vehicle_id, t.vehicle__license_plate));
    assignments.forEach((a) => uniques.set(a.vehicle.id, a.vehicle.license_plate));
    return Array.from(uniques.entries()).map(([id, plate]) => ({ id, plate }));
  }, [assignments, trips]);

  const loadFreeTrips = async () => {
    try {
      const { data } = await driverPortalApi.get<FreeTripListPortal>("/drivers/portal/free_trips/");
      setFreeTrips(data);
    } catch (e) { }
  };
  const loadPortalVehicles = async () => {
    try {
      const { data } = await driverPortalApi.get<{ vehicles: PortalVehicle[] }>("/drivers/portal/vehicles/");
      setFreeTripVehicles(data.vehicles);
    } catch (e) { }
  };
  const loadAvailabilityBlocks = async () => {
    try {
      const { data } = await driverPortalApi.get<{ blocks: AvailabilityBlockPortal[] }>("/drivers/portal/availability-blocks/");
      setAvailabilityBlocks(data.blocks || []);
    } catch (e) { }
  };

  // Trip handlers
  const handleStartTrip = async (id: number) => {
    try { await driverPortalApi.post(`/drivers/portal/trips/${id}/start/`); loadPortalData(); } catch (e) { setError("Erro ao iniciar."); }
  };
  const handleCompleteTrip = async (id: number) => {
    try { await driverPortalApi.post(`/drivers/portal/trips/${id}/complete/`); loadPortalData(); } catch (e) { setError("Erro ao finalizar."); }
  };
  const openIncidentModal = (trip: TripPortal) => { setIncidentTrip(trip); setIncidentText(""); setShowPassengersModal(false); };
  const handleSubmitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentTrip) return;
    try { await driverPortalApi.post(`/drivers/portal/trips/${incidentTrip.id}/incidents/`, { description: incidentText }); setIncidentTrip(null); loadPortalData(); setInfo("Ocorrência enviada."); } catch (e) { setIncidentError("Erro ao enviar."); }
  };

  // Checklist handlers
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

  const handleFuelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setInfo("Abastecimento salvo!");
      loadPortalData();
      setActiveSection("home");
    } catch (e) { setError("Erro ao salvar abastecimento."); }
  };

  const handleInspectionSubmit = async (e: React.FormEvent, signatureDataUrl: string) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("vehicle", String(inspectionForm.vehicle));
    fd.append("inspection_date", inspectionForm.inspection_date);
    fd.append("signature_name", inspectionForm.signature_name);
    const signatureBlob = await (await fetch(signatureDataUrl)).blob();
    fd.append("signature_image", new File([signatureBlob], "signature.png", { type: "image/png" }));
    fd.append("checklist_items", JSON.stringify(inspectionChecklist));
    try {
      await driverPortalApi.post("/drivers/portal/inspections/", fd);
      setInfo("Inspeção salva!");
      loadPortalData();
      setActiveSection("home");
    } catch (e) { setError("Erro ao salvar inspeção."); }
  };

  const startFreeTrip = async () => {
    try {
      const fd = new FormData();
      fd.append("vehicle_id", String(freeTripStart.vehicle_id));
      if (freeTripStart.photo) fd.append("odometer_start_photo", freeTripStart.photo);
      await driverPortalApi.post("/drivers/portal/free_trips/start/", fd);
      loadFreeTrips();
    } catch (e) { setFreeTripError("Erro ao iniciar."); }
  };
  const closeFreeTrip = async () => {
    if (!freeTrips?.open_trip) return;
    try {
      const fd = new FormData();
      fd.append("odometer_end", freeTripClose.odometer_end);
      if (freeTripClose.photo) fd.append("odometer_end_photo", freeTripClose.photo);
      await driverPortalApi.post(`/drivers/portal/free_trips/${freeTrips.open_trip.id}/close/`, fd);
      loadFreeTrips();
    } catch (e) { setFreeTripError("Erro ao encerrar."); }
  };
  const reportFreeTripIncident = async () => {
    if (!freeTrips?.open_trip) return;
    try {
      await driverPortalApi.post(`/drivers/portal/free_trips/${freeTrips.open_trip.id}/incidents/`, { description: freeTripClose.incident });
      loadFreeTrips();
    } catch (e) { setFreeTripError("Erro ao reportar."); }
  };

  // Computed values
  const activeTrip = trips.find(t => t.status === "IN_PROGRESS");
  const plannedTripsCount = trips.filter(t => t.status === "PLANNED").length;

  // --- Login Screen ---
  if (!token) {
    return (
      <div className="driver-portal" style={{ justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
        <div className="dp-glass-card" style={{ maxWidth: '400px', width: '100%' }}>
          <div className="dp-glass-card__body" style={{ textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '4rem', color: 'var(--dp-primary)', marginBottom: '1rem' }}>local_shipping</span>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Portal do Motorista</h1>
            <p style={{ color: 'var(--dp-text-muted)', marginBottom: '2rem' }}>Digite seu código de acesso</p>
            <form onSubmit={handleLogin}>
              <input
                className="dp-input dp-input--large"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="CÓDIGO"
                required
                style={{ marginBottom: '1rem', letterSpacing: '0.2em' }}
              />
              <button type="submit" className="dp-btn dp-btn--primary dp-btn--xl">
                <span className="material-symbols-outlined">login</span>
                ENTRAR
              </button>
              {error && <div className="dp-alert dp-alert--error" style={{ marginTop: '1rem' }}>{error}</div>}
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Portal ---
  return (
    <div className="driver-portal">
      <InstallPrompt />

      {/* HOME VIEW */}
      {activeSection === "home" && (
        <>
          {/* Header */}
          <header className="dp-header">
            <div className="dp-header__profile">
              <div className="dp-header__avatar">
                <span className="material-symbols-outlined">account_circle</span>
              </div>
              <div className="dp-header__info">
                <span className="dp-header__welcome">Bem-vindo</span>
                <h2 className="dp-header__name">Olá, {driverName?.split(" ")[0] || "Motorista"}</h2>
              </div>
            </div>
            <button className="dp-header__btn" onClick={logout}>
              <span className="material-symbols-outlined">logout</span>
            </button>
          </header>

          <main className="driver-portal__main">
            {/* Alerts */}
            {error && <div className="dp-alert dp-alert--error">{error}</div>}
            {info && <div className="dp-alert dp-alert--success">{info}</div>}

            {/* Active Trip Banner */}
            {activeTrip && (
              <div className="dp-status-banner fade-in">
                <div className="dp-status-banner__header">
                  <div>
                    <div className="dp-status-banner__indicator">
                      <div className="dp-status-banner__pulse"></div>
                      <span className="dp-status-banner__status-text">Status: Ativo</span>
                    </div>
                    <h3 className="dp-status-banner__title">Viagem em curso</h3>
                    <p className="dp-status-banner__subtitle">{activeTrip.origin} → {activeTrip.destination}</p>
                  </div>
                  <div className="dp-status-banner__icon">
                    <span className="material-symbols-outlined">local_shipping</span>
                  </div>
                </div>
                <div className="dp-status-banner__footer">
                  <div>
                    <span className="dp-status-banner__meta-label">Veículo</span>
                    <span className="dp-status-banner__meta-value">{activeTrip.vehicle__license_plate}</span>
                  </div>
                  <button className="dp-status-banner__action" onClick={() => setActiveSection("viagens")}>
                    DETALHES
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}

            {/* Action Grid */}
            <h3 className="dp-section-title">Ações Principais</h3>
            <div className="dp-action-grid fade-in">
              <button className="dp-action-card" onClick={() => setActiveSection("viagens")}>
                <div className="dp-action-card__icon dp-action-card__icon--blue">
                  <span className="material-symbols-outlined">route</span>
                </div>
                <span className="dp-action-card__label">Viagens</span>
                {plannedTripsCount > 0 && (
                  <span className="dp-action-card__badge dp-action-card__badge--count">{plannedTripsCount}</span>
                )}
              </button>

              <button className="dp-action-card" onClick={() => setActiveSection("viagem-livre")}>
                <div className="dp-action-card__icon dp-action-card__icon--green">
                  <span className="material-symbols-outlined">add_task</span>
                </div>
                <span className="dp-action-card__label">Viagem Livre</span>
                {freeTrips?.open_trip && (
                  <span className="dp-action-card__badge dp-action-card__badge--new">ATIVA</span>
                )}
              </button>

              <button className="dp-action-card" onClick={() => setActiveSection("abastecimento")}>
                <div className="dp-action-card__icon dp-action-card__icon--orange">
                  <span className="material-symbols-outlined">local_gas_station</span>
                </div>
                <span className="dp-action-card__label">Abastecer</span>
              </button>

              <button className="dp-action-card" onClick={() => setActiveSection("inspecao")}>
                <div className="dp-action-card__icon dp-action-card__icon--yellow">
                  <span className="material-symbols-outlined">fact_check</span>
                </div>
                <span className="dp-action-card__label">Checklist</span>
              </button>

              <button className="dp-action-card" onClick={() => setActiveSection("agenda")}>
                <div className="dp-action-card__icon dp-action-card__icon--purple">
                  <span className="material-symbols-outlined">calendar_month</span>
                </div>
                <span className="dp-action-card__label">Escala</span>
                {assignments.length > 0 && (
                  <span className="dp-action-card__badge dp-action-card__badge--count">{assignments.length}</span>
                )}
              </button>

              <button
                className="dp-action-card"
                onClick={() => setTrackingEnabled(!trackingEnabled)}
              >
                <div className={`dp-action-card__icon ${trackingEnabled ? 'dp-action-card__icon--green' : 'dp-action-card__icon--cyan'}`}>
                  <span className="material-symbols-outlined">{trackingEnabled ? 'gps_fixed' : 'explore'}</span>
                </div>
                <span className="dp-action-card__label">{trackingEnabled ? 'GPS Ativo' : 'GPS'}</span>
              </button>
            </div>

            {/* Recent Updates */}
            {notifications.length > 0 && (
              <>
                <h3 className="dp-section-title">Atualizações Recentes</h3>
                <div className="dp-updates fade-in">
                  {notifications.slice(0, 3).map((notif, idx) => (
                    <div key={idx} className="dp-update-item">
                      <div className={`dp-update-item__icon dp-update-item__icon--${notif.type === 'success' ? 'success' : 'primary'}`}>
                        <span className="material-symbols-outlined">
                          {notif.type === 'success' ? 'check_circle' : 'message'}
                        </span>
                      </div>
                      <div className="dp-update-item__content">
                        <p className="dp-update-item__title">{notif.title}</p>
                        <p className="dp-update-item__desc">{notif.message}</p>
                      </div>
                      <span className="dp-update-item__time">
                        {new Date(notif.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </main>

          {/* Bottom Navigation */}
          <nav className="dp-bottom-nav">
            <button className="dp-bottom-nav__item dp-bottom-nav__item--active">
              <span className="material-symbols-outlined">home</span>
              <span className="dp-bottom-nav__label">Início</span>
            </button>
            <button className="dp-bottom-nav__item" onClick={() => setActiveSection("viagens")}>
              <span className="material-symbols-outlined">directions_bus</span>
              <span className="dp-bottom-nav__label">Viagens</span>
            </button>
            <button className="dp-bottom-nav__sos">
              <span className="material-symbols-outlined">emergency_home</span>
            </button>
            <button className="dp-bottom-nav__item" onClick={() => setActiveSection("agenda")}>
              <span className="material-symbols-outlined">history</span>
              <span className="dp-bottom-nav__label">Histórico</span>
            </button>
            <button className="dp-bottom-nav__item" onClick={logout}>
              <span className="material-symbols-outlined">account_circle</span>
              <span className="dp-bottom-nav__label">Perfil</span>
            </button>
          </nav>
        </>
      )}

      {/* SUB-PAGES */}
      {activeSection !== "home" && (
        <>
          {/* Sub-page Header */}
          <header className="dp-subheader">
            <button className="dp-subheader__back" onClick={() => setActiveSection("home")}>
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <h2 className="dp-subheader__title">
              {activeSection === "viagens" && "Minhas Viagens"}
              {activeSection === "viagem-livre" && "Viagem Livre"}
              {activeSection === "abastecimento" && "Abastecer"}
              {activeSection === "inspecao" && "Inspeção"}
              {activeSection === "agenda" && "Minha Agenda"}
            </h2>
            <div className="dp-subheader__spacer"></div>
          </header>

          <main className="driver-portal__main fade-in">
            {/* Alerts */}
            {error && <div className="dp-alert dp-alert--error">{error}</div>}
            {info && <div className="dp-alert dp-alert--success">{info}</div>}

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

            {activeSection === "agenda" && (
              <DriverSchedule
                assignments={assignments}
                availabilityBlocks={availabilityBlocks}
                loadAvailabilityBlocks={loadAvailabilityBlocks}
              />
            )}
          </main>
        </>
      )}

      {/* Modals */}
      <DriverIncidentModal
        trip={incidentTrip}
        text={incidentText}
        onTextChange={setIncidentText}
        error={incidentError}
        onClose={() => setIncidentTrip(null)}
        onSubmit={handleSubmitIncident}
      />
      <DriverPassengersModal
        isOpen={showPassengersModal}
        onClose={() => setShowPassengersModal(false)}
        trips={trips}
      />
    </div>
  );
};
