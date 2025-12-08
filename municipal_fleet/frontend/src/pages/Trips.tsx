import { useEffect, useState } from "react";
import { api, type Paginated } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { Pagination } from "../components/Pagination";

type Vehicle = { id: number; license_plate: string; max_passengers: number };
type Driver = { id: number; name: string };
type Trip = {
  id: number;
  origin: string;
  destination: string;
  departure_datetime: string;
  return_datetime_expected: string;
  return_datetime_actual?: string | null;
  status: string;
  vehicle: number;
  driver: number;
  passengers_count: number;
  odometer_start: number;
  odometer_end?: number | null;
  wa_link?: string;
};

export const TripsPage = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Trip>>({
    status: "PLANNED",
    passengers_count: 0,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [completion, setCompletion] = useState<{ tripId: number | ""; odometer_end: number | ""; return_datetime_actual: string }>({
    tripId: "",
    odometer_end: "",
    return_datetime_actual: "",
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = (nextPage = page, nextSearch = search, nextStatus = statusFilter, nextPageSize = pageSize) => {
    api
      .get<Paginated<Trip>>("/trips/", {
        params: { page: nextPage, page_size: nextPageSize, search: nextSearch, status: nextStatus || undefined },
      })
      .then((res) => {
        const data = res.data as any;
        if (Array.isArray(data)) {
          setTrips(data);
          setTotal(data.length);
        } else {
          setTrips(data.results);
          setTotal(data.count);
        }
        setError(null);
      })
      .catch((err) => setError(err.response?.data?.detail || "Erro ao carregar viagens."));
    api.get<Paginated<Vehicle>>("/vehicles/", { params: { page_size: 100 } }).then((res) => {
      const data = res.data as any;
      setVehicles(Array.isArray(data) ? data : data.results);
    });
    api.get<Paginated<Driver>>("/drivers/", { params: { page_size: 100 } }).then((res) => {
      const data = res.data as any;
      setDrivers(Array.isArray(data) ? data : data.results);
    });
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await api.patch(`/trips/${editingId}/`, form);
    } else {
      await api.post("/trips/", form);
    }
    setForm({ status: "PLANNED", passengers_count: 0 });
    setEditingId(null);
    load();
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completion.tripId) return;
    await api.patch(`/trips/${completion.tripId}/`, {
      status: "COMPLETED",
      odometer_end: completion.odometer_end,
      return_datetime_actual: completion.return_datetime_actual,
    });
    setCompletion({ tripId: "", odometer_end: "", return_datetime_actual: "" });
    load();
  };

  const buildWhatsapp = async (id: number) => {
    const { data } = await api.get<{ message: string; wa_link: string }>(`/trips/${id}/whatsapp_message/`);
    setMessage(data.wa_link);
  };

  const handleEdit = (trip: Trip) => {
    setEditingId(trip.id);
    setForm({
      origin: trip.origin,
      destination: trip.destination,
      departure_datetime: trip.departure_datetime,
      return_datetime_expected: trip.return_datetime_expected,
      passengers_count: trip.passengers_count,
      vehicle: trip.vehicle,
      driver: trip.driver,
      status: trip.status,
      odometer_start: trip.odometer_start,
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deseja remover esta viagem?")) return;
    try {
      await api.delete(`/trips/${id}/`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao remover viagem.");
    }
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
      <div>
        <h2>Viagens</h2>
        {error && <div className="card" style={{ color: "#f87171" }}>{error}</div>}
        <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", marginBottom: "0.75rem", gap: "0.75rem" }}>
          <input
            placeholder="Buscar por origem ou destino"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
              load(1, e.target.value, statusFilter);
            }}
            style={{ width: "100%", padding: "0.6rem", borderRadius: 10, border: "1px solid var(--border)", background: "#0f1724", color: "var(--text)" }}
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
              load(1, search, e.target.value);
            }}
            style={{ padding: "0.6rem", borderRadius: 10, border: "1px solid var(--border)", background: "#0f1724", color: "var(--text)" }}
          >
            <option value="">Todos status</option>
            <option value="PLANNED">Planejada</option>
            <option value="IN_PROGRESS">Em andamento</option>
            <option value="COMPLETED">Concluída</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
        </div>
        <div style={{ marginBottom: "0.75rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Itens por página</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const size = Number(e.target.value);
              setPageSize(size);
              setPage(1);
              load(1, search, statusFilter, size);
            }}
            style={{ padding: "0.4rem", borderRadius: 8, border: "1px solid var(--border)", background: "#0f1724", color: "var(--text)" }}
          >
            {[5, 8, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <Table
          columns={[
            { key: "origin", label: "Origem" },
            { key: "destination", label: "Destino" },
            { key: "departure_datetime", label: "Saída" },
            { key: "return_datetime_expected", label: "Retorno" },
            { key: "passengers_count", label: "Passageiros" },
            { key: "odometer_start", label: "Odômetro início" },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
            {
              key: "whatsapp",
              label: "WhatsApp",
              render: (row) => (
                <Button variant="ghost" onClick={() => buildWhatsapp(row.id)}>
                  Gerar link
                </Button>
              ),
            },
            {
              key: "actions",
              label: "Ações",
              render: (row) => (
                <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.3rem" }}>
                  <Button variant="ghost" onClick={() => handleEdit(row)}>
                    Editar
                  </Button>
                  <Button variant="ghost" onClick={() => handleDelete(row.id)}>
                    Excluir
                  </Button>
                </div>
              ),
            },
          ]}
          data={trips}
        />
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onChange={(p) => {
            setPage(p);
            load(p, search, statusFilter, pageSize);
          }}
        />
        {message && (
          <div className="card" style={{ marginTop: "1rem" }}>
            <strong>Link WhatsApp</strong>
            <p>
              <a href={message} target="_blank" rel="noreferrer">
                {message}
              </a>
            </p>
          </div>
        )}
      </div>
      <div className="card">
        <h3>{editingId ? "Editar viagem" : "Nova viagem"}</h3>
        <form className="grid" style={{ gap: "0.6rem" }} onSubmit={handleSubmit}>
          <input placeholder="Origem" required value={form.origin ?? ""} onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))} />
          <input placeholder="Destino" required value={form.destination ?? ""} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} />
          <label>
            Saída
            <input type="datetime-local" required value={form.departure_datetime ?? ""} onChange={(e) => setForm((f) => ({ ...f, departure_datetime: e.target.value }))} />
          </label>
          <label>
            Retorno
            <input type="datetime-local" required value={form.return_datetime_expected ?? ""} onChange={(e) => setForm((f) => ({ ...f, return_datetime_expected: e.target.value }))} />
          </label>
          <label>
            Odômetro inicial
            <input
              type="number"
              required
              value={form.odometer_start ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, odometer_start: Number(e.target.value) }))}
            />
          </label>
          <input placeholder="Passageiros" type="number" value={form.passengers_count ?? 0} onChange={(e) => setForm((f) => ({ ...f, passengers_count: Number(e.target.value) }))} />
          <select value={form.vehicle ?? ""} onChange={(e) => setForm((f) => ({ ...f, vehicle: Number(e.target.value) }))} required>
            <option value="">Veículo</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.license_plate} (cap: {v.max_passengers})
              </option>
            ))}
          </select>
          <select value={form.driver ?? ""} onChange={(e) => setForm((f) => ({ ...f, driver: Number(e.target.value) }))} required>
            <option value="">Motorista</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="PLANNED">Planejada</option>
            <option value="IN_PROGRESS">Em andamento</option>
            <option value="COMPLETED">Concluída</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
            <Button type="submit">{editingId ? "Atualizar" : "Salvar"}</Button>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm({ status: "PLANNED", passengers_count: 0 });
                }}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>
        <div className="card" style={{ marginTop: "1rem" }}>
          <h4>Concluir viagem</h4>
          <form className="grid" style={{ gap: "0.6rem" }} onSubmit={handleComplete}>
            <select
              value={completion.tripId}
              onChange={(e) => setCompletion((c) => ({ ...c, tripId: Number(e.target.value) || "" }))}
              required
            >
              <option value="">Selecione a viagem</option>
              {trips
                .filter((t) => t.status !== "COMPLETED")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    #{t.id} - {t.origin} → {t.destination}
                  </option>
                ))}
            </select>
            <label>
              Odômetro final
              <input
                type="number"
                required
                value={completion.odometer_end}
                onChange={(e) => setCompletion((c) => ({ ...c, odometer_end: Number(e.target.value) }))}
              />
            </label>
            <label>
              Retorno real
              <input
                type="datetime-local"
                required
                value={completion.return_datetime_actual}
                onChange={(e) => setCompletion((c) => ({ ...c, return_datetime_actual: e.target.value }))}
              />
            </label>
            <Button type="submit">Concluir</Button>
          </form>
        </div>
      </div>
    </div>
  );
};
