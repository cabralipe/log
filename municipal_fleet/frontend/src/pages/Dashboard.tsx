import { useEffect, useMemo, useState } from "react";
import "./Dashboard.css";
import { api } from "../lib/api";
import { Card } from "../components/Card";
import { Table } from "../components/Table";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import { Skeleton } from "../components/Skeleton";
import { AreaTrendChart, DonutChart, SimpleBarChart } from "../components/Charts";

type CountItem = { status: string; total: number };
type OwnershipItem = { ownership_type: string; total: number };
type OdometerApiRow = { vehicle_id?: number; vehicle__license_plate: string; kilometers: number };
type OdometerRow = OdometerApiRow & { id: number | string };
type MaintenanceAlert = { id: number; license_plate: string; next_service_date: string | null; next_oil_change_date?: string | null };
type IncidentRow = {
  id: number;
  trip_id: number;
  trip__origin: string;
  trip__destination: string;
  driver__name: string;
  created_at: string;
  description: string;
};
type FreeTripRow = {
  id: number;
  driver__name: string;
  vehicle__license_plate: string;
  odometer_start: number;
  odometer_end?: number | null;
  ended_at?: string | null;
};
type ContractRow = { id: number; contract_number: string; provider_name: string; end_date: string; status: string };
type PlanDue = {
  id: number;
  name: string;
  vehicle_plate?: string | null;
  trigger_type: string;
  km_since_last?: number | null;
  days_since_last?: number | null;
  interval_km?: number | null;
  interval_days?: number | null;
};
type LowStockPart = { id: number; name: string; sku: string; current_stock: number; minimum_stock: number };
type TireNear = { id: number; code: string; brand: string; model: string; total_km: number; max_km_life: number; status: string };

type DashboardData = {
  summary: {
    total_vehicles: number;
    drivers_active: number;
    trips_month_total: number;
    open_service_orders: number;
    fuel_month_liters: number;
    pending_applications: number;
  };
  vehicles: {
    total: number;
    by_status: CountItem[];
    by_ownership: OwnershipItem[];
    maintenance_alerts: MaintenanceAlert[];
    odometer_month: OdometerApiRow[];
  };
  drivers: {
    total: number;
    active: number;
    inactive: number;
    free_trip_enabled: number;
    cnh_expiring_soon: { id: number; name: string; cnh_expiration_date: string }[];
  };
  trips: {
    month_total: number;
    by_status: CountItem[];
    passengers_month: number;
    incidents_last_30d: number;
    incidents_recent: IncidentRow[];
    free_trips: { open_count: number; recent_closed: FreeTripRow[] };
  };
  maintenance: {
    service_orders_by_status: CountItem[];
    active_plans: number;
    plans_due: PlanDue[];
    inventory_low_stock: LowStockPart[];
  };
  contracts: { total: number; active: number; expiring_soon: ContractRow[] };
  rental_periods: { by_status: CountItem[] };
  fuel: { month_logs: number; month_liters: number };
  transport_planning: {
    services: number;
    routes_active: number;
    routes_inactive: number;
    routes_without_assignment: number;
    assignments_today: CountItem[];
    applications_by_status: CountItem[];
  };
  forms: { templates_active: number; submissions_by_status: CountItem[] };
  students: { total: number; cards_active: number; cards_expiring_soon: number; cards_by_status: CountItem[] };
  student_cards?: {
    cards_total: number;
    cards_active: number;
    cards_blocked: number;
    cards_expired: number;
    cards_replaced: number;
    cards_expiring_soon: number;
    cards_issued_month: number;
    approved_submissions: number;
    cards_by_status: CountItem[];
    students_by_shift: { name: string; value: number }[];
    students_by_course: { name: string; value: number }[];
  };
  tires: { status_counts: CountItem[]; nearing_end_of_life: TireNear[] };
  users?: { total: number; operators: number; by_role: { role: string; total: number }[] };
  // campos antigos preservados para compatibilidade
  total_vehicles?: number;
  trips_month_total?: number;
  vehicles_by_status?: CountItem[];
  trips_by_status?: CountItem[];
  odometer_month?: OdometerApiRow[];
  maintenance_alerts?: MaintenanceAlert[];
};

type TabKey = "overview" | "fleet" | "operations" | "maintenance" | "contracts" | "planning" | "cards";

const formatNumber = (value?: number | string | null) => {
  if (value === null || value === undefined) return "0";
  const numeric = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(numeric)) return String(value);
  return numeric.toLocaleString("pt-BR");
};
const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("pt-BR") : "-");





export const DashboardPage = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("overview");
  const { user } = useAuth();

  const [maintenanceCosts, setMaintenanceCosts] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    setLoading(true);

    // Fetch dashboard data
    const dashboardPromise = api
      .get<DashboardData>("/reports/dashboard/")
      .then((res) => setData(res.data))
      .catch(() => setData(null));

    // Fetch service orders for maintenance costs chart
    // We'll fetch the last 6 months of data
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1); // Start of the month

    const maintenancePromise = api
      .get("/service-orders/", {
        params: {
          page_size: 1000, // Fetch enough to aggregate
          created_at_after: sixMonthsAgo.toISOString().split('T')[0]
        }
      })
      .then((res) => {
        const orders = res.data.results || [];
        const monthlyCosts = new Map<string, number>();

        // Initialize last 6 months with 0
        for (let i = 0; i < 6; i++) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const key = d.toLocaleDateString("pt-BR", { month: "short" }); // e.g., "jan"
          // We want to display in chronological order, so we'll sort later
          if (!monthlyCosts.has(key)) {
            monthlyCosts.set(key, 0);
          }
        }

        orders.forEach((order: any) => {
          if (order.total_cost && order.created_at) {
            const date = new Date(order.created_at);
            const key = date.toLocaleDateString("pt-BR", { month: "short" });
            const current = monthlyCosts.get(key) || 0;
            monthlyCosts.set(key, current + Number(order.total_cost));
          }
        });

        // Convert to array and sort chronologically
        const chartData = Array.from(monthlyCosts.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => {
            const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
            // This simple sort might fail if spanning years without year context, 
            // but for a simple "last 6 months" view it's often acceptable or we can improve logic.
            // Better approach: generate the keys based on the loop above to ensure order.
            return 0;
          });

        // Re-generate correct order based on time
        const orderedData = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const key = d.toLocaleDateString("pt-BR", { month: "short" });
          // Capitalize first letter
          const label = key.charAt(0).toUpperCase() + key.slice(1);
          orderedData.push({
            name: label,
            value: monthlyCosts.get(key) || 0
          });
        }

        setMaintenanceCosts(orderedData);
      })
      .catch((err) => {
        console.error("Failed to fetch maintenance costs", err);
        setMaintenanceCosts([]);
      });

    Promise.all([dashboardPromise, maintenancePromise])
      .finally(() => setLoading(false));
  }, []);

  const odometerRows: OdometerRow[] = useMemo(
    () =>
      (data?.vehicles?.odometer_month ?? data?.odometer_month ?? []).map((row, idx) => ({
        ...row,
        id: row.vehicle_id ?? row.vehicle__license_plate ?? idx,
      })),
    [data?.odometer_month, data?.vehicles?.odometer_month]
  );

  const vehicleStatusData = useMemo(() => {
    const STATUS_TRANSLATIONS: Record<string, string> = {
      AVAILABLE: "Disponível",
      ACTIVE: "Ativo",
      IN_USE: "Em uso",
      MAINTENANCE: "Manutenção",
      INACTIVE: "Inativo",
      PLANNED: "Planejado",
      IN_PROGRESS: "Em andamento",
      COMPLETED: "Concluído",
      CANCELLED: "Cancelado",
      EXPIRED: "Expirado",
      OPEN: "Aberto",
      CLOSED: "Fechado",
      INVOICED: "Faturado",
      WAITING_PARTS: "Aguardando peças",
    };
    return (data?.vehicles?.by_status ?? data?.vehicles_by_status ?? []).map((item) => ({
      name: STATUS_TRANSLATIONS[item.status] || item.status,
      value: item.total,
    }));
  }, [data]);

  const tripsStatusData = useMemo(() => {
    const STATUS_TRANSLATIONS: Record<string, string> = {
      SCHEDULED: "Agendada",
      IN_PROGRESS: "Em andamento",
      COMPLETED: "Concluída",
      CANCELLED: "Cancelada",
      CONFIRMED: "Confirmada",
      PENDING: "Pendente",
    };
    return (data?.trips?.by_status ?? data?.trips_by_status ?? []).map((item) => ({
      name: STATUS_TRANSLATIONS[item.status] || item.status,
      value: item.total,
    }));
  }, [data]);

  const odometerChartData = useMemo(() => {
    return odometerRows.slice(0, 10).map((row) => ({
      name: row.vehicle__license_plate,
      value: row.kilometers,
    }));
  }, [odometerRows]);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-hero card">
          <div>
            <div style={{ marginBottom: "0.5rem" }}><Skeleton width={120} height={20} /></div>
            <div style={{ marginBottom: "0.5rem" }}><Skeleton width={250} height={32} /></div>
            <div style={{ marginBottom: "1rem" }}><Skeleton width="80%" height={20} /></div>
            <div className="hero-badges">
              <Skeleton width={100} height={24} className="pill" />
              <Skeleton width={100} height={24} className="pill" />
              <Skeleton width={100} height={24} className="pill" />
            </div>
          </div>
          <div className="summary-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card" style={{ height: 120 }}>
                <div style={{ marginBottom: "1rem" }}><Skeleton width="60%" height={20} /></div>
                <Skeleton width="40%" height={32} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return <p className="muted">Erro ao carregar dashboard.</p>;

  const tripsMonth = data.summary?.trips_month_total ?? data.trips?.month_total ?? data.trips_month_total ?? 0;
  const vehiclesTotal = data.summary?.total_vehicles ?? data.total_vehicles ?? data.vehicles?.total ?? 0;
  const isAdmin = user?.role === "SUPERADMIN" || user?.role === "ADMIN_MUNICIPALITY";
  const showSection = (keys: TabKey | TabKey[]) => {
    const list = Array.isArray(keys) ? keys : [keys];
    return list.includes(tab);
  };

  const summaryCards = [
    { title: "Veículos na base", value: formatNumber(vehiclesTotal), hint: "Distribuição por status" },
    { title: "Motoristas ativos", value: formatNumber(data.summary?.drivers_active ?? data.drivers?.active ?? 0), hint: `Total: ${formatNumber(data.drivers?.total ?? 0)}` },
    { title: "Viagens no mês", value: formatNumber(tripsMonth), hint: `Passageiros: ${formatNumber(data.trips?.passengers_month ?? 0)}` },
    { title: "Litros abastecidos", value: formatNumber(data.fuel?.month_liters ?? data.summary?.fuel_month_liters ?? 0), hint: `${formatNumber(data.fuel?.month_logs ?? 0)} registros` },
    { title: "OS em aberto", value: formatNumber(data.summary?.open_service_orders ?? 0), hint: "Manutenção" },
    { title: "Solicitações pendentes", value: formatNumber(data.summary?.pending_applications ?? 0), hint: "Transportes/Serviços" },
  ];
  if (isAdmin) {
    summaryCards.push({
      title: "Operadores",
      value: formatNumber(data.users?.operators ?? 0),
      hint: `Usuários: ${formatNumber(data.users?.total ?? 0)}`,
    });
  }
  const roleLabels: Record<string, string> = {
    SUPERADMIN: "Superadmin",
    ADMIN_MUNICIPALITY: "Admin prefeitura",
    OPERATOR: "Operador",
    VIEWER: "Visualizador",
  };
  const cardStatusChart = (data.student_cards?.cards_by_status ?? data.students?.cards_by_status ?? []).map((item) => ({
    name: item.status,
    value: item.total,
  }));
  const shiftChart = data.student_cards?.students_by_shift ?? [];
  const courseChart = data.student_cards?.students_by_course ?? [];
  const invalidCards =
    (data.student_cards?.cards_blocked ?? 0) + (data.student_cards?.cards_expired ?? 0);

  return (
    <div className="dashboard-page animate-fade-in">
      <div className="dashboard-tabs">
        {[
          { key: "overview", label: "Visão geral" },
          { key: "fleet", label: "Frota & Pessoas" },
          { key: "operations", label: "Operação" },
          { key: "maintenance", label: "Manutenção & Estoque" },
          { key: "contracts", label: "Contratos & Custos" },
          { key: "planning", label: "Planejamento & Demandas" },
          { key: "cards", label: "Carteirinhas" },
        ].map((item) => (
          <button key={item.key} className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key as TabKey)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="overview-header card animate-slide-up">
            <div>
              <p className="eyebrow">Visão geral</p>
              <h2>Resumo operacional</h2>
              <p className="muted">
                Estatísticas consolidadas de frota, viagens, contratos, manutenção, planejamento de rotas e atendimento.
              </p>
            </div>
            <div className="hero-badges">
              <span className="pill">Frota {formatNumber(vehiclesTotal)}</span>
              <span className="pill">Viagens mês {formatNumber(tripsMonth)}</span>
              <span className="pill">Abastecimentos {formatNumber(data.fuel?.month_logs ?? 0)}</span>
              <span className="pill">OS abertas {formatNumber(data.summary?.open_service_orders ?? 0)}</span>
            </div>
          </div>

          <div className="summary-grid animate-slide-up" style={{ marginTop: "1rem" }}>
            {summaryCards.map((item) => (
              <Card key={item.title} title={item.title} value={item.value} hint={item.hint} />
            ))}
          </div>

          <div className="charts-row animate-slide-up">
            <div className="chart-card">
              <DonutChart data={vehicleStatusData} title="Status da Frota" height={220} />
            </div>
            <div className="chart-card">
              <DonutChart data={tripsStatusData} title="Viagens por Status" height={220} />
            </div>
          </div>
        </>
      )}

      {showSection("fleet") && (
        <section className="dashboard-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Frota & Pessoas</p>
              <h3>Saúde da frota e condutores</h3>
            </div>
            <span className="pill ghost">Alertas {formatNumber(data.vehicles?.maintenance_alerts?.length ?? 0)}</span>
          </div>
          <div className="dashboard-grid three">
            <div className="card">
              <div className="card-head">
                <div>
                  <p className="muted">Veículos</p>
                  <h4>Status operacional</h4>
                </div>
                <span className="pill ghost">Total {formatNumber(vehiclesTotal)}</span>
              </div>
              <div className="chip-grid">
                {(data.vehicles?.by_status ?? data.vehicles_by_status ?? []).map((item) => (
                  <div className="chip" key={item.status}>
                    <StatusBadge status={item.status} />
                    <strong>{formatNumber(item.total)}</strong>
                  </div>
                ))}
              </div>
              <div className="divider" />
              <p className="muted">Propriedade</p>
              <div className="chip-grid">
                {(data.vehicles?.by_ownership ?? []).map((item) => (
                  <div className="chip ghost" key={item.ownership_type}>
                    <span>{item.ownership_type}</span>
                    <strong>{formatNumber(item.total)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <div>
                  <p className="muted">Manutenção</p>
                  <h4>Alertas de revisão</h4>
                </div>
                <span className="pill ghost">{formatNumber(data.vehicles?.maintenance_alerts?.length ?? 0)} itens</span>
              </div>
              <Table
                columns={[
                  { key: "license_plate", label: "Placa" },
                  { key: "next_service_date", label: "Revisão", render: (row) => formatDate((row as MaintenanceAlert).next_service_date) },
                  { key: "next_oil_change_date", label: "Troca de óleo", render: (row) => formatDate((row as MaintenanceAlert).next_oil_change_date) },
                ]}
                data={(data.vehicles?.maintenance_alerts ?? data.maintenance_alerts ?? []).map((item) => ({ ...item, id: item.id }))}
              />
            </div>
            <div className="card">
              <div className="card-head">
                <div>
                  <p className="muted">Motoristas</p>
                  <h4>CNH a vencer</h4>
                </div>
                <span className="pill ghost">{formatNumber(data.drivers?.cnh_expiring_soon?.length ?? 0)} próximos</span>
              </div>
              <Table
                columns={[
                  { key: "name", label: "Nome" },
                  { key: "cnh_expiration_date", label: "Vencimento", render: (row) => formatDate((row as any).cnh_expiration_date) },
                ]}
                data={(data.drivers?.cnh_expiring_soon ?? []).map((item) => ({ ...item, id: item.id }))}
              />
            </div>
            {isAdmin && (
              <div className="card">
                <div className="card-head">
                  <div>
                    <p className="muted">Equipe</p>
                    <h4>Operadores e permissões</h4>
                  </div>
                  <span className="pill ghost">Total {formatNumber(data.users?.total ?? 0)}</span>
                </div>
                <div className="chip-grid">
                  {(data.users?.by_role ?? []).map((item) => (
                    <div className="chip ghost" key={item.role}>
                      <span>{roleLabels[item.role] ?? item.role}</span>
                      <strong>{formatNumber(item.total)}</strong>
                    </div>
                  ))}
                </div>
                <div className="divider" />
                <p className="muted">Operadores com acesso</p>
                <strong>{formatNumber(data.users?.operators ?? 0)}</strong>
              </div>
            )}
          </div>
        </section>
      )}

      {showSection("operations") && (
        <section className="dashboard-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Operação</p>
              <h3>Viagens, incidentes e odômetro</h3>
            </div>
            <span className="pill ghost">Incidentes 30d: {formatNumber(data.trips?.incidents_last_30d ?? 0)}</span>
          </div>
          <div className="dashboard-grid two">
            <div className="card">
              <div className="card-head">
                <div>
                  <p className="muted">Viagens</p>
                  <h4>Status no mês</h4>
                </div>
                <span className="pill ghost">{formatNumber(tripsMonth)} total</span>
              </div>
              <div className="chip-grid">
                {(data.trips?.by_status ?? data.trips_by_status ?? []).map((item) => (
                  <div className="chip" key={item.status}>
                    <StatusBadge status={item.status} />
                    <strong>{formatNumber(item.total)}</strong>
                  </div>
                ))}
              </div>
              <div className="stats-row">
                <div>
                  <p className="muted">Passageiros no mês</p>
                  <strong>{formatNumber(data.trips?.passengers_month ?? 0)}</strong>
                </div>
                <div>
                  <p className="muted">Viagens livres em aberto</p>
                  <strong>{formatNumber(data.trips?.free_trips?.open_count ?? 0)}</strong>
                </div>
              </div>
              <div className="divider" />
              <p className="muted">Ocorrências recentes</p>
              <Table
                columns={[
                  { key: "created_at", label: "Registrado em", render: (row) => formatDate((row as IncidentRow).created_at) },
                  { key: "trip__origin", label: "Rota", render: (row) => `${(row as IncidentRow).trip__origin} -> ${(row as IncidentRow).trip__destination}` },
                  { key: "driver__name", label: "Motorista" },
                  { key: "description", label: "Relato" },
                ]}
                data={(data.trips?.incidents_recent ?? []).map((item) => ({ ...item, id: item.id }))}
              />
            </div>
            <div className="card">
              <div className="card-head">
                <div>
                  <p className="muted">Quilometragem</p>
                  <h4>Resumo do mês</h4>
                </div>
                <span className="pill ghost">Veículos {formatNumber(odometerRows.length)}</span>
              </div>
              <SimpleBarChart data={odometerChartData} title="Top 10 Veículos (KM)" height={200} />
              <div className="divider" />
              <Table
                columns={[
                  { key: "vehicle__license_plate", label: "Veículo" },
                  { key: "kilometers", label: "KM", render: (row) => formatNumber((row as OdometerRow).kilometers) },
                ]}
                data={odometerRows}
              />
              <div className="divider" />
              <p className="muted">Viagens livres encerradas</p>
              <Table
                columns={[
                  { key: "driver__name", label: "Motorista" },
                  { key: "vehicle__license_plate", label: "Veículo" },
                  { key: "odometer_start", label: "Início" },
                  { key: "odometer_end", label: "Fim" },
                ]}
                data={(data.trips?.free_trips?.recent_closed ?? []).map((item) => ({ ...item, id: item.id }))}
              />
            </div>
          </div>
        </section>
      )}

      {showSection("maintenance") && (
        <section className="dashboard-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Manutenção & Estoque</p>
              <h3>Ordens, planos e peças</h3>
            </div>
            <span className="pill ghost">Planos ativos {formatNumber(data.maintenance?.active_plans ?? 0)}</span>
          </div>
          <div className="dashboard-grid three">
            <div className="card">
              <div className="card-head">
                <div>
                  <p className="muted">Ordens de serviço</p>
                  <h4>Status</h4>
                </div>
              </div>
              <div className="chip-grid">
                {(data.maintenance?.service_orders_by_status ?? []).map((item) => (
                  <div className="chip" key={item.status}>
                    <StatusBadge status={item.status} />
                    <strong>{formatNumber(item.total)}</strong>
                  </div>
                ))}
              </div>
              <div className="divider" />
              <AreaTrendChart data={maintenanceCosts} title="Custos (6 meses)" height={150} />
              <div className="divider" />
              <p className="muted">Planos preventivos a vencer</p>
              <Table
                columns={[
                  { key: "name", label: "Plano" },
                  { key: "vehicle_plate", label: "Veículo" },
                  { key: "trigger_type", label: "Gatilho" },
                  { key: "km_since_last", label: "KM", render: (row) => (row as PlanDue).km_since_last ?? "-" },
                  { key: "days_since_last", label: "Dias", render: (row) => (row as PlanDue).days_since_last ?? "-" },
                ]}
                data={(data.maintenance?.plans_due ?? []).map((item) => ({ ...item, id: item.id }))}
              />
            </div>
            <div className="card">
              <div className="card-head">
                <div>
                  <p className="muted">Estoque</p>
                  <h4>Peças em baixa</h4>
                </div>
                <span className="pill ghost">{formatNumber(data.maintenance?.inventory_low_stock?.length ?? 0)} itens</span>
              </div>
              <Table
                columns={[
                  { key: "name", label: "Peça" },
                  { key: "sku", label: "SKU" },
                  { key: "current_stock", label: "Estoque", render: (row) => formatNumber((row as LowStockPart).current_stock as any) },
                  { key: "minimum_stock", label: "Mínimo", render: (row) => formatNumber((row as LowStockPart).minimum_stock as any) },
                ]}
                data={(data.maintenance?.inventory_low_stock ?? []).map((item) => ({ ...item, id: item.id }))}
              />
            </div>
            <div className="card">
              <div className="card-head">
                <div>
                  <p className="muted">Pneus</p>
                  <h4>Status e vida útil</h4>
                </div>
              </div>
              <div className="chip-grid">
                {(data.tires?.status_counts ?? []).map((item) => (
                  <div className="chip ghost" key={item.status}>
                    <span>{item.status}</span>
                    <strong>{formatNumber(item.total)}</strong>
                  </div>
                ))}
              </div>
              <div className="divider" />
              <p className="muted">Perto do fim</p>
              <Table
                columns={[
                  { key: "code", label: "Código" },
                  { key: "brand", label: "Marca" },
                  { key: "model", label: "Modelo" },
                  { key: "total_km", label: "Rodado", render: (row) => formatNumber((row as TireNear).total_km) },
                  { key: "max_km_life", label: "Vida útil", render: (row) => formatNumber((row as TireNear).max_km_life) },
                ]}
                data={(data.tires?.nearing_end_of_life ?? []).map((item) => ({ ...item, id: item.id }))}
              />
            </div>
          </div>
        </section>
      )}

      {showSection("contracts") && (
        <section className="dashboard-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Contratos & Custos</p>
              <h3>Contratações, abastecimento e períodos</h3>
            </div>
            <span className="pill ghost">Contratos ativos {formatNumber(data.contracts?.active ?? 0)}</span>
          </div>
          <div className="dashboard-grid three">
            <div className="card">
              <div className="card-head">
                <div>
                  <p className="muted">Contratos</p>
                  <h4>Expirando em 30 dias</h4>
                </div>
                <span className="pill ghost">{formatNumber(data.contracts?.expiring_soon?.length ?? 0)} itens</span>
              </div>
              <Table
                columns={[
                  { key: "contract_number", label: "Contrato" },
                  { key: "provider_name", label: "Fornecedor" },
                  { key: "status", label: "Status" },
                  { key: "end_date", label: "Fim", render: (row) => formatDate((row as ContractRow).end_date) },
                ]}
                data={(data.contracts?.expiring_soon ?? []).map((item) => ({ ...item, id: item.id }))}
              />
            </div>
            <div className="card">
              <div className="card-head">
                <div>
                  <p className="muted">Períodos de locação</p>
                  <h4>Status</h4>
                </div>
              </div>
              <div className="chip-grid">
                {(data.rental_periods?.by_status ?? []).map((item) => (
                  <div className="chip ghost" key={item.status}>
                    <span>{item.status}</span>
                    <strong>{formatNumber(item.total)}</strong>
                  </div>
                ))}
              </div>
              <div className="divider" />
              <p className="muted">Abastecimento</p>
              <div className="stats-row">
                <div>
                  <p className="muted">Registros no mês</p>
                  <strong>{formatNumber(data.fuel?.month_logs ?? 0)}</strong>
                </div>
                <div>
                  <p className="muted">Litros no mês</p>
                  <strong>{formatNumber(data.fuel?.month_liters ?? 0)}</strong>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <div>
                  <p className="muted">Aplicativos & usuários</p>
                  <h4>Resumo</h4>
                </div>
              </div>
              <div className="chip-grid">
                <div className="chip ghost">
                  <span>Motoristas com viagem livre</span>
                  <strong>{formatNumber(data.drivers?.free_trip_enabled ?? 0)}</strong>
                </div>
                <div className="chip ghost">
                  <span>Cartões de estudante ativos</span>
                  <strong>{formatNumber(data.students?.cards_active ?? 0)}</strong>
                </div>
                <div className="chip ghost">
                  <span>Cartões a vencer</span>
                  <strong>{formatNumber(data.students?.cards_expiring_soon ?? 0)}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {showSection("planning") && (
        <section className="dashboard-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Planejamento & Demandas</p>
              <h3>Serviços, rotas e formulários</h3>
            </div>
            <span className="pill ghost">
              Rotas ativas {formatNumber(data.transport_planning?.routes_active ?? 0)}
            </span>
          </div>
          <div className="dashboard-grid three">
            <div className="card">
              <div className="card-head">
                <div>
                  <p className="muted">Planejamento</p>
                  <h4>Serviços e rotas</h4>
                </div>
              </div>
              <div className="chip-grid">
                <div className="chip ghost">
                  <span>Serviços ativos</span>
                  <strong>{formatNumber(data.transport_planning?.services ?? 0)}</strong>
                </div>
                <div className="chip ghost">
                  <span>Rotas ativas</span>
                  <strong>{formatNumber(data.transport_planning?.routes_active ?? 0)}</strong>
                </div>
                <div className="chip ghost">
                  <span>Rotas inativas</span>
                  <strong>{formatNumber(data.transport_planning?.routes_inactive ?? 0)}</strong>
                </div>
                <div className="chip ghost">
                  <span>Rotas sem escala hoje</span>
                  <strong>{formatNumber(data.transport_planning?.routes_without_assignment ?? 0)}</strong>
                </div>
              </div>
              <div className="divider" />
              <p className="muted">Escalas do dia</p>
              <div className="chip-grid">
                {(data.transport_planning?.assignments_today ?? []).map((item) => (
                  <div className="chip" key={item.status}>
                    <StatusBadge status={item.status} />
                    <strong>{formatNumber(item.total)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <div>
                  <p className="muted">Solicitações de serviço</p>
                  <h4>Status</h4>
                </div>
              </div>
              <div className="chip-grid">
                {(data.transport_planning?.applications_by_status ?? []).map((item) => (
                  <div className="chip ghost" key={item.status}>
                    <span>{item.status}</span>
                    <strong>{formatNumber(item.total)}</strong>
                  </div>
                ))}
              </div>
              <div className="divider" />
              <p className="muted">Formulários</p>
              <div className="chip-grid">
                <div className="chip ghost">
                  <span>Modelos ativos</span>
                  <strong>{formatNumber(data.forms?.templates_active ?? 0)}</strong>
                </div>
                {(data.forms?.submissions_by_status ?? []).map((item) => (
                  <div className="chip ghost" key={item.status}>
                    <span>{item.status}</span>
                    <strong>{formatNumber(item.total)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <div>
                  <p className="muted">Estudantes</p>
                  <h4>Inscritos e cartões</h4>
                </div>
              </div>
              <div className="chip-grid">
                <div className="chip ghost">
                  <span>Estudantes</span>
                  <strong>{formatNumber(data.students?.total ?? 0)}</strong>
                </div>
                {(data.students?.cards_by_status ?? []).map((item) => (
                  <div className="chip ghost" key={item.status}>
                    <span>{item.status}</span>
                    <strong>{formatNumber(item.total)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {showSection("cards") && (
        <section className="dashboard-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Carteirinhas</p>
              <h3>Acompanhamento e adesão</h3>
            </div>
            <span className="pill ghost">
              Válidas {formatNumber(data.student_cards?.cards_active ?? 0)}
            </span>
          </div>
          <div className="dashboard-grid three">
            <div className="card">
              <div className="card-head">
                <div>
                  <p className="muted">Resumo</p>
                  <h4>Carteirinhas emitidas</h4>
                </div>
              </div>
              <div className="chip-grid">
                <div className="chip ghost">
                  <span>Ativas (válidas)</span>
                  <strong>{formatNumber(data.student_cards?.cards_active ?? 0)}</strong>
                </div>
                <div className="chip ghost">
                  <span>Emitidas no mês</span>
                  <strong>{formatNumber(data.student_cards?.cards_issued_month ?? 0)}</strong>
                </div>
                <div className="chip ghost">
                  <span>Expiram em 30 dias</span>
                  <strong>{formatNumber(data.student_cards?.cards_expiring_soon ?? 0)}</strong>
                </div>
                <div className="chip ghost">
                  <span>Bloqueadas</span>
                  <strong>{formatNumber(data.student_cards?.cards_blocked ?? 0)}</strong>
                </div>
                <div className="chip ghost">
                  <span>Expiradas</span>
                  <strong>{formatNumber(data.student_cards?.cards_expired ?? 0)}</strong>
                </div>
                <div className="chip ghost">
                  <span>Substituídas</span>
                  <strong>{formatNumber(data.student_cards?.cards_replaced ?? 0)}</strong>
                </div>
              </div>
              <div className="divider" />
              <p className="muted">Inscrições aprovadas</p>
              <strong>{formatNumber(data.student_cards?.approved_submissions ?? 0)}</strong>
            </div>
            <div className="card">
              {cardStatusChart.length ? (
                <DonutChart data={cardStatusChart} title="Status das carteirinhas" height={260} />
              ) : (
                <p className="muted">Sem dados de status para carteirinhas.</p>
              )}
            </div>
            <div className="card">
              {shiftChart.length ? (
                <SimpleBarChart data={shiftChart} title="Alunos por turno" height={260} />
              ) : (
                <p className="muted">Sem dados de turnos informados.</p>
              )}
            </div>
          </div>
          <div className="dashboard-grid two">
            <div className="card">
              <div className="card-head">
                <div>
                  <p className="muted">Cursos</p>
                  <h4>Mais citados</h4>
                </div>
              </div>
              {courseChart.length ? (
                <div className="chip-grid">
                  {courseChart.map((item) => (
                    <div className="chip ghost" key={item.name}>
                      <span>{item.name}</span>
                      <strong>{formatNumber(item.value)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Sem dados de cursos informados.</p>
              )}
            </div>
            <div className="card">
              <div className="card-head">
                <div>
                  <p className="muted">Base cadastrada</p>
                  <h4>Estudantes e cartões</h4>
                </div>
              </div>
              <div className="stats-row">
                <div>
                  <p className="muted">Estudantes</p>
                  <strong>{formatNumber(data.students?.total ?? 0)}</strong>
                </div>
                <div>
                  <p className="muted">Carteirinhas</p>
                  <strong>{formatNumber(data.student_cards?.cards_total ?? 0)}</strong>
                </div>
              </div>
              <div className="divider" />
              <div className="stats-row">
                <div>
                  <p className="muted">Ativas (válidas)</p>
                  <strong>{formatNumber(data.student_cards?.cards_active ?? 0)}</strong>
                </div>
                <div>
                  <p className="muted">Inválidas</p>
                  <strong>{formatNumber(invalidCards)}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
