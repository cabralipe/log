import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
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
    <div className="reports-page grid">
      <div className="card reports-hero">
        <div>
          <p className="eyebrow">BI Operacional</p>
          <h2>Painel de relatórios</h2>
          <p className="muted">Filtros rápidos, gráficos interativos e exportação flexível em XLSX.</p>
          <div className="hero-badges">
            <span className="pill">Veículos: {dashboard?.summary?.total_vehicles ?? dashboard?.total_vehicles ?? "—"}</span>
            <span className="pill">Viagens no mês: {dashboard?.summary?.trips_month_total ?? dashboard?.trips_month_total ?? "—"}</span>
            <span className="pill">Incidentes: {incidents.length}</span>
          </div>
        </div>
        <div className="filters">
          <div className="filter-row">
            <label>
              Início do período
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters((prev) => ({ ...prev, start_date: e.target.value }))}
              />
            </label>
            <label>
              Fim do período
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters((prev) => ({ ...prev, end_date: e.target.value }))}
              />
            </label>
          </div>
          <div className="filter-row quick-ranges">
            {quickRanges.map((range) => (
              <button
                key={range.label}
                type="button"
                className="pill ghost"
                onClick={() =>
                  setFilters({
                    start_date: range.start,
                    end_date: toInputDate(new Date()),
                  })
                }
              >
                {range.label}
              </button>
            ))}
            <button type="button" className="pill ghost" onClick={() => setFilters({ start_date: "", end_date: "" })}>
              Limpar
            </button>
            <Button type="button" variant="primary" onClick={loadReports}>
              Atualizar {loading ? "..." : ""}
            </Button>
          </div>
        </div>
      </div>

      <div className="insights-grid">
        <InsightCard
          title="Viagens no período"
          value={tripSummary?.total ?? 0}
          hint={`Passageiros: ${tripSummary?.total_passengers ?? 0}`}
        />
        <InsightCard title="KM rodados" value={totalKm} hint="Soma do odômetro filtrado" />
        <InsightCard title="Litros abastecidos" value={fuelSummary?.total_liters ?? 0} hint={`Registros: ${fuelSummary?.total_logs ?? 0}`} />
        <InsightCard title="Incidentes registrados" value={incidents.length} hint="Ocorrências de viagem" tone="danger" />
      </div>

      <div className="chart-grid">
        <div className="card chart-card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Viagens</p>
              <h3>Status das viagens</h3>
            </div>
            <span className="pill ghost">{tripSummary?.total ?? 0} total</span>
          </div>
          <DonutChart
            data={tripsByStatus.map((item) => ({
              label: item.status,
              value: item.total,
            }))}
          />
          <div className="chart-legend">
            {tripsByStatus.map((item, idx) => (
              <span key={item.status} className="legend-item">
                <span className="dot" data-index={idx} />
                {item.status} · {item.total}
              </span>
            ))}
          </div>
        </div>

        <div className="card chart-card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Rotas</p>
              <h3>Categorias mais rodadas</h3>
            </div>
            <span className="pill ghost">Top {tripsByCategory.length || 1}</span>
          </div>
          <BarChart data={tripsByCategory} unit="viagens" />
        </div>

        <div className="card chart-card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Veículos</p>
              <h3>KM por placa</h3>
            </div>
            <span className="pill ghost">Top 6</span>
          </div>
          <BarChart data={odometerTop} unit="km" />
        </div>

        <div className="card chart-card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Abastecimentos</p>
              <h3>Litros por dia</h3>
            </div>
            <span className="pill ghost">{fuelByDay.length} dias</span>
          </div>
          <TrendLine data={fuelByDay} />
        </div>

        <div className="card chart-card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Segurança</p>
              <h3>Ocorrências no tempo</h3>
            </div>
            <span className="pill ghost">{incidentsTrend.length} dias</span>
          </div>
          <TrendLine data={incidentsTrend} tone="danger" />
        </div>

        <div className="card chart-card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Postos</p>
              <h3>Litros por fornecedor</h3>
            </div>
            <span className="pill ghost">Top 5</span>
          </div>
          <BarChart data={fuelByStation} unit="L" />
        </div>
      </div>

      <div className="data-grid">
        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Viagens</p>
              <h3>Detalhes das viagens</h3>
            </div>
          </div>
          <Table
            columns={[
              { key: "origin", label: "Origem" },
              { key: "destination", label: "Destino" },
              { key: "category", label: "Categoria" },
              { key: "status", label: "Status" },
              { key: "departure_datetime", label: "Saída" },
              { key: "return_datetime_expected", label: "Retorno" },
              { key: "vehicle__license_plate", label: "Veículo" },
              { key: "driver__name", label: "Motorista" },
            ]}
            data={trips}
          />
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Abastecimentos</p>
              <h3>Histórico de abastecimentos</h3>
            </div>
            {fuelSummary && (
              <span className="pill ghost">
                Registros {fuelSummary.total_logs} · Litros {formatNumber(fuelSummary.total_liters)}
              </span>
            )}
          </div>
          <Table
            columns={[
              { key: "filled_at", label: "Data" },
              { key: "fuel_station", label: "Posto" },
              { key: "liters", label: "Litros" },
              { key: "vehicle__license_plate", label: "Veículo" },
              { key: "driver__name", label: "Motorista" },
              { key: "receipt_image", label: "Comprovante", render: (row) => (row.receipt_image ? <a href={row.receipt_image}>Ver</a> : "—") },
            ]}
            data={fuelLogs}
          />
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Ocorrências</p>
              <h3>Ocorrências registradas</h3>
            </div>
            <span className="pill ghost">{incidents.length} itens</span>
          </div>
          <Table
            columns={[
              { key: "created_at", label: "Registrado em" },
              { key: "trip_id", label: "Viagem" },
              {
                key: "trip__origin",
                label: "Rota",
                render: (row) => (
                  <span>
                    {row.trip__origin} → {row.trip__destination}
                  </span>
                ),
              },
              { key: "trip__departure_datetime", label: "Saída" },
              { key: "driver__name", label: "Motorista" },
              { key: "description", label: "Relato" },
            ]}
            data={incidents}
          />
        </div>
      </div>

      <div className="card export-card">
        <div className="card-head">
          <div>
            <p className="eyebrow">Exportação</p>
            <h3>Monte seu XLSX</h3>
            <p className="muted">Selecione o conjunto de dados e marque apenas as colunas que quer levar para o Excel.</p>
          </div>
          <Button type="button" onClick={handleExport} disabled={!datasetRowsCount[exportConfig.dataset]}>
            Exportar XLSX
          </Button>
        </div>
        <div className="export-body">
          <div className="export-datasets">
            {(Object.keys(EXPORT_COLUMNS) as ExportDatasetKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`pill ${exportConfig.dataset === key ? "active" : "ghost"}`}
                onClick={() => changeDataset(key)}
              >
                {key === "trips" && "Viagens"}
                {key === "fuel" && "Abastecimentos"}
                {key === "odometer" && "Quilometragem"}
                {key === "incidents" && "Ocorrências"}
                <span className="pill-count">{datasetRowsCount[key] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="columns-grid">
            {Object.entries(EXPORT_COLUMNS[exportConfig.dataset]).map(([key, label]) => (
              <label key={key} className={`column-chip ${exportConfig.columns.includes(key) ? "selected" : ""}`}>
                <input
                  type="checkbox"
                  checked={exportConfig.columns.includes(key)}
                  onChange={() => toggleColumn(key)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {!datasetRowsCount[exportConfig.dataset] && <p className="muted">Não há dados neste conjunto com os filtros atuais.</p>}
        </div>
      </div>
    </div>
  );
};

const InsightCard = ({ title, value, hint, tone = "default" }: { title: string; value: number; hint?: string; tone?: "default" | "danger" }) => (
  <div className={`insight-card ${tone === "danger" ? "danger" : ""}`}>
    <p className="muted">{title}</p>
    <strong>{formatNumber(value)}</strong>
    {hint && <span className="muted">{hint}</span>}
  </div>
);

const BarChart = ({ data, unit }: { data: ChartDatum[]; unit?: string }) => {
  if (!data.length) return <p className="muted">Sem dados para plotar.</p>;
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="bar-chart">
      {data.map((item, idx) => (
        <div key={item.label} className="bar-row">
          <div className="bar-label">
            <span className="dot" data-index={idx} />
            <span>{item.label}</span>
          </div>
          <div className="bar-track" title={`${item.value} ${unit ?? ""}`}>
            <div className="bar-fill" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          <span className="bar-value">
            {formatNumber(item.value)} {unit}
          </span>
        </div>
      ))}
    </div>
  );
};

const DonutChart = ({ data }: { data: ChartDatum[] }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!total) return <p className="muted">Sem dados para plotar.</p>;
  let start = 0;
  const segments = data.map((item) => {
    const angle = (item.value / total) * 360;
    const segment = { from: start, to: start + angle, label: item.label };
    start += angle;
    return segment;
  });
  const gradient = segments
    .map((segment, idx) => {
      const from = segment.from;
      const to = segment.to;
      const palette = ["#4ade80", "#22d3ee", "#a78bfa", "#fbbf24", "#f472b6", "#f97316"];
      const color = palette[idx % palette.length];
      return `${color} ${from}deg ${to}deg`;
    })
    .join(", ");

  return (
    <div className="donut-wrap">
      <div className="donut" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="donut-center">
          <strong>{formatNumber(total)}</strong>
          <span className="muted">Total</span>
        </div>
      </div>
    </div>
  );
};

const TrendLine = ({ data, tone = "default" }: { data: ChartDatum[]; tone?: "default" | "danger" }) => {
  if (!data.length) return <p className="muted">Sem dados para plotar.</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 240;
  const height = 120;
  const points = data.map((item, idx) => {
    const x = (idx / Math.max(1, data.length - 1)) * width;
    const y = height - (item.value / max) * height;
    return `${x},${y}`;
  });
  return (
    <div className="trend">
      <svg viewBox={`0 0 ${width} ${height}`}>
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={tone === "danger" ? "#f87171" : "#4ade80"}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="trend-meta">
        <span className="muted">Período: {data[0].label} → {data[data.length - 1].label}</span>
        <span className="muted">Picos: {formatNumber(max)}</span>
      </div>
    </div>
  );
};
