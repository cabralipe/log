import { useEffect, useMemo, useRef, useState } from "react";
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
        <span className="dp-bottom-nav__label">Agenda</span>
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
          <section className="dp-login-hero dp-reveal dp-reveal--1">
            <div className="dp-login-mark">
              <span className="material-symbols-outlined">local_shipping</span>
            </div>
            <p className="dp-chip">Operacao municipal</p>
            <h1>Portal do Motorista</h1>
            <p className="dp-login-lead">
              Tudo o que voce precisa para iniciar o turno, registrar viagens e manter o controle do veiculo.
            </p>
            <div className="dp-login-points">
              <div className="dp-login-point">
                <span className="material-symbols-outlined">route</span>
                <div>
                  <strong>Rotas organizadas</strong>
                  <span>Veja sua agenda e itinerario em segundos.</span>
                </div>
              </div>
              <div className="dp-login-point">
                <span className="material-symbols-outlined">fact_check</span>
                <div>
                  <strong>Checklist rapido</strong>
                  <span>Inspecao do veiculo antes da saida.</span>
                </div>
              </div>
              <div className="dp-login-point">
                <span className="material-symbols-outlined">bolt</span>
                <div>
                  <strong>Alertas e suporte</strong>
                  <span>Acione o SOS e registre incidentes.</span>
                </div>
              </div>
            </div>
          </section>
          <section className="dp-login-panel dp-reveal dp-reveal--2">
            <div className="dp-login-card">
              <div className="dp-login-card__header">
                <h2>Acesso rapido</h2>
                <p>Informe seu codigo para liberar o painel.</p>
              </div>
              <form className="dp-login-form" onSubmit={handleLogin}>
                <label className="dp-form-label" htmlFor="driver-code">Codigo de acesso</label>
                <input
                  id="driver-code"
                  className="dp-input dp-input--xl dp-input--code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="C O D I G O"
                  required
                />
                <button type="submit" className="dp-btn dp-btn--primary dp-btn--xl">
                  <span className="material-symbols-outlined">login</span>
                  Entrar no portal
                </button>
                {error && <div className="dp-alert dp-alert--error">{error}</div>}
              </form>
              <div className="dp-login-card__footer">
                <span className="material-symbols-outlined">shield_lock</span>
                <p>Se precisar de ajuda, contate a central de operacoes.</p>
              </div>
            </div>
          </section>
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
          <div className="dp-shell">
            <header className="dp-header dp-reveal dp-reveal--1">
              <div className="dp-header__brand">
                <p className="dp-chip">Portal do motorista</p>
                <h1>Bem-vindo, {firstName}.</h1>
                <p className="dp-header__lead">Seu painel do turno em tempo real, com foco nas tarefas que importam agora.</p>
                <div className="dp-header__actions">
                  <button className="dp-btn dp-btn--ghost" onClick={logout}>
                    <span className="material-symbols-outlined">logout</span>
                    Sair
                  </button>
                  <button className="dp-btn dp-btn--danger" onClick={handleSosClick}>
                    <span className="material-symbols-outlined">emergency_home</span>
                    SOS
                  </button>
                </div>
              </div>
              <div className="dp-header__meta">
                <div className="dp-meta-card">
                  <span>Data</span>
                  <strong>{todayLabel}</strong>
                  <small>Horario local</small>
                </div>
                <div className={`dp-meta-card ${activeTrip ? "dp-meta-card--active" : ""}`}>
                  <span>Status da rota</span>
                  <strong>{activeTrip ? "Viagem em andamento" : "Sem viagem ativa"}</strong>
                  <small>{activeTripLabel}</small>
                </div>
                <div className="dp-meta-card">
                  <span>GPS</span>
                  <strong>{trackingEnabled ? "Ativo" : "Desligado"}</strong>
                  <small>{trackingLastPing ? `Ultimo ping: ${trackingLastPing}` : "Sem envio recente"}</small>
                  <button className="dp-link" onClick={() => setTrackingEnabled(!trackingEnabled)}>
                    {trackingEnabled ? "Desativar GPS" : "Ativar GPS"}
                  </button>
                </div>
              </div>
            </header>

            {error && <div className="dp-alert dp-alert--error">{error}</div>}
            {info && <div className="dp-alert dp-alert--success">{info}</div>}

            <section className="dp-hero dp-reveal dp-reveal--2">
              <div className="dp-hero__main">
                <div className="dp-hero__eyebrow">
                  <span className="material-symbols-outlined">directions_bus</span>
                  Viagem em destaque
                </div>
                {activeTrip ? (
                  <>
                    <h2>{activeTrip.origin} → {activeTrip.destination}</h2>
                    <p className="dp-hero__text">
                      Veiculo {activeTrip.vehicle__license_plate}. Mantenha o acompanhamento e registre qualquer incidente.
                    </p>
                    <div className="dp-hero__actions">
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
                    <h2>Nenhuma viagem em andamento</h2>
                    <p className="dp-hero__text">Revise a agenda ou inicie uma viagem livre quando necessario.</p>
                    <div className="dp-hero__actions">
                      <button className="dp-btn dp-btn--primary" onClick={() => setActiveSection("agenda")}>
                        Ver agenda
                      </button>
                      <button className="dp-btn dp-btn--ghost" onClick={() => setActiveSection("viagem-livre")}>
                        Iniciar viagem livre
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="dp-hero__side">
                <div className="dp-status-card">
                  <div className="dp-status-card__title">GPS e seguranca</div>
                  <p className="dp-status-card__lead">{trackingEnabled ? "Monitoramento ativo." : "Monitoramento desligado."}</p>
                  {trackingInfo && <div className="dp-status-card__meta">{trackingInfo}</div>}
                  {trackingError && <div className="dp-status-card__meta">{trackingError}</div>}
                  <button className="dp-btn dp-btn--primary" onClick={() => setTrackingEnabled(!trackingEnabled)}>
                    {trackingEnabled ? "Desativar GPS" : "Ativar GPS"}
                  </button>
                </div>
                <div className="dp-status-card dp-status-card--accent">
                  <div className="dp-status-card__title">Resumo rapido</div>
                  <div className="dp-metric-list">
                    <div>
                      <span>Viagens planejadas</span>
                      <strong>{plannedTripsCount}</strong>
                    </div>
                    <div>
                      <span>Compromissos</span>
                      <strong>{assignments.length}</strong>
                    </div>
                    <div>
                      <span>Viagem livre</span>
                      <strong>{freeTrips?.open_trip ? "Ativa" : "Nao"}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="dp-actions-board dp-reveal dp-reveal--3">
              <div className="dp-actions-board__header">
                <h3>Acoes rapidas</h3>
                <p>Atalhos para as rotinas mais usadas.</p>
              </div>
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
                    <strong>Agenda</strong>
                    <span>{assignments.length} compromisso(s)</span>
                  </div>
                </button>
                <button className="dp-action-card" onClick={() => setActiveSection("abastecimento")}>
                  <span className="material-symbols-outlined">local_gas_station</span>
                  <div>
                    <strong>Abastecer</strong>
                    <span>Registrar combustivel</span>
                  </div>
                </button>
                <button className="dp-action-card" onClick={() => setActiveSection("inspecao")}>
                  <span className="material-symbols-outlined">fact_check</span>
                  <div>
                    <strong>Checklist</strong>
                    <span>Inspecao do veiculo</span>
                  </div>
                </button>
                <button className="dp-action-card" onClick={() => setActiveSection("viagem-livre")}>
                  <span className="material-symbols-outlined">add_task</span>
                  <div>
                    <strong>Viagem livre</strong>
                    <span>{freeTrips?.open_trip ? "Em andamento" : "Iniciar"}</span>
                  </div>
                </button>
              </div>
            </section>

            <section className="dp-split dp-reveal dp-reveal--4">
              <div className="dp-panel">
                <div className="dp-panel__header">
                  <h3>Indicadores do turno</h3>
                  <p>O que esta acontecendo agora.</p>
                </div>
                <div className="dp-kpi-grid">
                  <div className="dp-kpi-card">
                    <span>Viagens planejadas</span>
                    <strong>{plannedTripsCount}</strong>
                  </div>
                  <div className="dp-kpi-card">
                    <span>Escalas na agenda</span>
                    <strong>{assignments.length}</strong>
                  </div>
                  <div className="dp-kpi-card">
                    <span>Viagem livre</span>
                    <strong>{freeTrips?.open_trip ? "Ativa" : "Nao"}</strong>
                  </div>
                </div>
              </div>
              <div className="dp-panel">
                <div className="dp-panel__header">
                  <h3>Comunicados recentes</h3>
                  <p>Atualizacoes das ultimas horas.</p>
                </div>
                {notifications.length > 0 ? (
                  <div className="dp-updates">
                    {notifications.slice(0, 3).map((notif, idx) => (
                      <div key={idx} className="dp-update-item">
                        <div className={`dp-update-item__icon ${notif.type === "success" ? "dp-update-item__icon--success" : ""}`}>
                          <span className="material-symbols-outlined">
                            {notif.type === "success" ? "check_circle" : "message"}
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
                ) : (
                  <p className="dp-panel__empty">Sem novas atualizacoes.</p>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      {/* SUB-PAGES */}
      {activeSection !== "home" && (
        <>
          <div className="dp-shell">
            <header className="dp-section-head dp-reveal dp-reveal--1">
              <button className="dp-back" onClick={() => setActiveSection("home")}>
                <span className="material-symbols-outlined">chevron_left</span>
                Inicio
              </button>
              <div className="dp-section-head__title">
                <p className="dp-chip">Portal do motorista</p>
                <h2>
                  {activeSection === "viagens" && "Minhas viagens"}
                  {activeSection === "viagem-livre" && "Viagem livre"}
                  {activeSection === "abastecimento" && "Abastecer"}
                  {activeSection === "inspecao" && "Inspecao do veiculo"}
                  {activeSection === "agenda" && "Minha agenda"}
                </h2>
                <p>Gestao rapida para o turno de hoje.</p>
              </div>
              <div className="dp-section-head__actions">
                <button className="dp-btn dp-btn--ghost" onClick={logout}>
                  <span className="material-symbols-outlined">logout</span>
                  Sair
                </button>
                <button className="dp-btn dp-btn--danger" onClick={handleSosClick}>
                  <span className="material-symbols-outlined">emergency_home</span>
                  SOS
                </button>
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
  );
};
