import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Table } from "../../components/Table";
import { Button } from "../../components/Button";
import { StatusBadge } from "../../components/StatusBadge";
import "../../styles/DataPage.css";

type FreeTrip = {
  id: number;
  driver: number;
  driver_name: string;
  vehicle: number;
  vehicle_plate: string;
  status: "OPEN" | "CLOSED";
  odometer_start: number;
  odometer_end?: number | null;
  started_at: string;
  ended_at?: string | null;
  distance?: number | null;
  incidents_count?: number;
};

type Incident = { id: number; description: string; created_at: string };

type Option = { id: number; label: string };

export const FreeTripsPage = () => {
  const [freeTrips, setFreeTrips] = useState<FreeTrip[]>([]);
  const [drivers, setDrivers] = useState<Option[]>([]);
  const [vehicles, setVehicles] = useState<Option[]>([]);
  const [selected, setSelected] = useState<FreeTrip | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentText, setIncidentText] = useState("");
  const [filters, setFilters] = useState<{ status: string; driver: string; vehicle: string }>({
    status: "",
    driver: "",
    vehicle: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incidentsLoading, setIncidentsLoading] = useState(false);

  const loadFiltersData = () => {
    api
      .get("/drivers/", { params: { page_size: 200 } })
      .then((res) => {
        const data = (res.data as any).results ?? res.data ?? [];
        setDrivers(data.map((d: any) => ({ id: d.id, label: d.name })));
      })
      .catch(() => { });
    api
      .get("/vehicles/", { params: { page_size: 200 } })
      .then((res) => {
        const data = (res.data as any).results ?? res.data ?? [];
        setVehicles(data.map((v: any) => ({ id: v.id, label: `${v.license_plate} - ${v.brand} ${v.model}` })));
      })
      .catch(() => { });
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<FreeTrip[]>("/trips/free-trips/", {
        params: {
          status: filters.status || undefined,
          driver_id: filters.driver || undefined,
          vehicle_id: filters.vehicle || undefined,
          ordering: "-started_at",
        },
      });
      const rows = (Array.isArray(data) ? data : (data as any).results ?? []) as FreeTrip[];
      setFreeTrips(rows);
      if (selected) {
        const stillExists = rows.find((r) => r.id === selected.id);
        setSelected(stillExists || null);
        if (stillExists) loadIncidents(stillExists.id);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao carregar viagens livres.");
    } finally {
      setLoading(false);
    }
  };

  const loadIncidents = async (id: number) => {
    setIncidentsLoading(true);
    try {
      const { data } = await api.get<Incident[]>(`/trips/free-trips/${id}/incidents/`);
      setIncidents(data);
    } catch {
      setIncidents([]);
    } finally {
      setIncidentsLoading(false);
    }
  };

  const addIncident = async () => {
    if (!selected || !incidentText.trim()) return;
    try {
      await api.post(`/trips/free-trips/${selected.id}/incidents/`, { description: incidentText });
      setIncidentText("");
      loadIncidents(selected.id);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Falha ao registrar ocorrência.");
    }
  };

  useEffect(() => {
    loadFiltersData();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusLabel = (value: string) => (value === "OPEN" ? "Em aberto" : "Encerrada");
  const formatDateTime = (value?: string | null) =>
    value ? new Date(value).toLocaleString("pt-BR") : "—";

  return (
    <div className="data-page">
      <div className="data-header">
        <div>
          <h1 className="data-title">Viagens livres</h1>
          <p className="data-subtitle">
            Monitoramento de veículos em uso livre: quem está com qual carro, trocas e quilômetros rodados.
          </p>
        </div>
        <Button variant="ghost" onClick={load}>
          Recarregar
        </Button>
      </div>

      <div className="card" style={{ marginBottom: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">Status</option>
          <option value="OPEN">Em aberto</option>
          <option value="CLOSED">Encerrada</option>
        </select>
        <select value={filters.driver} onChange={(e) => setFilters((f) => ({ ...f, driver: e.target.value }))}>
          <option value="">Motorista</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <select value={filters.vehicle} onChange={(e) => setFilters((f) => ({ ...f, vehicle: e.target.value }))}>
          <option value="">Veículo</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <Button onClick={load}>Filtrar</Button>
      </div>

      {error && <div className="data-error">{error}</div>}

      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr", gap: "1rem" }}>
        <div className="card">
          {loading ? (
            <p>Carregando...</p>
          ) : (
            <Table
              columns={[
                { key: "driver_name", label: "Motorista" },
                { key: "vehicle_plate", label: "Veículo" },
                { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
                { key: "odometer_start", label: "KM inicial" },
                { key: "odometer_end", label: "KM final", render: (row) => row.odometer_end ?? "—" },
                { key: "distance", label: "Rodado", render: (row) => (row.distance ?? "—") },
                { key: "started_at", label: "Início", render: (row) => formatDateTime(row.started_at) },
                { key: "ended_at", label: "Fim", render: (row) => formatDateTime(row.ended_at) },
                {
                  key: "actions",
                  label: "Ocorrências",
                  render: (row) => (
                    <Button variant="ghost" onClick={() => { setSelected(row); loadIncidents(row.id); }}>
                      {row.incidents_count ?? 0} ver
                    </Button>
                  ),
                },
              ]}
              data={freeTrips}
            />
          )}
        </div>

        <div className="card">
          <h3>Detalhes e ocorrências</h3>
          {!selected ? (
            <p className="muted">Selecione uma viagem livre para ver detalhes.</p>
          ) : (
            <div className="grid" style={{ gap: "0.5rem" }}>
              <div>
                <strong>Motorista:</strong> {selected.driver_name}
              </div>
              <div>
                <strong>Veículo:</strong> {selected.vehicle_plate}
              </div>
              <div>
                <strong>Status:</strong> {statusLabel(selected.status)}
              </div>
              <div>
                <strong>KM:</strong> {selected.odometer_start} → {selected.odometer_end ?? "—"}{" "}
                {selected.distance != null && <span className="muted">({selected.distance} km)</span>}
              </div>
              <div>
                <strong>Início:</strong> {formatDateTime(selected.started_at)}
              </div>
              <div>
                <strong>Fim:</strong> {formatDateTime(selected.ended_at)}
              </div>

              <div className="divider" />
              <h4>Ocorrências</h4>
              {incidentsLoading ? (
                <p className="muted">Carregando ocorrências...</p>
              ) : incidents.length === 0 ? (
                <p className="muted">Sem ocorrências registradas.</p>
              ) : (
                <div className="status-list">
                  {incidents.map((inc) => (
                    <div key={inc.id} className="status-item">
                      <div className="status-item__top">
                        <div>
                          <p className="eyebrow">Registrado em</p>
                          <strong>{formatDateTime(inc.created_at)}</strong>
                        </div>
                      </div>
                      <p className="muted">{inc.description}</p>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                rows={3}
                placeholder="Relatar ocorrência desta viagem"
                value={incidentText}
                onChange={(e) => setIncidentText(e.target.value)}
              />
              <Button onClick={addIncident} disabled={!incidentText.trim()}>
                Registrar ocorrência
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
