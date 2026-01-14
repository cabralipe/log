import { useEffect, useMemo, useState } from "react";
import { api, type Paginated } from "../../lib/api";
import { Button } from "../../components/Button";
import { Table } from "../../components/Table";
import { StatusBadge } from "../../components/StatusBadge";
import { Modal } from "../../components/Modal";
import { FloatingActionButton } from "../../components/FloatingActionButton";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import {
  Assignment,
  EligibilityPolicy,
  Route,
  RouteStop,
  ServiceApplication,
  ServiceUnit,
  TransportService,
} from "../../types/transportPlanning";
import "./TransportPlanning.css";
import "../../styles/DataPage.css";

type Option = { value: string | number; label: string };

type Vehicle = { id: number; license_plate: string; max_passengers: number };
type Driver = { id: number; name: string };
type Contract = { id: number; contract_number: string; status: string };
type FormTemplate = { id: number; name: string; require_cpf: boolean };
type Tab = "services" | "routes" | "eligibility" | "applications" | "assignments" | "units";

const SERVICE_TYPES: Option[] = [
  { value: "SCHEDULED", label: "Recorrente" },
  { value: "ON_DEMAND", label: "Sob demanda" },
  { value: "MIXED", label: "Híbrido" },
];

const ROUTE_TYPES: Option[] = [
  { value: "URBAN", label: "Urbana" },
  { value: "RURAL", label: "Rural" },
  { value: "SPECIAL", label: "Especial" },
  { value: "EVENT", label: "Evento" },
];

const DECISIONS: Option[] = [
  { value: "AUTO_APPROVE", label: "Aprovar automaticamente" },
  { value: "AUTO_DENY", label: "Negar automaticamente" },
  { value: "AUTO_THEN_REVIEW", label: "Auto + Revisão" },
  { value: "MANUAL_REVIEW_ONLY", label: "Somente revisão" },
];

type RulePreset = {
  id: string;
  label: string;
  description: string;
  rules: Record<string, any>;
};

const RULE_PRESETS: RulePreset[] = [
  {
    id: "distance-5",
    label: "Aprovar quem mora até 5 km",
    description: "Limita a elegibilidade a beneficiários em um raio de 5 km.",
    rules: { max_distance_km: 5 },
  },
  {
    id: "distance-10",
    label: "Aprovar quem mora até 10 km",
    description: "Alternativa mais ampla para áreas rurais ou dispersas.",
    rules: { max_distance_km: 10 },
  },
  {
    id: "rural-priority",
    label: "Priorizar zona rural",
    description: "Dá prioridade a solicitações de zonas rurais.",
    rules: { prioritize_zones: ["RURAL"] },
  },
  {
    id: "pcd-priority",
    label: "Prioridade para PCD",
    description: "Beneficiários com deficiência entram primeiro na fila.",
    rules: { prioritize_categories: ["PCD"] },
  },
  {
    id: "elderly-priority",
    label: "Prioridade para idosos",
    description: "Idosos são priorizados em avaliações automáticas.",
    rules: { prioritize_categories: ["ELDERLY"] },
  },
  {
    id: "health-only",
    label: "Somente pacientes em tratamento de saúde",
    description: "Filtra solicitações para casos de saúde/remoção.",
    rules: { required_category: "PATIENT" },
  },
];

const ASSIGNMENT_STATUS: Option[] = [
  { value: "DRAFT", label: "Rascunho" },
  { value: "CONFIRMED", label: "Confirmado" },
  { value: "CANCELLED", label: "Cancelado" },
];

const STOP_TYPES: Option[] = [
  { value: "PICKUP", label: "Embarque" },
  { value: "DROPOFF", label: "Desembarque" },
  { value: "WAYPOINT", label: "Passagem" },
];

const DAYS = [
  { value: 0, label: "Seg" },
  { value: 1, label: "Ter" },
  { value: 2, label: "Qua" },
  { value: 3, label: "Qui" },
  { value: 4, label: "Sex" },
  { value: 5, label: "Sáb" },
  { value: 6, label: "Dom" },
];

const parseList = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload;
  if (payload?.results) return payload.results as T[];
  return [];
};

const compileRules = (selected: string[]) => {
  const selectedSet = new Set(selected);
  let maxDistance: number | null = null;
  const zones = new Set<string>();
  const prioritize = new Set<string>();
  let requiredCategory: string | null = null;

  RULE_PRESETS.forEach((preset) => {
    if (!selectedSet.has(preset.id)) return;
    const config = preset.rules;
    if (typeof config.max_distance_km === "number") {
      maxDistance = maxDistance ? Math.min(maxDistance, config.max_distance_km) : config.max_distance_km;
    }
    if (Array.isArray(config.prioritize_zones)) {
      config.prioritize_zones.forEach((z) => zones.add(z));
    }
    if (Array.isArray(config.prioritize_categories)) {
      config.prioritize_categories.forEach((c) => prioritize.add(c));
    }
    if (config.required_category) {
      requiredCategory = config.required_category;
    }
  });

  const payload: Record<string, any> = { presets: Array.from(selectedSet) };
  if (maxDistance !== null) payload.max_distance_km = maxDistance;
  if (zones.size) payload.prioritize_zones = Array.from(zones);
  if (prioritize.size) payload.prioritize_categories = Array.from(prioritize);
  if (requiredCategory) payload.required_category = requiredCategory;
  return payload;
};

const parseError = (err: any) => {
  if (!err || !err.response) return err?.message || "Erro desconhecido";
  const data = err.response.data;
  if (data?.detail) return data.detail;
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    try {
      return Object.values(data)
        .flat()
        .map((v: any) => (typeof v === "string" ? v : JSON.stringify(v)))
        .join(" | ");
    } catch {
      return JSON.stringify(data);
    }
  }
  return err.message || "Erro desconhecido";
};

export const TransportPlanningPage = ({ initialTab = "services" }: { initialTab?: Tab }) => {
  const { isMobile } = useMediaQuery();
  const [tab, setTab] = useState<Tab>(initialTab);

  const [services, setServices] = useState<TransportService[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [units, setUnits] = useState<ServiceUnit[]>([]);
  const [policies, setPolicies] = useState<EligibilityPolicy[]>([]);
  const [applications, setApplications] = useState<ServiceApplication[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([]);

  const [serviceForm, setServiceForm] = useState<Partial<TransportService>>({
    name: "",
    service_type: "SCHEDULED",
    requires_authorization: false,
    active: true,
  });
  const [routeForm, setRouteForm] = useState<Partial<Route>>({
    route_type: "URBAN",
    days_of_week: [0, 1, 2, 3, 4],
    active: true,
    planned_capacity: 0,
  });
  const [unitForm, setUnitForm] = useState<Partial<ServiceUnit>>({ unit_type: "SCHOOL", active: true });
  const [policyForm, setPolicyForm] = useState<Partial<EligibilityPolicy>>({
    decision_mode: "MANUAL_REVIEW_ONLY",
    active: true,
    rules_json: { presets: [] },
  });
  const [selectedRulePresets, setSelectedRulePresets] = useState<string[]>([]);
  const [applicationStatus, setApplicationStatus] = useState<{ id: number | null; status: string; notes: string }>({
    id: null,
    status: "PENDING",
    notes: "",
  });
  const [assignmentForm, setAssignmentForm] = useState<Partial<Assignment>>({
    status: "DRAFT",
  });
  const [stopModal, setStopModal] = useState<{ open: boolean; route: Route | null }>({ open: false, route: null });
  const [stopForm, setStopForm] = useState<Partial<RouteStop>>({ order: 1, stop_type: "WAYPOINT" });
  const [message, setMessage] = useState<string | null>(null);

  const refreshServices = () =>
    api.get<Paginated<TransportService>>("/transport-services/").then((res) => setServices(parseList(res.data)));
  const refreshRoutes = () =>
    api.get<Paginated<Route>>("/routes/").then((res) => {
      const data = parseList<Route>(res.data);
      setRoutes(data);
      return data;
    });
  const refreshUnits = () =>
    api.get<Paginated<ServiceUnit>>("/service-units/").then((res) => setUnits(parseList(res.data)));
  const refreshPolicies = () =>
    api.get<Paginated<EligibilityPolicy>>("/eligibility-policies/").then((res) => setPolicies(parseList(res.data)));
  const refreshApplications = () =>
    api.get<Paginated<ServiceApplication>>("/service-applications/").then((res) =>
      setApplications(parseList(res.data))
    );
  const refreshAssignments = () =>
    api.get<Paginated<Assignment>>("/assignments/", { params: { page_size: 100 } }).then((res) =>
      setAssignments(parseList(res.data))
    );

  useEffect(() => {
    refreshServices();
    refreshRoutes();
    refreshUnits();
    refreshPolicies();
    refreshApplications();
    refreshAssignments();
    api.get<Paginated<Vehicle>>("/vehicles/", { params: { page_size: 200 } }).then((res) => setVehicles(parseList(res.data)));
    api.get<Paginated<Driver>>("/drivers/", { params: { page_size: 200 } }).then((res) => setDrivers(parseList(res.data)));
    api.get<Paginated<Contract>>("/contracts/", { params: { page_size: 200 } }).then((res) => setContracts(parseList(res.data)));
    api.get<Paginated<FormTemplate>>("/forms/templates/", { params: { page_size: 200 } }).then((res) =>
      setFormTemplates(parseList(res.data))
    );
  }, []);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (services.length && !policyForm.transport_service) {
      setPolicyForm((prev) => ({ ...prev, transport_service: services[0].id }));
    }
  }, [services, policyForm.transport_service]);

  const serviceMap = useMemo(() => Object.fromEntries(services.map((s) => [s.id, s.name])), [services]);
  const routeMap = useMemo(() => Object.fromEntries(routes.map((r) => [r.id, r.name])), [routes]);
  const vehicleMap = useMemo(() => Object.fromEntries(vehicles.map((v) => [v.id, v.license_plate])), [vehicles]);
  const driverMap = useMemo(() => Object.fromEntries(drivers.map((d) => [d.id, d.name])), [drivers]);

  const saveService = async () => {
    try {
      await api.post("/transport-services/", serviceForm);
      setServiceForm({ name: "", service_type: "SCHEDULED", requires_authorization: false, active: true });
      refreshServices();
      setMessage("Serviço criado.");
    } catch (err: any) {
      setMessage(parseError(err));
    }
  };

  const saveRoute = async () => {
    try {
      await api.post("/routes/", {
        ...routeForm,
        days_of_week: routeForm.days_of_week || [],
      });
      setRouteForm({ route_type: "URBAN", days_of_week: [0, 1, 2, 3, 4], active: true, planned_capacity: 0 });
      refreshRoutes();
      setMessage("Rota criada.");
    } catch (err: any) {
      setMessage(parseError(err));
    }
  };

  const saveUnit = async () => {
    try {
      await api.post("/service-units/", unitForm);
      setUnitForm({ unit_type: "SCHOOL", active: true });
      refreshUnits();
      setMessage("Unidade criada.");
    } catch (err: any) {
      setMessage(parseError(err));
    }
  };

  const savePolicy = async () => {
    try {
      await api.post("/eligibility-policies/", policyForm);
      setPolicyForm({ decision_mode: "MANUAL_REVIEW_ONLY", active: true, rules_json: { presets: [] } });
      setSelectedRulePresets([]);
      refreshPolicies();
      setMessage("Regra salva.");
    } catch (err: any) {
      setMessage(parseError(err));
    }
  };

  const changeApplicationStatus = async () => {
    if (!applicationStatus.id) return;
    try {
      await api.patch(`/service-applications/${applicationStatus.id}/review/`, {
        status: applicationStatus.status,
        status_notes: applicationStatus.notes,
      });
      setApplicationStatus({ id: null, status: "PENDING", notes: "" });
      refreshApplications();
      setMessage("Status atualizado.");
    } catch (err: any) {
      setMessage(parseError(err));
    }
  };

  const saveAssignment = async () => {
    try {
      await api.post("/assignments/", assignmentForm);
      setAssignmentForm({ status: "DRAFT" });
      refreshAssignments();
      setMessage("Escala criada.");
    } catch (err: any) {
      setMessage(parseError(err));
    }
  };

  const suggestAssignment = async () => {
    if (!assignmentForm.route || !assignmentForm.date) return;
    try {
      const { data } = await api.get("/assignments/suggest/", {
        params: { route_id: assignmentForm.route, date: assignmentForm.date },
      });
      const suggestedVehicle = data?.vehicles?.find((v: any) => v.preferred) || data?.vehicles?.[0];
      const suggestedDriver = data?.drivers?.find((d: any) => d.preferred) || data?.drivers?.[0];
      setAssignmentForm((prev) => ({
        ...prev,
        vehicle: suggestedVehicle?.id ?? prev.vehicle,
        driver: suggestedDriver?.id ?? prev.driver,
      }));
      setMessage("Sugestões carregadas.");
    } catch (err: any) {
      setMessage(parseError(err));
    }
  };

  const generateDay = async () => {
    if (!assignmentForm.date) {
      setMessage("Informe a data para gerar a escala.");
      return;
    }
    try {
      const params: Record<string, any> = { date: assignmentForm.date };
      if (assignmentForm.route) params.route = assignmentForm.route;
      const { data } = await api.post("/assignments/generate-day/", null, {
        params,
      });
      refreshAssignments();
      const createdCount = data.created?.length || 0;
      const skipped = data.skipped || {};
      const existing = skipped.existing_assignment?.length || 0;
      const noResources = skipped.no_resources?.length || 0;
      const inactiveDay = skipped.inactive_day?.length || 0;
      const details = [existing ? `${existing} já existentes` : null, noResources ? `${noResources} sem recursos` : null, inactiveDay ? `${inactiveDay} fora do dia` : null]
        .filter(Boolean)
        .join(" · ");
      setMessage(`Escalas criadas: ${createdCount}${details ? ` (${details})` : ""}.`);
    } catch (err: any) {
      setMessage(parseError(err));
    }
  };

  const saveStop = async () => {
    if (!stopModal.route) return;
    try {
      await api.post(`/routes/${stopModal.route.id}/stops/`, {
        ...stopForm,
        route: stopModal.route.id,
        municipality: (stopModal.route as any).municipality,
      });
      refreshRoutes().then((data) => {
        const refreshed = data.find((r) => r.id === stopModal.route?.id);
        if (refreshed) {
          setStopModal({ open: true, route: refreshed });
        }
      });
      setStopForm({ order: (stopForm.order || 1) + 1, stop_type: "WAYPOINT" });
      setMessage("Ponto incluído.");
    } catch (err: any) {
      setMessage(parseError(err));
    }
  };

  const deleteStop = async (stopId: number) => {
    if (!confirm("Remover este ponto da rota?")) return;
    try {
      await api.delete(`/route-stops/${stopId}/`);
      refreshRoutes();
    } catch (err: any) {
      setMessage(parseError(err));
    }
  };

  const selectedRouteStops = useMemo(() => {
    if (!stopModal.route?.stops) return [];
    return [...stopModal.route.stops].sort((a, b) => a.order - b.order);
  }, [stopModal.route]);

  const setDays = (day: number) => {
    setRouteForm((prev) => {
      const current = new Set(prev.days_of_week || []);
      if (current.has(day)) current.delete(day);
      else current.add(day);
      return { ...prev, days_of_week: Array.from(current).sort() };
    });
  };

  const toggleRulePreset = (ruleId: string) => {
    setSelectedRulePresets((prev) => {
      const next = prev.includes(ruleId) ? prev.filter((id) => id !== ruleId) : [...prev, ruleId];
      setPolicyForm((current) => ({
        ...current,
        rules_json: compileRules(next),
      }));
      return next;
    });
  };

  const ruleSummary =
    selectedRulePresets.length > 0
      ? selectedRulePresets
        .map((id) => RULE_PRESETS.find((r) => r.id === id)?.label || id)
        .join(" • ")
      : "Nenhuma regra selecionada";

  return (
    <div className="planning-page">
      <header className="planning-header">
        <div>
          <p className="eyebrow">Planejamento de Transporte</p>
          <h2>Serviços, rotas, elegibilidade e escala diária</h2>
        </div>
        {message && <div className="toast">{message}</div>}
      </header>

      <div className="tab-bar" role="tablist">
        {[
          ["services", "Serviços"],
          ["routes", "Rotas"],
          ["eligibility", "Elegibilidade"],
          ["applications", "Solicitações"],
          ["assignments", "Escala do dia"],
          ["units", "Unidades"],
        ].map(([key, label]) => (
          <button
            key={key}
            role="tab"
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key as any)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "services" && (
        <section className="card">
          <div className="section-header">
            <div>
              <h3>Serviços de transporte</h3>
              <p>Cadastre programas como Transporte Escolar, Saúde, Porta-a-Porta.</p>
            </div>
            <div className="actions">
              <label>
                Formulário público:
                <select
                  value={serviceForm.form_template || ""}
                  onChange={(e) => setServiceForm({ ...serviceForm, form_template: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">Nenhum</option>
                  {formTemplates.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.require_cpf ? "(CPF obrig.)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <Button onClick={saveService}>Salvar serviço</Button>
            </div>
          </div>
          <div className="grid">
            <label>
              Nome
              <input value={serviceForm.name || ""} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} />
            </label>
            <label>
              Tipo
              <select
                value={serviceForm.service_type}
                onChange={(e) => setServiceForm({ ...serviceForm, service_type: e.target.value as any })}
              >
                {SERVICE_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Exige autorização?
              <input
                type="checkbox"
                checked={serviceForm.requires_authorization || false}
                onChange={(e) => setServiceForm({ ...serviceForm, requires_authorization: e.target.checked })}
              />
            </label>
            <label>
              Ativo
              <input
                type="checkbox"
                checked={serviceForm.active || false}
                onChange={(e) => setServiceForm({ ...serviceForm, active: e.target.checked })}
              />
            </label>
            <label className="full">
              Descrição
              <textarea
                value={serviceForm.description || ""}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
              />
            </label>
          </div>
          <Table
            columns={[
              { key: "name", label: "Serviço" },
              { key: "service_type", label: "Tipo" },
              { key: "requires_authorization", label: "Autorização", render: (r) => (r.requires_authorization ? "Sim" : "Não") },
              { key: "active", label: "Status", render: (r) => <StatusBadge status={r.active ? "ACTIVE" : "INACTIVE"} /> },
            ]}
            data={services}
          />
        </section>
      )}

      {tab === "routes" && (
        <section className="card">
          <div className="section-header">
            <div>
              <h3>Rotas formais</h3>
              <p>Horários, capacidade e preferências de veículo/motorista.</p>
            </div>
            <Button onClick={saveRoute}>Salvar rota</Button>
          </div>
          <div className="grid">
            <label>
              Serviço
              <select
                value={routeForm.transport_service || ""}
                onChange={(e) => setRouteForm({ ...routeForm, transport_service: Number(e.target.value) })}
              >
                <option value="">Selecione</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Código
              <input value={routeForm.code || ""} onChange={(e) => setRouteForm({ ...routeForm, code: e.target.value })} />
            </label>
            <label>
              Nome
              <input value={routeForm.name || ""} onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })} />
            </label>
            <label>
              Tipo
              <select value={routeForm.route_type} onChange={(e) => setRouteForm({ ...routeForm, route_type: e.target.value as any })}>
                {ROUTE_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Janela início
              <input type="time" value={routeForm.time_window_start || ""} onChange={(e) => setRouteForm({ ...routeForm, time_window_start: e.target.value })} />
            </label>
            <label>
              Janela fim
              <input type="time" value={routeForm.time_window_end || ""} onChange={(e) => setRouteForm({ ...routeForm, time_window_end: e.target.value })} />
            </label>
            <label>
              Duração estimada (min)
              <input
                type="number"
                value={routeForm.estimated_duration_minutes || 0}
                onChange={(e) => setRouteForm({ ...routeForm, estimated_duration_minutes: Number(e.target.value) })}
              />
            </label>
            <label>
              Capacidade planejada
              <input
                type="number"
                value={routeForm.planned_capacity || 0}
                onChange={(e) => setRouteForm({ ...routeForm, planned_capacity: Number(e.target.value) })}
              />
            </label>
            <label>
              Contrato (opcional)
              <select
                value={routeForm.contract || ""}
                onChange={(e) => setRouteForm({ ...routeForm, contract: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">Nenhum</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contract_number} ({c.status})
                  </option>
                ))}
              </select>
            </label>
            <div className="chip-group">
              {DAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  className={(routeForm.days_of_week || []).includes(d.value) ? "chip active" : "chip"}
                  onClick={() => setDays(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <label>
              Veículos preferidos
              <select
                multiple
                value={(routeForm.preferred_vehicles as number[] | undefined)?.map(String) || []}
                onChange={(e) =>
                  setRouteForm({
                    ...routeForm,
                    preferred_vehicles: Array.from(e.target.selectedOptions).map((o) => Number(o.value)),
                  })
                }
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.license_plate} ({v.max_passengers})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Motoristas preferidos
              <select
                multiple
                value={(routeForm.preferred_drivers as number[] | undefined)?.map(String) || []}
                onChange={(e) =>
                  setRouteForm({
                    ...routeForm,
                    preferred_drivers: Array.from(e.target.selectedOptions).map((o) => Number(o.value)),
                  })
                }
              >
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ativa
              <input
                type="checkbox"
                checked={routeForm.active || false}
                onChange={(e) => setRouteForm({ ...routeForm, active: e.target.checked })}
              />
            </label>
            <label className="full">
              Observações
              <textarea value={routeForm.notes || ""} onChange={(e) => setRouteForm({ ...routeForm, notes: e.target.value })} />
            </label>
          </div>

          <Table
            columns={[
              { key: "code", label: "Código" },
              { key: "name", label: "Nome" },
              { key: "transport_service", label: "Serviço", render: (r) => serviceMap[r.transport_service] || "—" },
              { key: "planned_capacity", label: "Capacidade" },
              { key: "time_window_start", label: "Janela", render: (r) => `${r.time_window_start || "--"} - ${r.time_window_end || "--"}` },
              { key: "active", label: "Status", render: (r) => <StatusBadge status={r.active ? "ACTIVE" : "INACTIVE"} /> },
              {
                key: "stops",
                label: "Pontos",
                render: (r) => (
                  <Button
                    variant="ghost"
                    onClick={() => setStopModal({ open: true, route: r })}
                  >
                    {(r.stops?.length || 0) || "0"} pontos
                  </Button>
                ),
              },
            ]}
            data={routes}
          />
        </section>
      )}

      {tab === "eligibility" && (
        <section className="card">
          <div className="section-header">
            <div>
              <h3>Regras de elegibilidade</h3>
              <p>Configuração de decisão automática por serviço/rota.</p>
            </div>
            <Button onClick={savePolicy}>Salvar regra</Button>
          </div>
          <div className="grid">
            <label>
              Serviço
              <select
                value={policyForm.transport_service || ""}
                onChange={(e) => setPolicyForm({ ...policyForm, transport_service: Number(e.target.value) })}
              >
                <option value="">Selecione</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rota (opcional)
              <select
                value={policyForm.route || ""}
                onChange={(e) => setPolicyForm({ ...policyForm, route: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">Qualquer</option>
                {routes
                  .filter((r) => !policyForm.transport_service || r.transport_service === policyForm.transport_service)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} - {r.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Nome
              <input value={policyForm.name || ""} onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })} />
            </label>
            <label>
              Decisão
              <select
                value={policyForm.decision_mode}
                onChange={(e) => setPolicyForm({ ...policyForm, decision_mode: e.target.value as any })}
              >
                {DECISIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ativa
              <input
                type="checkbox"
                checked={policyForm.active || false}
                onChange={(e) => setPolicyForm({ ...policyForm, active: e.target.checked })}
              />
            </label>
            <div className="full rule-selector">
              <p className="rule-title">Regras pré-definidas</p>
              <div className="rule-grid">
                {RULE_PRESETS.map((rule) => {
                  const active = selectedRulePresets.includes(rule.id);
                  return (
                    <button
                      key={rule.id}
                      type="button"
                      className={active ? "rule-card active" : "rule-card"}
                      onClick={() => toggleRulePreset(rule.id)}
                    >
                      <div className="rule-card-header">
                        <input type="checkbox" checked={active} readOnly />
                        <span>{rule.label}</span>
                      </div>
                      <p>{rule.description}</p>
                    </button>
                  );
                })}
              </div>
              <div className="rule-summary">
                <strong>Resumo</strong>
                <p>{ruleSummary}</p>
              </div>
            </div>
          </div>
          <Table
            columns={[
              { key: "name", label: "Nome" },
              { key: "transport_service", label: "Serviço", render: (r) => serviceMap[r.transport_service] || "—" },
              { key: "route", label: "Rota", render: (r) => (r.route ? routeMap[r.route] : "Qualquer") },
              { key: "decision_mode", label: "Decisão" },
              { key: "active", label: "Ativa", render: (r) => <StatusBadge status={r.active ? "ACTIVE" : "INACTIVE"} /> },
            ]}
            data={policies}
          />
        </section>
      )}

      {tab === "applications" && (
        <section className="card">
          <div className="section-header">
            <div>
              <h3>Solicitações</h3>
              <p>Submissões públicas avaliadas pelas políticas de elegibilidade.</p>
            </div>
            <div className="actions">
              <select
                value={applicationStatus.id || ""}
                onChange={(e) => setApplicationStatus({ ...applicationStatus, id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Selecionar protocolo</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    #{app.id} - {serviceMap[app.transport_service] || ""} ({app.person_detail?.cpf})
                  </option>
                ))}
              </select>
              <select
                value={applicationStatus.status}
                onChange={(e) => setApplicationStatus({ ...applicationStatus, status: e.target.value })}
              >
                <option value="PENDING">Pendente</option>
                <option value="APPROVED">Aprovado</option>
                <option value="REJECTED">Rejeitado</option>
                <option value="NEEDS_CORRECTION">Correção</option>
              </select>
              <input
                placeholder="Notas"
                value={applicationStatus.notes}
                onChange={(e) => setApplicationStatus({ ...applicationStatus, notes: e.target.value })}
              />
              <Button onClick={changeApplicationStatus}>Atualizar</Button>
            </div>
          </div>
          <Table
            columns={[
              { key: "id", label: "Protocolo" },
              {
                key: "person",
                label: "Pessoa",
                render: (r) => `${r.person_detail?.full_name || "—"} (${r.person_detail?.cpf || ""})`,
              },
              { key: "transport_service", label: "Serviço", render: (r) => serviceMap[r.transport_service] || "—" },
              { key: "route", label: "Rota", render: (r) => (r.route ? routeMap[r.route] : "—") },
              { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
              { key: "created_at", label: "Criado em", render: (r) => new Date(r.created_at).toLocaleString() },
            ]}
            data={applications}
          />
        </section>
      )}

      {tab === "assignments" && (
        <section className="card">
          <div className="section-header">
            <div>
              <h3>Escala diária</h3>
              <p>Sugestões e geração semiautomática de veículos/motoristas.</p>
            </div>
            <div className="actions">
              <Button variant="ghost" onClick={suggestAssignment}>
                Sugerir recursos
              </Button>
              <Button variant="ghost" onClick={generateDay}>
                Gerar escala do dia
              </Button>
              <Button onClick={saveAssignment}>Salvar escala</Button>
            </div>
          </div>
          <div className="grid">
            <label>
              Data
              <input
                type="date"
                value={assignmentForm.date || ""}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, date: e.target.value })}
              />
            </label>
            <label>
              Rota
              <select
                value={assignmentForm.route || ""}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, route: Number(e.target.value) })}
              >
                <option value="">Selecione</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} - {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Veículo
              <select
                value={assignmentForm.vehicle || ""}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, vehicle: Number(e.target.value) })}
              >
                <option value="">Selecione</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.license_plate} (cap {v.max_passengers})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Motorista
              <select
                value={assignmentForm.driver || ""}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, driver: Number(e.target.value) })}
              >
                <option value="">Selecione</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={assignmentForm.status}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, status: e.target.value as any })}
              >
                {ASSIGNMENT_STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              Anotações
              <input
                value={(assignmentForm as any).notes || ""}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, notes: e.target.value as any })}
              />
            </label>
          </div>

          <Table
            columns={[
              { key: "date", label: "Data" },
              { key: "route", label: "Rota", render: (r) => routeMap[r.route] || r.route },
              { key: "vehicle", label: "Veículo", render: (r) => vehicleMap[r.vehicle] || r.vehicle },
              { key: "driver", label: "Motorista", render: (r) => driverMap[r.driver] || r.driver },
              { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
              { key: "generated_trip", label: "Trip", render: (r) => (r.generated_trip ? `Trip #${r.generated_trip}` : "—") },
            ]}
            data={assignments}
          />
        </section>
      )}

      {tab === "units" && (
        <section className="card">
          <div className="section-header">
            <div>
              <h3>Unidades atendidas</h3>
              <p>Escolas, postos de saúde e centros comunitários vinculados aos serviços.</p>
            </div>
            <Button onClick={saveUnit}>Salvar unidade</Button>
          </div>
          <div className="grid">
            <label>
              Nome
              <input value={unitForm.name || ""} onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })} />
            </label>
            <label>
              Tipo
              <select
                value={unitForm.unit_type}
                onChange={(e) => setUnitForm({ ...unitForm, unit_type: e.target.value as any })}
              >
                <option value="SCHOOL">Escola</option>
                <option value="HEALTH">Saúde</option>
                <option value="SOCIAL_ASSISTANCE">Assistência Social</option>
                <option value="OTHER">Outro</option>
              </select>
            </label>
            <label>
              Endereço
              <input value={unitForm.address || ""} onChange={(e) => setUnitForm({ ...unitForm, address: e.target.value })} />
            </label>
            <label>
              Latitude
              <input
                type="number"
                value={unitForm.lat || ""}
                onChange={(e) => setUnitForm({ ...unitForm, lat: Number(e.target.value) })}
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                value={unitForm.lng || ""}
                onChange={(e) => setUnitForm({ ...unitForm, lng: Number(e.target.value) })}
              />
            </label>
            <label>
              Ativa
              <input
                type="checkbox"
                checked={unitForm.active || false}
                onChange={(e) => setUnitForm({ ...unitForm, active: e.target.checked })}
              />
            </label>
          </div>
          <Table
            columns={[
              { key: "name", label: "Unidade" },
              { key: "unit_type", label: "Tipo" },
              { key: "address", label: "Endereço" },
              { key: "active", label: "Status", render: (r) => <StatusBadge status={r.active ? "ACTIVE" : "INACTIVE"} /> },
            ]}
            data={units}
          />
        </section>
      )}

      <Modal
        open={stopModal.open && !!stopModal.route}
        title={`Pontos da rota ${stopModal.route?.code || ""}`}
        onClose={() => setStopModal({ open: false, route: null })}
      >
        <div className="grid">
          <label>
            Ordem
            <input
              type="number"
              value={stopForm.order || 1}
              onChange={(e) => setStopForm({ ...stopForm, order: Number(e.target.value) })}
            />
          </label>
          <label>
            Descrição
            <input
              value={stopForm.description || ""}
              onChange={(e) => setStopForm({ ...stopForm, description: e.target.value })}
            />
          </label>
          <label>
            Horário
            <input
              type="time"
              value={stopForm.scheduled_time || ""}
              onChange={(e) => setStopForm({ ...stopForm, scheduled_time: e.target.value })}
            />
          </label>
          <label>
            Tipo
            <select
              value={stopForm.stop_type}
              onChange={(e) => setStopForm({ ...stopForm, stop_type: e.target.value as any })}
            >
              {STOP_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Latitude
            <input
              type="number"
              value={stopForm.lat || ""}
              onChange={(e) => setStopForm({ ...stopForm, lat: Number(e.target.value) })}
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              value={stopForm.lng || ""}
              onChange={(e) => setStopForm({ ...stopForm, lng: Number(e.target.value) })}
            />
          </label>
        </div>
        <div className="modal-actions">
          <Button onClick={saveStop}>Adicionar ponto</Button>
        </div>
        <div className="stop-list">
          {selectedRouteStops.map((stop) => (
            <div key={stop.id} className="stop-card">
              <div>
                <strong>#{stop.order}</strong> {stop.description}
                <p>{stop.scheduled_time || "—"} • {STOP_TYPES.find((s) => s.value === stop.stop_type)?.label}</p>
              </div>
              <Button variant="ghost" onClick={() => deleteStop(stop.id)}>
                Remover
              </Button>
            </div>
          ))}
          {selectedRouteStops.length === 0 && <p className="muted">Nenhum ponto cadastrado.</p>}
        </div>
      </Modal>

      {isMobile && (
        <FloatingActionButton
          icon="+"
          aria-label="Salvar"
          onClick={() => {
            if (tab === "services") return saveService();
            if (tab === "routes") return saveRoute();
            if (tab === "eligibility") return savePolicy();
            if (tab === "assignments") return saveAssignment();
            if (tab === "units") return saveUnit();
            return null;
          }}
        />
      )}
    </div>
  );
};
