import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Paginated } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { Pagination } from "../components/Pagination";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { Modal } from "../components/Modal";
import "../styles/DataPage.css";
import "./Trips.css";

// Types
type PlannedTrip = {
  id: number;
  title: string;
  module: "EDUCATION" | "HEALTH" | "OTHER";
  recurrence: "NONE" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
  start_date: string;
  end_date?: string;
  departure_time: string;
  return_time_expected: string;
  active: boolean;
  notes?: string;
};

type TripExecution = {
  id: number;
  planned_trip?: number;
  planned_trip_title?: string;
  module: string;
  vehicle?: number;
  vehicle_plate?: string;
  driver?: number;
  driver_name?: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  scheduled_departure: string;
  scheduled_return: string;
  actual_departure?: string;
  actual_return?: string;
};

type Trip = {
  id: number;
  origin: string;
  destination: string;
  departure_datetime: string;
  return_datetime_expected: string;
  vehicle: number;
  vehicle_plate?: string;
  driver: number;
  driver_name?: string;
  service_order?: number;
  service_order_external_id?: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  category: "PASSENGER" | "OBJECT" | "MIXED";
  passengers_count: number;
  notes?: string;
};

type ServiceOrder = { id: number; external_id: string };
type Vehicle = { id: number; license_plate: string };
type Driver = { id: number; name: string };

export const TripsPage = () => {
  const navigate = useNavigate();
  const { isMobile } = useMediaQuery();
  const [activeTab, setActiveTab] = useState<"PLANNING" | "EXECUTION" | "ADHOC">("EXECUTION");

  // State for Planning
  const [plans, setPlans] = useState<PlannedTrip[]>([]);
  const [totalPlans, setTotalPlans] = useState(0);
  const [pagePlans, setPagePlans] = useState(1);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // State for Execution
  const [executions, setExecutions] = useState<TripExecution[]>([]);
  const [totalExecutions, setTotalExecutions] = useState(0);
  const [pageExecutions, setPageExecutions] = useState(1);
  const [loadingExecutions, setLoadingExecutions] = useState(false);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);

  // State for Ad-hoc Trips
  const [trips, setTrips] = useState<Trip[]>([]);
  const [totalTrips, setTotalTrips] = useState(0);
  const [pageTrips, setPageTrips] = useState(1);
  const [loadingTrips, setLoadingTrips] = useState(false);

  // Modals
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planForm, setPlanForm] = useState<Partial<PlannedTrip>>({
    module: "OTHER",
    recurrence: "NONE",
    active: true,
  });

  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [tripForm, setTripForm] = useState<Partial<Trip>>({
    status: "PLANNED",
    category: "PASSENGER",
  });

  // Resources
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);

  useEffect(() => {
    // Load resources when needed (could optimize to load only on modal open)
    api.get("/vehicles/vehicles/", { params: { page_size: 1000 } }).then(res => setVehicles((res.data as any).results || res.data));
    api.get("/drivers/drivers/", { params: { page_size: 1000 } }).then(res => setDrivers((res.data as any).results || res.data));
    api.get("/trips/service-orders/", { params: { page_size: 1000 } }).then(res => setServiceOrders((res.data as any).results || res.data));
  }, []);

  const moduleLabels: Record<string, string> = {
    EDUCATION: "Educação",
    HEALTH: "Saúde",
    OTHER: "Outro",
  };

  const recurrenceLabels: Record<string, string> = {
    NONE: "Única",
    WEEKLY: "Semanal",
    MONTHLY: "Mensal",
    QUARTERLY: "Trimestral",
    YEARLY: "Anual",
  };

  // Loaders
  const loadPlans = (page = pagePlans) => {
    setLoadingPlans(true);
    api.get<Paginated<PlannedTrip>>("/trips/planned-trips/", { params: { page, page_size: 10 } })
      .then(res => {
        const data = res.data as any;
        setPlans(Array.isArray(data) ? data : data.results);
        setTotalPlans(Array.isArray(data) ? data.length : data.count);
      })
      .finally(() => setLoadingPlans(false));
  };

  const loadExecutions = (page = pageExecutions, date = dateFilter) => {
    setLoadingExecutions(true);
    const params: any = { page, page_size: 10 };
    if (date) params.scheduled_departure__date = date;
    api.get<Paginated<TripExecution>>("/trips/executions/", { params })
      .then(res => {
        const data = res.data as any;
        setExecutions(Array.isArray(data) ? data : data.results);
        setTotalExecutions(Array.isArray(data) ? data.length : data.count);
      })
      .finally(() => setLoadingExecutions(false));
  };

  const loadTrips = (page = pageTrips) => {
    setLoadingTrips(true);
    api.get<Paginated<Trip>>("/trips/trips/", { params: { page, page_size: 10 } })
      .then(res => {
        const data = res.data as any;
        setTrips(Array.isArray(data) ? data : data.results);
        setTotalTrips(Array.isArray(data) ? data.length : data.count);
      })
      .finally(() => setLoadingTrips(false));
  };

  useEffect(() => {
    if (activeTab === "PLANNING") loadPlans();
    else if (activeTab === "EXECUTION") loadExecutions();
    else loadTrips();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (planForm.id) await api.patch(`/trips/planned-trips/${planForm.id}/`, planForm);
      else await api.post("/trips/planned-trips/", planForm);
      setIsPlanModalOpen(false);
      loadPlans();
    } catch (err) { alert("Erro ao salvar planejamento."); }
  };

  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (tripForm.id) await api.patch(`/trips/trips/${tripForm.id}/`, tripForm);
      else await api.post("/trips/trips/", tripForm);
      setIsTripModalOpen(false);
      loadTrips();
    } catch (err) { alert("Erro ao salvar viagem avulsa."); }
  };

  const openPlanModal = (plan?: PlannedTrip) => {
    setPlanForm(plan || { module: "OTHER", recurrence: "NONE", active: true });
    setIsPlanModalOpen(true);
  };

  const openTripModal = (trip?: Trip) => {
    setTripForm(trip || { status: "PLANNED", category: "PASSENGER" });
    setIsTripModalOpen(true);
  };

  return (
    <div className="data-page">
      <div className="data-header">
        <div>
          <h1 className="data-title">Gestão de Viagens</h1>
          <p className="data-subtitle">Planejamento e controle de execução.</p>
        </div>
        <div className="trips-tabs">
          <button className={activeTab === "EXECUTION" ? "active" : ""} onClick={() => setActiveTab("EXECUTION")}>Execução (Diário)</button>
          <button className={activeTab === "PLANNING" ? "active" : ""} onClick={() => setActiveTab("PLANNING")}>Planejamento</button>
          <button className={activeTab === "ADHOC" ? "active" : ""} onClick={() => setActiveTab("ADHOC")}>Avulsas</button>
        </div>
      </div>

      {activeTab === "PLANNING" && (
        <>
          <div className="data-actions-bar" style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={() => openPlanModal()}>+ Novo Planejamento</Button>
          </div>
          {loadingPlans ? <div className="data-loading">Carregando...</div> : (
            <>
              <Table
                columns={[
                  { label: "Título", key: "title" },
                  { label: "Módulo", key: "module", render: (d) => moduleLabels[d.module] || d.module },
                  { label: "Recorrência", key: "recurrence", render: (d) => recurrenceLabels[d.recurrence] || d.recurrence },
                  { label: "Saída", key: "departure_time" },
                  { label: "Retorno", key: "return_time_expected" },
                  { label: "Status", key: "active", render: (d) => <StatusBadge status={d.active ? "ACTIVE" : "INACTIVE"} /> },
                  { label: "Ações", key: "actions", render: (d) => <Button variant="ghost" size="sm" onClick={() => openPlanModal(d)}>Editar</Button> }
                ]}
                data={plans}
              />
              <Pagination page={pagePlans} pageSize={10} total={totalPlans} onChange={(p) => { setPagePlans(p); loadPlans(p); }} />
            </>
          )}
        </>
      )}

      {activeTab === "EXECUTION" && (
        <>
          <div className="data-filters">
            <input type="date" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPageExecutions(1); loadExecutions(1, e.target.value); }} className="data-search" />
          </div>
          {loadingExecutions ? <div className="data-loading">Carregando...</div> : (
            <>
              <Table
                columns={[
                  { label: "ID", key: "id" },
                  { label: "Planejamento", key: "planned_trip_title", render: (d) => d.planned_trip_title || "Avulsa" },
                  { label: "Saída", key: "scheduled_departure", render: (d) => new Date(d.scheduled_departure).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' }) },
                  { label: "Veículo", key: "vehicle_plate", render: (d) => d.vehicle_plate || "—" },
                  { label: "Motorista", key: "driver_name", render: (d) => d.driver_name || "—" },
                  { label: "Status", key: "status", render: (d) => <StatusBadge status={d.status} /> },
                  { label: "Ações", key: "actions", render: (d) => <div className="data-actions"><Button variant="ghost" size="sm" onClick={() => navigate(`/trips/manifest/${d.id}`)}>Manifesto</Button></div> }
                ]}
                data={executions}
              />
              <Pagination page={pageExecutions} pageSize={10} total={totalExecutions} onChange={(p) => { setPageExecutions(p); loadExecutions(p); }} />
            </>
          )}
        </>
      )}

      {activeTab === "ADHOC" && (
        <>
          <div className="data-actions-bar" style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={() => openTripModal()}>+ Nova Viagem</Button>
          </div>
          {loadingTrips ? <div className="data-loading">Carregando...</div> : (
            <>
              <Table
                columns={[
                  { label: "ID", key: "id" },
                  { label: "Origem", key: "origin" },
                  { label: "Destino", key: "destination" },
                  { label: "Saída", key: "departure_datetime", render: (d) => new Date(d.departure_datetime).toLocaleString("pt-BR") },
                  { label: "Veículo", key: "vehicle_plate", render: (d) => d.vehicle_plate || "—" },
                  { label: "OS", key: "service_order_external_id", render: (d) => d.service_order_external_id || "—" },
                  { label: "Status", key: "status", render: (d) => <StatusBadge status={d.status} /> },
                  { label: "Ações", key: "actions", render: (d) => <Button variant="ghost" size="sm" onClick={() => openTripModal(d)}>Editar</Button> }
                ]}
                data={trips}
              />
              <Pagination page={pageTrips} pageSize={10} total={totalTrips} onChange={(p) => { setPageTrips(p); loadTrips(p); }} />
            </>
          )}
        </>
      )}

      <Modal open={isPlanModalOpen} onClose={() => setIsPlanModalOpen(false)} title={planForm.id ? "Editar Planejamento" : "Novo Planejamento"}>
        <form onSubmit={handleSavePlan} className="data-form">
          <div className="data-form-grid">
            <label className="full-width">Título * <input required value={planForm.title || ""} onChange={e => setPlanForm({ ...planForm, title: e.target.value })} /></label>
            <label>Módulo * <select value={planForm.module} onChange={e => setPlanForm({ ...planForm, module: e.target.value as any })}>{Object.entries(moduleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Recorrência * <select value={planForm.recurrence} onChange={e => setPlanForm({ ...planForm, recurrence: e.target.value as any })}>{Object.entries(recurrenceLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Data Início * <input type="date" required value={planForm.start_date || ""} onChange={e => setPlanForm({ ...planForm, start_date: e.target.value })} /></label>
            <label>Data Fim <input type="date" value={planForm.end_date || ""} onChange={e => setPlanForm({ ...planForm, end_date: e.target.value })} /></label>
            <label>Hora Saída * <input type="time" required value={planForm.departure_time || ""} onChange={e => setPlanForm({ ...planForm, departure_time: e.target.value })} /></label>
            <label>Hora Retorno * <input type="time" required value={planForm.return_time_expected || ""} onChange={e => setPlanForm({ ...planForm, return_time_expected: e.target.value })} /></label>
            <label className="checkbox-label"><input type="checkbox" checked={planForm.active} onChange={e => setPlanForm({ ...planForm, active: e.target.checked })} /> Ativo</label>
          </div>
          <div className="data-form-actions"><Button type="button" variant="ghost" onClick={() => setIsPlanModalOpen(false)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
        </form>
      </Modal>

      <Modal open={isTripModalOpen} onClose={() => setIsTripModalOpen(false)} title={tripForm.id ? "Editar Viagem" : "Nova Viagem"}>
        <form onSubmit={handleSaveTrip} className="data-form">
          <div className="data-form-grid">
            <label>Origem * <input required value={tripForm.origin || ""} onChange={e => setTripForm({ ...tripForm, origin: e.target.value })} /></label>
            <label>Destino * <input required value={tripForm.destination || ""} onChange={e => setTripForm({ ...tripForm, destination: e.target.value })} /></label>
            <label>Saída * <input type="datetime-local" required value={tripForm.departure_datetime ? tripForm.departure_datetime.slice(0, 16) : ""} onChange={e => setTripForm({ ...tripForm, departure_datetime: e.target.value })} /></label>
            <label>Retorno Previsto * <input type="datetime-local" required value={tripForm.return_datetime_expected ? tripForm.return_datetime_expected.slice(0, 16) : ""} onChange={e => setTripForm({ ...tripForm, return_datetime_expected: e.target.value })} /></label>
            <label>Veículo * <select required value={tripForm.vehicle || ""} onChange={e => setTripForm({ ...tripForm, vehicle: Number(e.target.value) })}>{vehicles.map(v => <option key={v.id} value={v.id}>{v.license_plate}</option>)}</select></label>
            <label>Motorista * <select required value={tripForm.driver || ""} onChange={e => setTripForm({ ...tripForm, driver: Number(e.target.value) })}>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            <label>Ordem de Serviço <select value={tripForm.service_order || ""} onChange={e => setTripForm({ ...tripForm, service_order: Number(e.target.value) })}>
              <option value="">Nenhuma</option>
              {serviceOrders.map(os => <option key={os.id} value={os.id}>{os.external_id}</option>)}
            </select></label>
            <label>Categoria <select value={tripForm.category} onChange={e => setTripForm({ ...tripForm, category: e.target.value as any })}><option value="PASSENGER">Passageiro</option><option value="OBJECT">Objeto</option><option value="MIXED">Misto</option></select></label>
          </div>
          <div className="data-form-actions"><Button type="button" variant="ghost" onClick={() => setIsTripModalOpen(false)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
        </form>
      </Modal>
    </div>
  );
};
