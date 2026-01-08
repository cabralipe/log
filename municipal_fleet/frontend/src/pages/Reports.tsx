import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { AreaTrendChart, DonutChart, SimpleBarChart } from "../components/Charts";
import { MapPin, Gauge, Fuel, AlertTriangle, Download } from "lucide-react";
import "./Reports.css";

type DashboardData = {
  summary?: {
    total_vehicles?: number;
    trips_month_total?: number;
  };
  total_vehicles?: number;
  trips_month_total?: number;
};

type OdometerApiRow = { vehicle_id?: number; vehicle__license_plate: string; kilometers: number };
type OdometerRow = OdometerApiRow & { id: number | string };
type TripRow = {
  id: number;
  origin: string;
  destination: string;
  category: string;
  status: string;
  departure_datetime: string;
  return_datetime_expected: string;
  passengers_count: number;
  vehicle__license_plate: string;
  driver__name: string;
};

type TripSummary = {
  total: number;
  total_passengers: number;
  by_status: { status: string; total: number }[];
};

type FuelLogRow = {
  id: number;
  filled_at: string;
  liters: number;
  fuel_station: string;
  notes?: string;
  vehicle__license_plate: string;
  driver__name: string;
  receipt_image?: string;
};

type FuelSummary = { total_logs: number; total_liters: number };

type TripIncidentRow = {
  id: number;
  trip_id: number;
  trip__origin: string;
  trip__destination: string;
  trip__departure_datetime: string;
  driver__name: string;
  description: string;
  created_at: string;
};

type Filters = { start_date: string; end_date: string };
type ExportDatasetKey = "trips" | "fuel" | "odometer" | "incidents";
type ExportConfig = { dataset: ExportDatasetKey; columns: string[] };
type ChartDatum = { label: string; value: number; color?: string; hint?: string };

const EXPORT_COLUMNS: Record<ExportDatasetKey, Record<string, string>> = {
  trips: {
    origin: "Origem",
    destination: "Destino",
    category: "Categoria",
    status: "Status",
    departure_datetime: "Saída",
    return_datetime_expected: "Retorno",
    passengers_count: "Passageiros",
    vehicle__license_plate: "Veículo",
    driver__name: "Motorista",
  },
  fuel: {
    filled_at: "Data",
    fuel_station: "Posto",
    liters: "Litros",
    vehicle__license_plate: "Veículo",
    driver__name: "Motorista",
    notes: "Observações",
  },
  odometer: {
    vehicle__license_plate: "Veículo",
    kilometers: "KM rodados",
  },
  incidents: {
    created_at: "Registrado em",
    trip_id: "Viagem",
    trip__origin: "Origem",
    trip__destination: "Destino",
    driver__name: "Motorista",
    description: "Relato",
  },
};

const DEFAULT_COLUMNS: Record<ExportDatasetKey, string[]> = {
  trips: ["origin", "destination", "status", "departure_datetime", "vehicle__license_plate", "driver__name"],
  fuel: ["filled_at", "fuel_station", "liters", "vehicle__license_plate"],
  odometer: ["vehicle__license_plate", "kilometers"],
  incidents: ["created_at", "trip_id", "driver__name", "description"],
};

const toInputDate = (value: Date) => value.toISOString().split("T")[0];
const formatNumber = (value: number) => value.toLocaleString("pt-BR");
const formatDate = (value: string) => new Date(value).toLocaleDateString("pt-BR");
const formatDateTime = (value: string) => new Date(value).toLocaleString("pt-BR");

export const ReportsPage = () => {
  const [filters, setFilters] = useState<Filters>({ start_date: "", end_date: "" });
  const [loading, setLoading] = useState(false);
  const [odometer, setOdometer] = useState<OdometerRow[]>([]);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [tripSummary, setTripSummary] = useState<TripSummary | null>(null);
  const [fuelLogs, setFuelLogs] = useState<FuelLogRow[]>([]);
  const [fuelSummary, setFuelSummary] = useState<FuelSummary | null>(null);
  const [incidents, setIncidents] = useState<TripIncidentRow[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [exportConfig, setExportConfig] = useState<ExportConfig>({ dataset: "trips", columns: DEFAULT_COLUMNS.trips });

  useEffect(() => {
    api
      .get<DashboardData>("/reports/dashboard/")
      .then((res) => setDashboard(res.data))
      .catch(() => null);
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    const params = {
      ...(filters.start_date ? { start_date: filters.start_date } : {}),
      ...(filters.end_date ? { end_date: filters.end_date } : {}),
    };
    try {
      const [odoRes, tripRes, fuelRes, incidentsRes] = await Promise.all([
        api.get<OdometerApiRow[]>("/reports/odometer/", { params }),
        api.get<{ summary: TripSummary; trips: TripRow[] }>("/reports/trips/", { params }),
        api.get<{ summary: FuelSummary; logs: FuelLogRow[] }>("/reports/fuel/", { params }),
        api.get<{ incidents: TripIncidentRow[] }>("/reports/trip-incidents/"),
      ]);
      setOdometer(
        odoRes.data.map((row) => ({
          ...row,
          id: row.vehicle_id ?? row.vehicle__license_plate,
        }))
      );
      setTripSummary(tripRes.data.summary);
      setTrips(tripRes.data.trips);
      setFuelSummary(fuelRes.data.summary);
      setFuelLogs(fuelRes.data.logs);
      setIncidents(incidentsRes.data.incidents);
    } finally {
      setLoading(false);
    }
  }, [filters.end_date, filters.start_date]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const totalKm = useMemo(() => odometer.reduce((acc, item) => acc + (item.kilometers || 0), 0), [odometer]);
  const tripsByCategory = useMemo(() => {
    const grouped: Record<string, number> = {};
    trips.forEach((item) => {
      if (!item.category) return;
      grouped[item.category] = (grouped[item.category] ?? 0) + 1;
    });
    return Object.entries(grouped).map<ChartDatum>(([label, value]) => ({ label, value }));
  }, [trips]);
  const odometerTop = useMemo(
    () =>
      odometer
        .slice()
        .sort((a, b) => b.kilometers - a.kilometers)
        .slice(0, 6)
        .map((item) => ({ label: item.vehicle__license_plate, value: item.kilometers })),
    [odometer]
  );
  const fuelByDay = useMemo(() => {
    const grouped: Record<string, number> = {};
    fuelLogs.forEach((log) => {
      const day = log.filled_at?.slice(0, 10);
      if (!day) return;
      grouped[day] = (grouped[day] ?? 0) + Number(log.liters || 0);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map<ChartDatum>(([label, value]) => ({ label, value }));
  }, [fuelLogs]);
  const incidentsTrend = useMemo(() => {
    const grouped: Record<string, number> = {};
    incidents.forEach((item) => {
      const day = item.created_at.slice(0, 10);
      grouped[day] = (grouped[day] ?? 0) + 1;
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map<ChartDatum>(([label, value]) => ({ label, value }));
  }, [incidents]);
  const tripsByStatus = useMemo(() => tripSummary?.by_status ?? [], [tripSummary]);
  const fuelByStation = useMemo(() => {
    const grouped: Record<string, number> = {};
    fuelLogs.forEach((log) => {
      if (!log.fuel_station) return;
      grouped[log.fuel_station] = (grouped[log.fuel_station] ?? 0) + Number(log.liters || 0);
    });
    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map<ChartDatum>(([label, value]) => ({ label, value }));
  }, [fuelLogs]);

  const quickRanges = [
    { label: "Últimos 30 dias", start: toInputDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) },
    { label: "Últimos 90 dias", start: toInputDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) },
    { label: "Ano corrente", start: `${new Date().getFullYear()}-01-01` },
  ];

  const datasetRowsCount: Record<ExportDatasetKey, number> = {
    trips: trips.length,
    fuel: fuelLogs.length,
    odometer: odometer.length,
    incidents: incidents.length,
  };

  const handleExport = () => {
    const dataset = exportConfig.dataset;
    const rows =
      dataset === "trips"
        ? trips
        : dataset === "fuel"
          ? fuelLogs
          : dataset === "odometer"
            ? odometer
            : incidents;
    if (!rows.length) return;
    const columns = exportConfig.columns.length ? exportConfig.columns : DEFAULT_COLUMNS[dataset];
    const table = rows.map((row) => {
      const line: Record<string, any> = {};
      columns.forEach((key) => {
        const label = EXPORT_COLUMNS[dataset][key];
        const raw = (row as any)[key];
        if (raw === null || raw === undefined) {
          line[label] = "";
          return;
        }
        if (typeof raw === "string" && key.includes("date")) {
          line[label] = key.includes("datetime") ? formatDateTime(raw) : formatDate(raw);
          return;
        }
        if (key === "created_at" || key === "trip__departure_datetime") {
          line[label] = formatDateTime(raw);
          return;
        }
        line[label] = raw;
      });
      return line;
    });
    const worksheet = XLSX.utils.json_to_sheet(table);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, EXPORT_COLUMNS[dataset].vehicle__license_plate ? "Dados" : dataset);
    XLSX.writeFile(workbook, `relatorio-${dataset}-${toInputDate(new Date())}.xlsx`);
  };

  const toggleColumn = (key: string) => {
    setExportConfig((prev) => {
      const exists = prev.columns.includes(key);
      if (exists && prev.columns.length === 1) return prev;
      return {
        ...prev,
        columns: exists ? prev.columns.filter((item) => item !== key) : [...prev.columns, key],
      };
    });
  };

  const changeDataset = (dataset: ExportDatasetKey) => {
    setExportConfig({ dataset, columns: DEFAULT_COLUMNS[dataset] });
  };

  return (
    <div className="reports-page">
      <div className="reports-header card">
        <div>
          <p className="eyebrow">BI Operacional</p>
          <h2>Painel de Relatórios</h2>
          <p className="muted">Análise detalhada de frota, custos e eficiência operacional.</p>
        </div>
        <div className="reports-actions">
          <div className="date-range">
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters((prev) => ({ ...prev, start_date: e.target.value }))}
            />
            <span className="separator">até</span>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters((prev) => ({ ...prev, end_date: e.target.value }))}
            />
          </div>
          <div className="quick-filters">
            {quickRanges.map((range) => (
              <button
                key={range.label}
                className="pill ghost"
                onClick={() => setFilters({ start_date: range.start, end_date: toInputDate(new Date()) })}
              >
                {range.label}
              </button>
            ))}
            <Button variant="primary" onClick={loadReports} disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar Dados"}
            </Button>
          </div>
        </div>
      </div>

      <div className="kpi-grid">
        <InsightCard
          title="Total de Viagens"
          value={tripSummary?.total ?? 0}
          hint={`${tripSummary?.total_passengers ?? 0} passageiros transportados`}
          icon={<MapPin size={20} />}
        />
        <InsightCard
          title="Quilometragem"
          value={totalKm}
          hint="Total percorrido no período"
          icon={<Gauge size={20} />}
        />
        <InsightCard
          title="Consumo de Combustível"
          value={fuelSummary?.total_liters ?? 0}
          hint={`${fuelSummary?.total_logs ?? 0} abastecimentos registrados`}
          icon={<Fuel size={20} />}
        />
        <InsightCard
          title="Ocorrências"
          value={incidents.length}
          hint="Incidentes operacionais"
          tone="danger"
          icon={<AlertTriangle size={20} />}
        />
      </div>

      <div className="analytics-grid">
        <div className="chart-section main">
          <div className="card chart-card">
            <div className="card-head">
              <div>
                <h4>Evolução de Abastecimentos</h4>
                <p className="muted">Litros por dia</p>
              </div>
            </div>
            <div className="chart-wrapper">
              <AreaTrendChart
                data={fuelByDay.map(d => ({ name: new Date(d.label).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), value: d.value }))}
                title=""
                height={300}
              />
            </div>
          </div>
        </div>

        <div className="chart-section side">
          <div className="card chart-card">
            <div className="card-head">
              <div>
                <h4>Status das Viagens</h4>
                <p className="muted">Distribuição por situação</p>
              </div>
            </div>
            <div className="chart-wrapper">
              <DonutChart
                data={tripsByStatus.map(d => ({ label: d.status, value: d.total }))}
                title=""
                height={250}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="analytics-grid three-cols">
        <div className="card chart-card">
          <div className="card-head">
            <h4>Top Categorias</h4>
          </div>
          <SimpleBarChart
            data={tripsByCategory.map(d => ({ name: d.label, value: d.value }))}
            title=""
            height={220}
          />
        </div>
        <div className="card chart-card">
          <div className="card-head">
            <h4>Veículos mais utilizados (KM)</h4>
          </div>
          <SimpleBarChart
            data={odometerTop.map(d => ({ name: d.label.slice(0, 7), value: d.value }))}
            title=""
            height={220}
          />
        </div>
        <div className="card chart-card">
          <div className="card-head">
            <h4>Abastecimento por Posto</h4>
          </div>
          <SimpleBarChart
            data={fuelByStation.map(d => ({ name: d.label, value: d.value }))}
            title=""
            height={220}
          />
        </div>
      </div>

      <div className="data-tables-section">
        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Detalhamento</p>
              <h3>Dados Brutos</h3>
            </div>
            <div className="export-controls">
              <div className="dataset-selector">
                {(Object.keys(EXPORT_COLUMNS) as ExportDatasetKey[]).map((key) => (
                  <button
                    key={key}
                    className={`pill ${exportConfig.dataset === key ? "active" : "ghost"}`}
                    onClick={() => changeDataset(key)}
                  >
                    {key === "trips" && "Viagens"}
                    {key === "fuel" && "Combustível"}
                    {key === "odometer" && "KM"}
                    {key === "incidents" && "Incidentes"}
                  </button>
                ))}
              </div>
              <Button variant="ghost" onClick={handleExport} disabled={!datasetRowsCount[exportConfig.dataset]}>
                <Download size={16} /> Exportar Excel
              </Button>
            </div>
          </div>

          <div className="table-container">
            {exportConfig.dataset === "trips" && (
              <Table
                columns={[
                  { key: "origin", label: "Origem" },
                  { key: "destination", label: "Destino" },
                  { key: "status", label: "Status", render: (row) => <span className="status-text">{row.status}</span> },
                  { key: "departure_datetime", label: "Saída", render: (row) => formatDateTime(row.departure_datetime) },
                  { key: "vehicle__license_plate", label: "Veículo" },
                  { key: "driver__name", label: "Motorista" },
                ]}
                data={trips}
              />
            )}
            {exportConfig.dataset === "fuel" && (
              <Table
                columns={[
                  { key: "filled_at", label: "Data", render: (row) => formatDate(row.filled_at) },
                  { key: "fuel_station", label: "Posto" },
                  { key: "liters", label: "Litros", render: (row) => `${row.liters} L` },
                  { key: "vehicle__license_plate", label: "Veículo" },
                  { key: "driver__name", label: "Motorista" },
                ]}
                data={fuelLogs}
              />
            )}
            {exportConfig.dataset === "odometer" && (
              <Table
                columns={[
                  { key: "vehicle__license_plate", label: "Veículo" },
                  { key: "kilometers", label: "KM Atual", render: (row) => `${formatNumber(row.kilometers)} km` },
                ]}
                data={odometer}
              />
            )}
            {exportConfig.dataset === "incidents" && (
              <Table
                columns={[
                  { key: "created_at", label: "Data", render: (row) => formatDate(row.created_at) },
                  { key: "trip_id", label: "Viagem", render: (row) => `#${row.trip_id}` },
                  { key: "driver__name", label: "Motorista" },
                  { key: "description", label: "Relato" },
                ]}
                data={incidents}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const InsightCard = ({ title, value, hint, tone = "default", icon }: { title: string; value: number; hint?: string; tone?: "default" | "danger"; icon?: React.ReactNode }) => (
  <div className={`insight-card ${tone}`}>
    <div className="insight-icon">{icon}</div>
    <div className="insight-content">
      <p className="muted">{title}</p>
      <strong>{formatNumber(value)}</strong>
      {hint && <span className="hint">{hint}</span>}
    </div>
  </div>
);
