import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, driverPortalApi } from "../../lib/api";
import { InstallPrompt } from "../../components/InstallPrompt";
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
  const navigate = useNavigate();
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
    setFuelForm((prev) =>
      prev.filled_at ? prev : { ...prev, filled_at: toInputDate(new Date()) }
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

  const getApiErrorMessage = (error: unknown, fallback: string) => {
    const err = error as { response?: { data?: any } };
    const data = err?.response?.data;
    if (!data) return fallback;
    if (typeof data === "string") return data;
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail)) return data.detail.join(" ");
    if (typeof data === "object") {
      for (const value of Object.values(data)) {
        if (typeof value === "string") return value;
        if (Array.isArray(value)) {
          const message = value.find((item) => typeof item === "string");
          if (message) return message;
        }
      }
    }
    return fallback;
  };

  const handleFuelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filledAt = fuelForm.filled_at || toInputDate(new Date());
    const fd = new FormData();
    fd.append("vehicle", String(fuelForm.vehicle));
    fd.append("fuel_station_id", String(fuelForm.fuel_station_id));
    fd.append("filled_at", filledAt);
    fd.append("liters", fuelForm.liters);
    fd.append("price_per_liter", fuelForm.price_per_liter);
    if (fuelForm.notes) fd.append("notes", fuelForm.notes);
    if (fuelForm.receipt_image) fd.append("receipt_image", fuelForm.receipt_image);
    try {
      await driverPortalApi.post("/drivers/portal/fuel_logs/", fd);
      setInfo("Abastecimento salvo!");
      loadPortalData();
      setActiveSection("home");
    } catch (e) { setError(getApiErrorMessage(e, "Erro ao salvar abastecimento.")); }
  };

  const handleInspectionSubmit = async (e: React.FormEvent, signatureDataUrl: string) => {
    e.preventDefault();
    if (!signatureDataUrl) {
      setError("Assinatura é obrigatória.");
      return;
    }
    const fd = new FormData();
    fd.append("vehicle", String(inspectionForm.vehicle));
    fd.append("inspection_date", inspectionForm.inspection_date);
    fd.append("signature_name", inspectionForm.signature_name);
    const signatureBlob = await (await fetch(signatureDataUrl)).blob();
    fd.append("signature_image", new File([signatureBlob], "signature.png", { type: "image/png" }));
    fd.append("checklist_items", JSON.stringify(inspectionChecklist));
    if (inspectionForm.odometer) fd.append("odometer", inspectionForm.odometer);
    if (inspectionForm.notes) fd.append("notes", inspectionForm.notes);
    try {
      await driverPortalApi.post("/drivers/portal/inspections/", fd);
      setInfo("Inspeção salva!");
      loadPortalData();
      setActiveSection("home");
    } catch (e) { setError(getApiErrorMessage(e, "Erro ao salvar inspeção.")); }
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
  const firstName = driverName?.split(" ")[0] || "Motorista";
  const todayLabel = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const activeTripLabel = activeTrip ? `${activeTrip.origin} → ${activeTrip.destination}` : "Sem viagem ativa";
  const handleSosClick = () => {
    if (!activeTrip) {
      setError("Sem viagem ativa para solicitar SOS.");
      return;
    }
    setIncidentError(null);
    setIncidentText("SOS - emergência.");
    setIncidentTrip(activeTrip);
    setShowPassengersModal(false);
  };
  const renderBottomNav = () => (
    <nav className="dp-bottom-nav">
      <button
        className={`dp-bottom-nav__item ${activeSection === "home" ? "dp-bottom-nav__item--active" : ""}`}
        onClick={() => setActiveSection("home")}
      >
        <span className="material-symbols-outlined">home</span>
        <span className="dp-bottom-nav__label">Início</span>
      </button>
      <button
        className={`dp-bottom-nav__item ${activeSection === "viagens" ? "dp-bottom-nav__item--active" : ""}`}
        onClick={() => setActiveSection("viagens")}
      >
        <span className="material-symbols-outlined">route</span>
        <span className="dp-bottom-nav__label">Viagens</span>
      </button>
      <button className="dp-bottom-nav__sos" aria-label="Emergência" onClick={handleSosClick}>
        <span className="material-symbols-outlined">emergency_home</span>
      </button>
      <button
        className={`dp-bottom-nav__item ${activeSection === "agenda" ? "dp-bottom-nav__item--active" : ""}`}
        onClick={() => setActiveSection("agenda")}
      >
        <span className="material-symbols-outlined">calendar_month</span>
        <span className="dp-bottom-nav__label">Escalas</span>
      </button>
      <button className="dp-bottom-nav__item" onClick={logout}>
        <span className="material-symbols-outlined">logout</span>
        <span className="dp-bottom-nav__label">Sair</span>
      </button>
    </nav>
  );

  // --- Login Screen ---
  if (!token) {
    return (
      <div className="driver-portal">
        <div className="dp-login-shell">
          <section className="dp-login-hero">
            <div className="dp-login-mark">
              <span className="material-symbols-outlined">local_shipping</span>
            </div>
            <p className="dp-chip">Operação municipal</p>
            <h1>Portal do Motorista</h1>
            <p className="dp-login-lead">
              Tudo o que você precisa para iniciar o turno, registrar viagens e manter o controle do veículo.
            </p>
          </section>
          <section className="dp-login-panel">
            <div className="dp-login-card">
              <div className="dp-login-card__header">
                <h2>Acesso rápido</h2>
                <p>Informe seu código para liberar o painel.</p>
              </div>
              <form className="dp-login-form" onSubmit={handleLogin}>
                <div className="dp-form-group">
                  <label className="dp-form-label" htmlFor="driver-code">Código de acesso</label>
                  <input
                    id="driver-code"
                    className="dp-input"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="C O D I G O"
                    required
                  />
                </div>
                <button type="submit" className="dp-btn dp-btn--primary" style={{ width: '100%', marginTop: '1rem' }}>
                  <span className="material-symbols-outlined">login</span>
                  Entrar no portal
                </button>
                {error && <div className="dp-alert dp-alert--error" style={{ marginTop: '1rem' }}>{error}</div>}
              </form>
              <button
                type="button"
                className="dp-btn dp-btn--ghost"
                style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }}
                onClick={() => navigate("/login")}
              >
                <span className="material-symbols-outlined">arrow_back</span>
                Voltar ao Login
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // --- Main Portal ---
  return (
    <>
      <InstallPrompt />
      <div className="driver-portal">


        {/* HOME VIEW */}
        {activeSection === "home" && (
          <>
            <div className="dp-shell">
              <header className="dp-header">
                <div className="dp-header__brand">
                  <p className="dp-chip">Portal do motorista</p>
                  <h1>Bem-vindo, {firstName}.</h1>
                  <p className="dp-header__lead">Seu painel de turno em tempo real.</p>
                </div>
              </header>

              {error && <div className="dp-alert dp-alert--error">{error}</div>}
              {info && <div className="dp-alert dp-alert--success">{info}</div>}

              <section className="dp-hero">
                <div className="dp-hero__main">
                  <p className="dp-chip" style={{ marginBottom: '1rem' }}>Viagem Atual</p>
                  {activeTrip ? (
                    <>
                      <h2>{activeTrip.origin} → {activeTrip.destination}</h2>
                      <p className="dp-hero__text">
                        Veículo {activeTrip.vehicle__license_plate}. Mantenha o acompanhamento e registre qualquer incidente.
                      </p>
                      <div className="dp-header__actions" style={{ display: 'flex', gap: '1rem' }}>
                        <button className="dp-btn dp-btn--primary" onClick={() => setActiveSection("viagens")}>
                          Ver detalhes
                        </button>
                        <button className="dp-btn dp-btn--ghost" onClick={() => setShowPassengersModal(true)}>
                          Passageiros
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h2>Nenhuma viagem ativa</h2>
                      <p className="dp-hero__text">Revise a agenda ou inicie uma viagem livre quando necessário.</p>
                      <div className="dp-header__actions" style={{ display: 'flex', gap: '1rem' }}>
                        <button className="dp-btn dp-btn--primary" onClick={() => setActiveSection("agenda")}>
                          Ver Escalas
                        </button>
                        <button className="dp-btn dp-btn--ghost" onClick={() => setActiveSection("viagem-livre")}>
                          Viagem Avulsa
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="dp-hero__side">
                  <div className="dp-status-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div className="dp-section-title" style={{ margin: 0 }}>GPS e Segurança</div>
                      <span className="dp-chip" style={{
                        background: trackingEnabled ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: trackingEnabled ? 'var(--dp-accent)' : 'var(--dp-danger)',
                        borderColor: trackingEnabled ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)'
                      }}>
                        {trackingEnabled ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <p className="dp-hero__text" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                      {todayLabel} · {trackingEnabled ? "Monitoramento em tempo real ativado." : "O rastreamento está desligado."}
                    </p>
                    <button
                      className={`dp-btn ${trackingEnabled ? 'dp-btn--ghost' : 'dp-btn--primary'}`}
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => setTrackingEnabled(!trackingEnabled)}
                    >
                      <span className="material-symbols-outlined">{trackingEnabled ? "location_off" : "location_on"}</span>
                      {trackingEnabled ? "Desativar GPS" : "Ativar GPS"}
                    </button>
                  </div>
                </div>
              </section>

              <section className="dp-actions-board">
                <div className="dp-section-title" style={{ marginBottom: '1.5rem' }}>Ações</div>
                <div className="dp-actions-grid">
                  <button className="dp-action-card" onClick={() => setActiveSection("viagens")}>
                    <span className="material-symbols-outlined">route</span>
                    <div>
                      <strong>Viagens</strong>
                      <span>{plannedTripsCount} planejada(s)</span>
                    </div>
                  </button>
                  <button className="dp-action-card" onClick={() => setActiveSection("agenda")}>
                    <span className="material-symbols-outlined">calendar_month</span>
                    <div>
                      <strong>Escalas</strong>
                      <span>{assignments.length} compromisso(s)</span>
                    </div>
                  </button>
                  <button className="dp-action-card" onClick={() => setActiveSection("abastecimento")}>
                    <span className="material-symbols-outlined">local_gas_station</span>
                    <div>
                      <strong>Combustível</strong>
                      <span>Registrar abastecimento</span>
                    </div>
                  </button>
                  <button className="dp-action-card" onClick={() => setActiveSection("inspecao")}>
                    <span className="material-symbols-outlined">fact_check</span>
                    <div>
                      <strong>Checklist</strong>
                      <span>Inspeção do veículo</span>
                    </div>
                  </button>
                </div>
              </section>

              <section className="dp-panel dp-glass-card">
                <div className="dp-section-title" style={{ marginBottom: '1rem' }}>Comunicados recentes</div>
                {notifications.length > 0 ? (
                  <div className="dp-updates" style={{ display: 'grid', gap: '1rem' }}>
                    {notifications.slice(0, 3).map((notif, idx) => (
                      <div key={idx} className="dp-update-item" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                        <div className="dp-update-item__icon" style={{ color: notif.event_type === 'success' ? 'var(--dp-accent)' : 'var(--dp-warning)' }}>
                          <span className="material-symbols-outlined">
                            {notif.event_type === "success" ? "check_circle" : "message"}
                          </span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontWeight: 600 }}>{notif.title}</p>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--dp-muted)' }}>{notif.message}</p>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--dp-muted)' }}>
                          {new Date(notif.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="dp-panel__empty">Sem novas atualizações.</p>
                )}
              </section>
            </div>
          </>
        )}

        {/* SUB-PAGES */}
        {activeSection !== "home" && (
          <>
            <div className="dp-shell">
              <header className="dp-header">
                <div className="dp-header__brand" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <button className="dp-btn dp-btn--ghost" style={{ padding: '0.5rem', borderRadius: '50%' }} onClick={() => setActiveSection("home")}>
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <div>
                    <p className="dp-chip">Portal do motorista</p>
                    <h2>
                      {activeSection === "viagens" && "Minhas viagens"}
                      {activeSection === "viagem-livre" && "Viagem Avulsa"}
                      {activeSection === "abastecimento" && "Combustível"}
                      {activeSection === "inspecao" && "Inspeção do veículo"}
                      {activeSection === "agenda" && "Minhas Escalas"}
                    </h2>
                  </div>
                </div>
              </header>

              <main className="dp-section-body fade-in">
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
            </div>
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
        {renderBottomNav()}
      </div>
    </>
  );
};
