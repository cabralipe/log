import { useEffect, useMemo, useState } from "react";
import "./Dashboard.css";
import { api } from "../lib/api";
import { Card } from "../components/Card";
import { Table } from "../components/Table";
import { StatusBadge } from "../components/StatusBadge";

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
  tires: { status_counts: CountItem[]; nearing_end_of_life: TireNear[] };
  // campos antigos preservados para compatibilidade
  total_vehicles?: number;
  trips_month_total?: number;
  vehicles_by_status?: CountItem[];
  trips_by_status?: CountItem[];
  odometer_month?: OdometerApiRow[];
  maintenance_alerts?: MaintenanceAlert[];
};

type TabKey = "overview" | "fleet" | "operations" | "maintenance" | "contracts" | "planning";

const formatNumber = (value?: number | string | null) => {
  if (value === null || value === undefined) return "0";
  const numeric = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(numeric)) return String(value);
  return numeric.toLocaleString("pt-BR");
};
const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("pt-BR") : "-");

export const DashboardPage = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");

  useEffect(() => {
    api
      .get<DashboardData>("/reports/dashboard/")
      .then((res) => setData(res.data))
      .catch(() => setData(null));
  }, []);

  const odometerRows: OdometerRow[] = useMemo(
    () =>
      (data?.vehicles?.odometer_month ?? data?.odometer_month ?? []).map((row, idx) => ({
        ...row,
        id: row.vehicle_id ?? row.vehicle__license_plate ?? idx,
      })),
    [data?.odometer_month, data?.vehicles?.odometer_month]
  );

  if (!data) return <p className="muted">Carregando dashboard...</p>;

  const tripsMonth = data.summary?.trips_month_total ?? data.trips?.month_total ?? data.trips_month_total ?? 0;
  const vehiclesTotal = data.summary?.total_vehicles ?? data.total_vehicles ?? data.vehicles?.total ?? 0;
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

  return (
    <div className="dashboard-page">
      <div className="dashboard-tabs">
        {[
          { key: "overview", label: "Visão geral" },
          { key: "fleet", label: "Frota & Pessoas" },
          { key: "operations", label: "Operação" },
          { key: "maintenance", label: "Manutenção & Estoque" },
          { key: "contracts", label: "Contratos & Custos" },
          { key: "planning", label: "Planejamento & Demandas" },
        ].map((item) => (
          <button key={item.key} className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key as TabKey)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="dashboard-hero card">
          <div>
            <p className="eyebrow">Visão geral</p>
            <h2>Resumo operacional</h2>
            <p className="muted">
              Estatísticas consolidadas de frota, viagens, contratos, manutenção, planejamento de rotas e atendimento.
            </p>
            <div className="hero-badges">
              <span className="pill">Frota {formatNumber(vehiclesTotal)}</span>
              <span className="pill">Viagens mês {formatNumber(tripsMonth)}</span>
              <span className="pill">Abastecimentos {formatNumber(data.fuel?.month_logs ?? 0)}</span>
              <span className="pill">OS abertas {formatNumber(data.summary?.open_service_orders ?? 0)}</span>
            </div>
          </div>
          <div className="summary-grid">
            {summaryCards.map((item) => (
              <Card key={item.title} title={item.title} value={item.value} hint={item.hint} />
            ))}
          </div>
        </div>
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
    </div>
  );
};
