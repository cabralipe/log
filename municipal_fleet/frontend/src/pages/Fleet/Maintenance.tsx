import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCcw, Search, Wrench, Package, ShieldCheck, CircleDot, CheckSquare, Pencil } from "lucide-react";
import { api, type Paginated } from "../../lib/api";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import "../../styles/MaintenanceDashboard.css";

type Vehicle = { id: number; license_plate: string; brand: string; model: string };
type ServiceOrderStatus = "OPEN" | "IN_PROGRESS" | "WAITING_PARTS" | "COMPLETED" | "CANCELLED";
type ServiceOrderType = "CORRECTIVE" | "PREVENTIVE" | "TIRE";
type ServiceOrderPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type ServiceOrder = {
  id: number;
  vehicle: number;
  vehicle_license_plate?: string;
  type: ServiceOrderType;
  priority: ServiceOrderPriority;
  status: ServiceOrderStatus;
  description: string;
  provider_name?: string;
  total_cost: string | number;
  opened_at: string;
  completed_at?: string;
};

type InventoryPart = {
  id: number;
  name: string;
  sku: string;
  unit: string;
  minimum_stock: string;
  current_stock: string;
};

type InventoryMovementType = "IN" | "OUT" | "LOAN";
type InventoryMovement = {
  id: number;
  part: number;
  part_detail?: InventoryPart;
  type: InventoryMovementType;
  quantity: string | number;
  unit_cost?: string | number;
  reference?: string;
  responsible_name?: string;
  expected_return_date?: string | null;
  notes?: string;
  performed_at?: string;
};

type MaintenancePlan = {
  id: number;
  name: string;
  trigger_type: "KM" | "TIME";
  interval_km?: number;
  interval_days?: number;
  last_service_odometer?: number;
  last_service_date?: string;
  vehicle?: number;
  vehicle_license_plate?: string;
};

type Tire = {
  id: number;
  code: string;
  brand: string;
  model: string;
  size: string;
  status: string;
  total_km: number;
  max_km_life: number;
};

type InspectionRow = {
  id: number;
  vehicle: number;
  vehicle_plate?: string;
  driver_name?: string;
  inspection_date: string;
  condition_status: "OK" | "ATTENTION";
  odometer?: number | null;
  notes?: string;
  signature_image?: string;
  damage_photos?: Array<{ id: number; image: string }>;
};

type MaintenanceSummary = {
  status_counts: Array<{ status: ServiceOrderStatus; total: number }>;
  total_cost: number;
  cost_by_vehicle: Array<{ vehicle__license_plate: string; total: string | number }>;
};

const STATUS_LABEL: Record<ServiceOrderStatus, string> = {
  OPEN: "Aberta",
  IN_PROGRESS: "Em andamento",
  WAITING_PARTS: "Aguardando peças",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

const TYPE_LABEL: Record<ServiceOrderType, string> = {
  CORRECTIVE: "Corretiva",
  PREVENTIVE: "Preventiva",
  TIRE: "Pneus",
};

const PRIORITY_LABEL: Record<ServiceOrderPriority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

const MOVEMENT_LABEL: Record<InventoryMovementType, string> = {
  IN: "Entrada",
  OUT: "Saída",
  LOAN: "Empréstimo",
};

const CONDITION_LABEL: Record<InspectionRow["condition_status"], string> = {
  OK: "Aprovado",
  ATTENTION: "Atenção",
};

const currency = (value: string | number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("pt-BR") : "—");
const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString("pt-BR") : "—");
const vehicleLabel = (vehicle?: Vehicle | null) => {
  if (!vehicle) return "—";
  const name = `${vehicle.brand || ""} ${vehicle.model || ""}`.trim();
  return name ? `${vehicle.license_plate} - ${name}` : vehicle.license_plate;
};
const partLabel = (part?: InventoryPart | null) => {
  if (!part) return "—";
  return part.sku ? `${part.name} (${part.sku})` : part.name;
};

const getErrorMessage = (err: any, fallback: string) => {
  const data = err?.response?.data;
  if (data?.detail) return data.detail;
  if (data && typeof data === "object") {
    const fieldErrors = Object.entries(data)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
      .join(" | ");
    if (fieldErrors) return fieldErrors;
  }
  return fallback;
};

export const MaintenancePage = () => {
  const [tab, setTab] = useState<"orders" | "inventory" | "plans" | "tires" | "inspections">("orders");
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [tires, setTires] = useState<Tire[]>([]);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summary, setSummary] = useState<MaintenanceSummary | null>(null);
  const [inventoryLow, setInventoryLow] = useState<InventoryPart[]>([]);
  const [tireAlerts, setTireAlerts] = useState<Tire[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ search?: string; status?: string; type?: string; vehicle?: string }>({});
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [newOrder, setNewOrder] = useState<{
    vehicle: string;
    type: ServiceOrderType;
    priority: ServiceOrderPriority;
    description: string;
    provider_name: string;
  }>({
    vehicle: "",
    type: "CORRECTIVE",
    priority: "MEDIUM",
    description: "",
    provider_name: "",
  });
  const [editOrder, setEditOrder] = useState<{
    vehicle: string;
    type: ServiceOrderType;
    priority: ServiceOrderPriority;
    status: ServiceOrderStatus;
    description: string;
    provider_name: string;
  }>({
    vehicle: "",
    type: "CORRECTIVE",
    priority: "MEDIUM",
    status: "OPEN",
    description: "",
    provider_name: "",
  });
  const [newPart, setNewPart] = useState({ name: "", sku: "", unit: "UN", minimum_stock: "", current_stock: "" });
  const [newMovementIn, setNewMovementIn] = useState({
    part: "",
    quantity: "",
    unit_cost: "",
    performed_at: "",
    notes: "",
  });
  const [newMovementOut, setNewMovementOut] = useState({
    part: "",
    quantity: "",
    type: "OUT" as InventoryMovementType,
    responsible_name: "",
    performed_at: "",
    expected_return_date: "",
    notes: "",
  });
  const [newPlan, setNewPlan] = useState({
    name: "",
    trigger_type: "KM" as "KM" | "TIME",
    interval_km: "",
    interval_days: "",
    vehicle: "",
  });
  const [newTire, setNewTire] = useState({ code: "", brand: "", model: "", size: "", max_km_life: 50000 });

  const getVehicleLabel = (id?: number, plateFallback?: string) => {
    const vehicle = vehicles.find((v) => v.id === id);
    if (vehicle) return vehicleLabel(vehicle);
    if (plateFallback) return plateFallback;
    if (id) return String(id);
    return "—";
  };

  const toIsoDateTime = (dateValue: string) => {
    if (!dateValue) return undefined;
    return `${dateValue}T00:00:00`;
  };

  const statusTotals = useMemo(() => {
    const base: Record<ServiceOrderStatus, number> = {
      OPEN: 0,
      IN_PROGRESS: 0,
      WAITING_PARTS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    summary?.status_counts.forEach((item) => {
      base[item.status] = item.total;
    });
    return base;
  }, [summary]);

  const normalize = <T,>(res: { data: any }): T[] => {
    const data = res.data;
    return Array.isArray(data) ? data : data.results;
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      api.get<Paginated<ServiceOrder>>("/service-orders/", { params: filters }),
      api.get<Paginated<InventoryPart>>("/inventory/parts/", { params: { page_size: 200 } }),
      api.get<Paginated<InventoryMovement>>("/inventory/movements/", { params: { page_size: 200 } }),
      api.get<Paginated<MaintenancePlan>>("/maintenance-plans/", { params: { page_size: 200 } }),
      api.get<Paginated<Tire>>("/tires/", { params: { page_size: 200 } }),
      api.get<Paginated<InspectionRow>>("/vehicles/inspections/", { params: { page_size: 200 } }),
      api.get<Paginated<Vehicle>>("/vehicles/", { params: { page_size: 500 } }),
      api.get<MaintenanceSummary>("/reports/maintenance/summary/"),
      api.get("/reports/inventory/"),
      api.get("/reports/tires/"),
    ]);

    const errors: string[] = [];
    const getError = (reason: any) => reason?.response?.data?.detail || reason?.message || "Erro ao carregar dados.";

    const [
      ordersRes,
      partsRes,
      movementsRes,
      plansRes,
      tiresRes,
      inspectionsRes,
      vehiclesRes,
      summaryRes,
      inventoryReportRes,
      tireReportRes,
    ] = results;

    if (ordersRes.status === "fulfilled") setOrders(normalize<ServiceOrder>(ordersRes.value));
    else errors.push(getError(ordersRes.reason));

    if (partsRes.status === "fulfilled") setParts(normalize<InventoryPart>(partsRes.value));
    else errors.push(getError(partsRes.reason));

    if (movementsRes.status === "fulfilled") setMovements(normalize<InventoryMovement>(movementsRes.value));
    else errors.push(getError(movementsRes.reason));

    if (plansRes.status === "fulfilled") setPlans(normalize<MaintenancePlan>(plansRes.value));
    else errors.push(getError(plansRes.reason));

    if (tiresRes.status === "fulfilled") setTires(normalize<Tire>(tiresRes.value));
    else errors.push(getError(tiresRes.reason));

    if (inspectionsRes.status === "fulfilled") setInspections(normalize<InspectionRow>(inspectionsRes.value));
    else errors.push(getError(inspectionsRes.reason));

    if (vehiclesRes.status === "fulfilled") setVehicles(normalize<Vehicle>(vehiclesRes.value));
    else errors.push(getError(vehiclesRes.reason));

    if (summaryRes.status === "fulfilled") setSummary(summaryRes.value.data);
    else errors.push(getError(summaryRes.reason));

    if (inventoryReportRes.status === "fulfilled") setInventoryLow(inventoryReportRes.value.data.low_stock || []);
    else errors.push(getError(inventoryReportRes.reason));

    if (tireReportRes.status === "fulfilled") setTireAlerts((tireReportRes.value.data.nearing_end_of_life as Tire[]) || []);
    else errors.push(getError(tireReportRes.reason));

    if (errors.length) setError(errors[0]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateOrder = async () => {
    if (!newOrder.vehicle || !newOrder.description.trim()) {
      setError("Selecione um veículo e descreva o problema.");
      return;
    }
    try {
      await api.post("/service-orders/", {
        vehicle: Number(newOrder.vehicle),
        type: newOrder.type,
        priority: newOrder.priority,
        status: "OPEN",
        description: newOrder.description.trim(),
        provider_name: newOrder.provider_name.trim() || undefined,
      });
      setNewOrder({ vehicle: "", type: "CORRECTIVE", priority: "MEDIUM", description: "", provider_name: "" });
      loadAll();
    } catch (err: any) {
      setError(getErrorMessage(err, "Erro ao abrir OS."));
    }
  };

  const openEditOrder = (order: ServiceOrder) => {
    setEditingOrder(order);
    setEditOrder({
      vehicle: String(order.vehicle),
      type: order.type,
      priority: order.priority,
      status: order.status,
      description: order.description,
      provider_name: order.provider_name || "",
    });
  };

  const handleUpdateOrder = async () => {
    if (!editingOrder) return;
    if (!editOrder.vehicle || !editOrder.description.trim()) {
      setError("Selecione um veículo e descreva o problema.");
      return;
    }
    try {
      await api.patch(`/service-orders/${editingOrder.id}/`, {
        vehicle: Number(editOrder.vehicle),
        type: editOrder.type,
        priority: editOrder.priority,
        status: editOrder.status,
        description: editOrder.description.trim(),
        provider_name: editOrder.provider_name.trim() || undefined,
      });
      setEditingOrder(null);
      loadAll();
    } catch (err: any) {
      setError(getErrorMessage(err, "Erro ao atualizar OS."));
    }
  };

  const handleStartOrder = async (id: number) => {
    try {
      await api.post(`/service-orders/${id}/start/`);
      loadAll();
    } catch (err: any) {
      setError(getErrorMessage(err, "Erro ao iniciar OS."));
    }
  };

  const handleCompleteOrder = async (id: number) => {
    const km = window.prompt("KM de fechamento (opcional):");
    try {
      await api.post(`/service-orders/${id}/complete/`, km ? { vehicle_odometer_close: km } : {});
      loadAll();
    } catch (err: any) {
      setError(getErrorMessage(err, "Erro ao concluir OS."));
    }
  };

  const handleDeleteOrder = async (id: number) => {
    if (!window.confirm("Deseja remover esta OS?")) return;
    try {
      await api.delete(`/service-orders/${id}/`);
      loadAll();
    } catch (err: any) {
      setError(getErrorMessage(err, "Erro ao excluir OS."));
    }
  };

  const handleCreatePart = async () => {
    if (!newPart.name || !newPart.sku) {
      setError("Nome e SKU são obrigatórios.");
      return;
    }
    await api.post("/inventory/parts/", {
      ...newPart,
      minimum_stock: newPart.minimum_stock || "0",
      current_stock: newPart.current_stock || "0",
    });
    setNewPart({ name: "", sku: "", unit: "UN", minimum_stock: "", current_stock: "" });
    loadAll();
  };

  const handleCreateMovementIn = async () => {
    if (!newMovementIn.part || !newMovementIn.quantity) {
      setError("Peça e quantidade são obrigatórios.");
      return;
    }
    if (newMovementIn.unit_cost === "") {
      setError("Custo unitário é obrigatório.");
      return;
    }
    try {
      await api.post("/inventory/movements/", {
        part: Number(newMovementIn.part),
        type: "IN",
        quantity: Number(newMovementIn.quantity),
        unit_cost: Number(newMovementIn.unit_cost),
        performed_at: toIsoDateTime(newMovementIn.performed_at),
        notes: newMovementIn.notes.trim() || undefined,
      });
      setNewMovementIn({ part: "", quantity: "", unit_cost: "", performed_at: "", notes: "" });
      loadAll();
    } catch (err: any) {
      setError(getErrorMessage(err, "Erro ao registrar entrada."));
    }
  };

  const handleCreateMovementOut = async () => {
    if (!newMovementOut.part || !newMovementOut.quantity) {
      setError("Peça e quantidade são obrigatórios.");
      return;
    }
    if (!newMovementOut.responsible_name.trim()) {
      setError("Responsável é obrigatório para saída/emprestimo.");
      return;
    }
    if (newMovementOut.type === "LOAN" && !newMovementOut.expected_return_date) {
      setError("Informe a data de devolução prevista.");
      return;
    }
    try {
      await api.post("/inventory/movements/", {
        part: Number(newMovementOut.part),
        type: newMovementOut.type,
        quantity: Number(newMovementOut.quantity),
        responsible_name: newMovementOut.responsible_name.trim(),
        expected_return_date: newMovementOut.expected_return_date || undefined,
        performed_at: toIsoDateTime(newMovementOut.performed_at),
        notes: newMovementOut.notes.trim() || undefined,
      });
      setNewMovementOut({
        part: "",
        quantity: "",
        type: "OUT",
        responsible_name: "",
        performed_at: "",
        expected_return_date: "",
        notes: "",
      });
      loadAll();
    } catch (err: any) {
      setError(getErrorMessage(err, "Erro ao registrar saída/emprestimo."));
    }
  };

  const handleCreatePlan = async () => {
    if (!newPlan.name || !newPlan.vehicle) {
      setError("Plano precisa de nome e veículo.");
      return;
    }
    await api.post("/maintenance-plans/", {
      ...newPlan,
      vehicle: Number(newPlan.vehicle),
      interval_km: newPlan.trigger_type === "KM" ? Number(newPlan.interval_km || 0) : null,
      interval_days: newPlan.trigger_type === "TIME" ? Number(newPlan.interval_days || 0) : null,
    });
    setNewPlan({ name: "", trigger_type: "KM", interval_km: "", interval_days: "", vehicle: "" });
    loadAll();
  };

  const handleCreateTire = async () => {
    if (!newTire.code || !newTire.brand || !newTire.size) {
      setError("Código, marca e medida do pneu são obrigatórios.");
      return;
    }
    await api.post("/tires/", newTire);
    setNewTire({ code: "", brand: "", model: "", size: "", max_km_life: 50000 });
    loadAll();
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const searchText = (filters.search || "").toLowerCase();
      const matchesSearch =
        !searchText ||
        order.description.toLowerCase().includes(searchText) ||
        (order.vehicle_license_plate || "").toLowerCase().includes(searchText);
      const matchesStatus = !filters.status || order.status === filters.status;
      const matchesType = !filters.type || order.type === filters.type;
      const matchesVehicle = !filters.vehicle || String(order.vehicle) === filters.vehicle;
      return matchesSearch && matchesStatus && matchesType && matchesVehicle;
    });
  }, [orders, filters]);

  const statusChip = (status: ServiceOrderStatus) => (
    <span className={`chip status-${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>
  );

  const priorityChip = (priority: ServiceOrderPriority) => (
    <span className={`chip priority-${priority.toLowerCase()}`}>{PRIORITY_LABEL[priority]}</span>
  );

  return (
    <div className="maintenance-page">
      <div className="maintenance-header">
        <div>
          <h1>Manutenção</h1>
          <p className="muted">
            Ordens de serviço, estoque de peças, planos preventivos e pneus integrados ao odômetro.
          </p>
        </div>
        <div className="header-actions">
          <Button onClick={loadAll} aria-label="Atualizar módulo de manutenção">
            <RefreshCcw size={16} /> Atualizar
          </Button>
        </div>
      </div>

      {error && <div className="maintenance-error">{error}</div>}

      <div className="maintenance-tabs">
        <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>
          <Wrench size={16} /> Ordens de Serviço
        </button>
        <button className={tab === "inventory" ? "active" : ""} onClick={() => setTab("inventory")}>
          <Package size={16} /> Estoque
        </button>
        <button className={tab === "plans" ? "active" : ""} onClick={() => setTab("plans")}>
          <ShieldCheck size={16} /> Preventiva
        </button>
        <button className={tab === "tires" ? "active" : ""} onClick={() => setTab("tires")}>
          <CircleDot size={16} /> Pneus
        </button>
        <button className={tab === "inspections" ? "active" : ""} onClick={() => setTab("inspections")}>
          <CheckSquare size={16} /> Inspeções
        </button>
      </div>

      <div className="maintenance-card-grid">
        <Card title="OS abertas/andamento" value={(statusTotals.OPEN || 0) + (statusTotals.IN_PROGRESS || 0)} />
        <Card title="OS concluídas" value={statusTotals.COMPLETED || 0} />
        <Card title="Custo total" value={currency(summary?.total_cost || 0)} />
        <Card title="Peças baixo estoque" value={inventoryLow.length} />
      </div>

      {tab === "orders" && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Ordens de Serviço</h2>
              <p className="muted">Controle de corretivas, preventivas e pneus.</p>
            </div>
            <div className="filters">
              <div className="input-icon">
                <Search size={14} />
                <input
                  placeholder="Buscar descrição ou placa"
                  value={filters.search || ""}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                />
              </div>
              <select
                value={filters.status || ""}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value || undefined }))}
              >
                <option value="">Status</option>
                {Object.keys(STATUS_LABEL).map((key) => (
                  <option key={key} value={key}>
                    {STATUS_LABEL[key as ServiceOrderStatus]}
                  </option>
                ))}
              </select>
              <select
                value={filters.type || ""}
                onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value || undefined }))}
              >
                <option value="">Tipo</option>
                {Object.keys(TYPE_LABEL).map((key) => (
                  <option key={key} value={key}>
                    {TYPE_LABEL[key as ServiceOrderType]}
                  </option>
                ))}
              </select>
              <select
                value={filters.vehicle || ""}
                onChange={(e) => setFilters((prev) => ({ ...prev, vehicle: e.target.value || undefined }))}
              >
                <option value="">Veículo</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {vehicleLabel(v)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-grid">
            <div className="panel form-card">
              <div className="panel-header small">
                <div>
                  <h3>Abrir OS</h3>
                  <p className="muted">Crie uma corretiva, preventiva ou pneus.</p>
                </div>
                <Button onClick={handleCreateOrder}>
                  <Plus size={14} /> Salvar
                </Button>
              </div>
              <div className="form-row">
                <label>
                  Veículo
                  <select
                    value={newOrder.vehicle}
                    onChange={(e) => setNewOrder((p) => ({ ...p, vehicle: e.target.value }))}
                  >
                    <option value="">Selecione</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {vehicleLabel(v)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tipo
                  <select
                    value={newOrder.type}
                    onChange={(e) => setNewOrder((p) => ({ ...p, type: e.target.value as ServiceOrderType }))}
                  >
                    {Object.keys(TYPE_LABEL).map((key) => (
                      <option key={key} value={key}>
                        {TYPE_LABEL[key as ServiceOrderType]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Prioridade
                  <select
                    value={newOrder.priority}
                    onChange={(e) => setNewOrder((p) => ({ ...p, priority: e.target.value as ServiceOrderPriority }))}
                  >
                    {Object.keys(PRIORITY_LABEL).map((key) => (
                      <option key={key} value={key}>
                        {PRIORITY_LABEL[key as ServiceOrderPriority]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Descrição
                <textarea
                  value={newOrder.description}
                  onChange={(e) => setNewOrder((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  placeholder="Problema relatado ou serviço previsto"
                />
              </label>
              <label>
                Oficina/fornecedor (opcional)
                <input
                  value={newOrder.provider_name}
                  onChange={(e) => setNewOrder((p) => ({ ...p, provider_name: e.target.value }))}
                  placeholder="Nome da oficina"
                />
              </label>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="maintenance-table">
              <thead>
                <tr>
                  <th>OS</th>
                  <th>Veículo</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Prioridade</th>
                  <th>Descrição</th>
                  <th>Custo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td>{getVehicleLabel(order.vehicle, order.vehicle_license_plate)}</td>
                    <td>{TYPE_LABEL[order.type]}</td>
                    <td>{statusChip(order.status)}</td>
                    <td>{priorityChip(order.priority)}</td>
                    <td className="col-description">{order.description}</td>
                    <td>{currency(order.total_cost || 0)}</td>
                    <td>
                      <div className="row-actions">
                        {order.status === "OPEN" && (
                          <button onClick={() => handleStartOrder(order.id)} title="Iniciar">
                            <PlayIcon />
                          </button>
                        )}
                        <button onClick={() => openEditOrder(order)} title="Editar">
                          <Pencil size={16} />
                        </button>
                        {order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
                          <button onClick={() => handleCompleteOrder(order.id)} title="Concluir">
                            <CheckSquare size={16} />
                          </button>
                        )}
                        <button onClick={() => handleDeleteOrder(order.id)} title="Excluir">
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredOrders.length && !loading && (
              <div className="empty">Nenhuma OS encontrada com os filtros atuais.</div>
            )}
            {loading && <div className="loading">Carregando...</div>}
          </div>
        </section>
      )}

      <Modal
        open={Boolean(editingOrder)}
        onClose={() => setEditingOrder(null)}
        title={editingOrder ? `Editar OS #${editingOrder.id}` : undefined}
      >
        <div className="panel form-card">
          <div className="panel-header small">
            <div>
              <h3>Editar OS</h3>
              <p className="muted">Atualize informações da ordem de serviço.</p>
            </div>
            <Button onClick={handleUpdateOrder}>
              <Plus size={14} /> Salvar
            </Button>
          </div>
          <div className="form-row">
            <label>
              Veículo
              <select
                value={editOrder.vehicle}
                onChange={(e) => setEditOrder((p) => ({ ...p, vehicle: e.target.value }))}
              >
                <option value="">Selecione</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {vehicleLabel(v)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select
                value={editOrder.type}
                onChange={(e) => setEditOrder((p) => ({ ...p, type: e.target.value as ServiceOrderType }))}
              >
                {Object.keys(TYPE_LABEL).map((key) => (
                  <option key={key} value={key}>
                    {TYPE_LABEL[key as ServiceOrderType]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prioridade
              <select
                value={editOrder.priority}
                onChange={(e) => setEditOrder((p) => ({ ...p, priority: e.target.value as ServiceOrderPriority }))}
              >
                {Object.keys(PRIORITY_LABEL).map((key) => (
                  <option key={key} value={key}>
                    {PRIORITY_LABEL[key as ServiceOrderPriority]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              Status
              <select
                value={editOrder.status}
                onChange={(e) => setEditOrder((p) => ({ ...p, status: e.target.value as ServiceOrderStatus }))}
              >
                {Object.keys(STATUS_LABEL).map((key) => (
                  <option key={key} value={key}>
                    {STATUS_LABEL[key as ServiceOrderStatus]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Descrição
            <textarea
              value={editOrder.description}
              onChange={(e) => setEditOrder((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              placeholder="Problema relatado ou serviço previsto"
            />
          </label>
          <label>
            Oficina/fornecedor (opcional)
            <input
              value={editOrder.provider_name}
              onChange={(e) => setEditOrder((p) => ({ ...p, provider_name: e.target.value }))}
              placeholder="Nome da oficina"
            />
          </label>
        </div>
      </Modal>

      {tab === "inventory" && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Estoque de Peças</h2>
              <p className="muted">Consumo automático quando uma peça é usada na OS.</p>
            </div>
          </div>
          <div className="form-grid">
            <div className="panel form-card">
              <div className="panel-header small">
                <h3>Nova peça</h3>
                <Button onClick={handleCreatePart}>
                  <Plus size={14} /> Salvar
                </Button>
              </div>
              <div className="form-row">
                <label>
                  Nome
                  <input value={newPart.name} onChange={(e) => setNewPart((p) => ({ ...p, name: e.target.value }))} />
                </label>
                <label>
                  SKU
                  <input value={newPart.sku} onChange={(e) => setNewPart((p) => ({ ...p, sku: e.target.value }))} />
                </label>
                <label>
                  Unidade
                  <input value={newPart.unit} onChange={(e) => setNewPart((p) => ({ ...p, unit: e.target.value }))} />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Estoque atual
                  <input
                    type="number"
                    value={newPart.current_stock}
                    onChange={(e) => setNewPart((p) => ({ ...p, current_stock: e.target.value }))}
                  />
                </label>
                <label>
                  Estoque mínimo
                  <input
                    type="number"
                    value={newPart.minimum_stock}
                    onChange={(e) => setNewPart((p) => ({ ...p, minimum_stock: e.target.value }))}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="maintenance-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>SKU</th>
                  <th>Estoque</th>
                  <th>Mínimo</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((part) => {
                  const low = Number(part.current_stock) <= Number(part.minimum_stock || 0);
                  return (
                    <tr key={part.id} className={low ? "low-stock" : ""}>
                      <td>{part.name}</td>
                      <td>{part.sku}</td>
                      <td>
                        {part.current_stock} {part.unit}
                      </td>
                      <td>{part.minimum_stock}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!parts.length && <div className="empty">Nenhuma peça cadastrada.</div>}
          </div>

          <div className="form-grid">
            <div className="panel form-card">
              <div className="panel-header small">
                <h3>Entrada de peça</h3>
                <Button onClick={handleCreateMovementIn}>
                  <Plus size={14} /> Registrar
                </Button>
              </div>
              <div className="form-row">
                <label>
                  Peça
                  <select
                    value={newMovementIn.part}
                    onChange={(e) => setNewMovementIn((p) => ({ ...p, part: e.target.value }))}
                  >
                    <option value="">Selecione</option>
                    {parts.map((part) => (
                      <option key={part.id} value={part.id}>
                        {partLabel(part)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantidade
                  <input
                    type="number"
                    step="0.01"
                    value={newMovementIn.quantity}
                    onChange={(e) => setNewMovementIn((p) => ({ ...p, quantity: e.target.value }))}
                  />
                </label>
                <label>
                  Custo unitário
                  <input
                    type="number"
                    step="0.01"
                    value={newMovementIn.unit_cost}
                    onChange={(e) => setNewMovementIn((p) => ({ ...p, unit_cost: e.target.value }))}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Data
                  <input
                    type="date"
                    value={newMovementIn.performed_at}
                    onChange={(e) => setNewMovementIn((p) => ({ ...p, performed_at: e.target.value }))}
                  />
                </label>
              </div>
              <label>
                Observações
                <textarea
                  rows={2}
                  value={newMovementIn.notes}
                  onChange={(e) => setNewMovementIn((p) => ({ ...p, notes: e.target.value }))}
                />
              </label>
            </div>
            <div className="panel form-card">
              <div className="panel-header small">
                <h3>Saída / Empréstimo</h3>
                <Button onClick={handleCreateMovementOut}>
                  <Plus size={14} /> Registrar
                </Button>
              </div>
              <div className="form-row">
                <label>
                  Peça
                  <select
                    value={newMovementOut.part}
                    onChange={(e) => setNewMovementOut((p) => ({ ...p, part: e.target.value }))}
                  >
                    <option value="">Selecione</option>
                    {parts.map((part) => (
                      <option key={part.id} value={part.id}>
                        {partLabel(part)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantidade
                  <input
                    type="number"
                    step="0.01"
                    value={newMovementOut.quantity}
                    onChange={(e) => setNewMovementOut((p) => ({ ...p, quantity: e.target.value }))}
                  />
                </label>
                <label>
                  Tipo
                  <select
                    value={newMovementOut.type}
                    onChange={(e) =>
                      setNewMovementOut((p) => ({ ...p, type: e.target.value as InventoryMovementType }))
                    }
                  >
                    <option value="OUT">Saída</option>
                    <option value="LOAN">Empréstimo</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Responsável
                  <input
                    value={newMovementOut.responsible_name}
                    onChange={(e) => setNewMovementOut((p) => ({ ...p, responsible_name: e.target.value }))}
                  />
                </label>
                <label>
                  Data de saída
                  <input
                    type="date"
                    value={newMovementOut.performed_at}
                    onChange={(e) => setNewMovementOut((p) => ({ ...p, performed_at: e.target.value }))}
                  />
                </label>
                <label>
                  Devolução prevista
                  <input
                    type="date"
                    disabled={newMovementOut.type !== "LOAN"}
                    value={newMovementOut.expected_return_date}
                    onChange={(e) => setNewMovementOut((p) => ({ ...p, expected_return_date: e.target.value }))}
                  />
                </label>
              </div>
              <label>
                Observações
                <textarea
                  rows={2}
                  value={newMovementOut.notes}
                  onChange={(e) => setNewMovementOut((p) => ({ ...p, notes: e.target.value }))}
                />
              </label>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="maintenance-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Peça</th>
                  <th>Quantidade</th>
                  <th>Responsável</th>
                  <th>Devolução</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{formatDateTime(movement.performed_at)}</td>
                    <td>{MOVEMENT_LABEL[movement.type]}</td>
                    <td>{partLabel(movement.part_detail)}</td>
                    <td>{movement.quantity}</td>
                    <td>{movement.responsible_name || "—"}</td>
                    <td>{movement.expected_return_date ? formatDate(movement.expected_return_date) : "—"}</td>
                    <td className="col-description">{movement.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!movements.length && <div className="empty">Nenhuma movimentação registrada.</div>}
          </div>
        </section>
      )}

      {tab === "plans" && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Planos Preventivos</h2>
              <p className="muted">Disparam automaticamente após viagens.</p>
            </div>
          </div>
          <div className="form-grid">
            <div className="panel form-card">
              <div className="panel-header small">
                <h3>Novo plano</h3>
                <Button onClick={handleCreatePlan}>
                  <Plus size={14} /> Salvar
                </Button>
              </div>
              <div className="form-row">
                <label>
                  Nome
                  <input value={newPlan.name} onChange={(e) => setNewPlan((p) => ({ ...p, name: e.target.value }))} />
                </label>
                <label>
                  Veículo
                  <select value={newPlan.vehicle} onChange={(e) => setNewPlan((p) => ({ ...p, vehicle: e.target.value }))}>
                    <option value="">Selecione</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {vehicleLabel(v)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Disparo
                  <select
                    value={newPlan.trigger_type}
                    onChange={(e) => setNewPlan((p) => ({ ...p, trigger_type: e.target.value as "KM" | "TIME" }))}
                  >
                    <option value="KM">Por KM</option>
                    <option value="TIME">Por tempo</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Intervalo (km)
                  <input
                    type="number"
                    disabled={newPlan.trigger_type !== "KM"}
                    value={newPlan.interval_km}
                    onChange={(e) => setNewPlan((p) => ({ ...p, interval_km: e.target.value }))}
                  />
                </label>
                <label>
                  Intervalo (dias)
                  <input
                    type="number"
                    disabled={newPlan.trigger_type !== "TIME"}
                    value={newPlan.interval_days}
                    onChange={(e) => setNewPlan((p) => ({ ...p, interval_days: e.target.value }))}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="maintenance-table">
              <thead>
                <tr>
                  <th>Plano</th>
                  <th>Veículo</th>
                  <th>Tipo</th>
                  <th>Intervalo</th>
                  <th>Última execução</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td>{plan.name}</td>
                    <td>{getVehicleLabel(plan.vehicle, plan.vehicle_license_plate)}</td>
                    <td>{plan.trigger_type === "KM" ? "KM" : "Tempo"}</td>
                    <td>
                      {plan.trigger_type === "KM" ? `${plan.interval_km || 0} km` : `${plan.interval_days || 0} dias`}
                    </td>
                    <td>
                      {plan.last_service_date
                        ? plan.last_service_date
                        : plan.last_service_odometer
                          ? `${plan.last_service_odometer} km`
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!plans.length && <div className="empty">Nenhum plano cadastrado.</div>}
          </div>
        </section>
      )}

      {tab === "tires" && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Pneus</h2>
              <p className="muted">Ciclo de vida, recapagem e alertas automáticos.</p>
            </div>
          </div>
          <div className="form-grid">
            <div className="panel form-card">
              <div className="panel-header small">
                <h3>Novo pneu</h3>
                <Button onClick={handleCreateTire}>
                  <Plus size={14} /> Salvar
                </Button>
              </div>
              <div className="form-row">
                <label>
                  Código
                  <input value={newTire.code} onChange={(e) => setNewTire((p) => ({ ...p, code: e.target.value }))} />
                </label>
                <label>
                  Marca
                  <input value={newTire.brand} onChange={(e) => setNewTire((p) => ({ ...p, brand: e.target.value }))} />
                </label>
                <label>
                  Modelo
                  <input value={newTire.model} onChange={(e) => setNewTire((p) => ({ ...p, model: e.target.value }))} />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Medida
                  <input value={newTire.size} onChange={(e) => setNewTire((p) => ({ ...p, size: e.target.value }))} />
                </label>
                <label>
                  Vida útil (km)
                  <input
                    type="number"
                    value={newTire.max_km_life}
                    onChange={(e) => setNewTire((p) => ({ ...p, max_km_life: Number(e.target.value) }))}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="maintenance-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Medida</th>
                  <th>Status</th>
                  <th>Km acumulado</th>
                  <th>Vida útil</th>
                </tr>
              </thead>
              <tbody>
                {tires.map((t) => {
                  const nearEnd = t.max_km_life && t.total_km >= t.max_km_life * 0.9;
                  return (
                    <tr key={t.id} className={nearEnd ? "alert" : ""}>
                      <td>{t.code}</td>
                      <td>{t.brand}</td>
                      <td>{t.model}</td>
                      <td>{t.size}</td>
                      <td>{t.status}</td>
                      <td>{t.total_km} km</td>
                      <td>{t.max_km_life} km</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!tires.length && <div className="empty">Nenhum pneu cadastrado.</div>}

            {!!tireAlerts.length && (
              <div className="alert-box">
                <strong>Alertas:</strong> {tireAlerts.length} pneus próximos do fim da vida útil.
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "inspections" && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Inspeções diárias</h2>
              <p className="muted">Checklist diário, avarias registradas e assinatura do motorista.</p>
            </div>
          </div>
          <div className="table-wrapper">
            <table className="maintenance-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Veículo</th>
                  <th>Motorista</th>
                  <th>Status</th>
                  <th>Odômetro</th>
                  <th>Avarias</th>
                  <th>Assinatura</th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((inspection) => (
                  <tr key={inspection.id}>
                    <td>{formatDate(inspection.inspection_date)}</td>
                    <td>{getVehicleLabel(inspection.vehicle, inspection.vehicle_plate)}</td>
                    <td>{inspection.driver_name || "—"}</td>
                    <td>{CONDITION_LABEL[inspection.condition_status]}</td>
                    <td>{inspection.odometer ? `${inspection.odometer} km` : "—"}</td>
                    <td>{inspection.damage_photos?.length ? `${inspection.damage_photos.length} foto(s)` : "—"}</td>
                    <td>
                      {inspection.signature_image ? (
                        <a href={inspection.signature_image} target="_blank" rel="noopener noreferrer">
                          Ver
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!inspections.length && <div className="empty">Nenhuma inspeção registrada.</div>}
          </div>
        </section>
      )}
    </div>
  );
};

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7 4v16l13-8z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18" />
    <path d="M8 6v12" />
    <path d="M16 6v12" />
    <path d="M5 6l1 14c.1 1.1 1 2 2.1 2h7.8c1.1 0 2-.9 2.1-2l1-14" />
    <path d="M9 6V4h6v2" />
  </svg>
);
