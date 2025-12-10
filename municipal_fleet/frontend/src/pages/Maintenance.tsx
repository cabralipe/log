import { useEffect, useState } from "react";
import { api, type Paginated } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { Pagination } from "../components/Pagination";

type Vehicle = { id: number; license_plate: string; brand: string; model: string };
type Maintenance = {
  id: number;
  vehicle: number;
  vehicle__license_plate?: string;
  description: string;
  date: string;
  mileage: number;
};

export const MaintenancePage = () => {
  const [records, setRecords] = useState<Maintenance[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [form, setForm] = useState<Partial<Maintenance>>({
    date: new Date().toISOString().slice(0, 10),
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = (nextPage = page, nextSearch = search, nextPageSize = pageSize) => {
    api
      .get<Paginated<Maintenance>>("/vehicles/maintenance/", {
        params: { page: nextPage, page_size: nextPageSize, search: nextSearch },
      })
      .then((res) => {
        const data = res.data as any;
        if (Array.isArray(data)) {
          setRecords(data);
          setTotal(data.length);
        } else {
          setRecords(data.results);
          setTotal(data.count);
        }
        setError(null);
      })
      .catch((err) => setError(err.response?.data?.detail || "Erro ao carregar manutenções."));
    api.get<Paginated<Vehicle>>("/vehicles/", { params: { page_size: 1000 } }).then((res) => {
      const data = res.data as any;
      setVehicles(Array.isArray(data) ? data : data.results);
    });
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await api.patch(`/vehicles/maintenance/${editingId}/`, form);
    } else {
      await api.post("/vehicles/maintenance/", form);
    }
    setForm({ date: new Date().toISOString().slice(0, 10) });
    setEditingId(null);
    load();
  };

  const handleEdit = (row: Maintenance) => {
    setEditingId(row.id);
    setForm({
      vehicle: row.vehicle,
      description: row.description,
      date: row.date,
      mileage: row.mileage,
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deseja remover este registro?")) return;
    try {
      await api.delete(`/vehicles/maintenance/${id}/`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao remover manutenção.");
    }
  };

  const vehicleLabel = (id: number) => {
    const v = vehicles.find((item) => item.id === id);
    return v ? `${v.license_plate} - ${v.brand} ${v.model}` : id;
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
      <div>
        <h2>Histórico de Manutenções</h2>
        {error && <div className="card" style={{ color: "#f87171" }}>{error}</div>}
        <div style={{ marginBottom: "0.75rem" }}>
          <input
            placeholder="Buscar por veículo ou descrição"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
              load(1, e.target.value);
            }}
            style={{ width: "100%", padding: "0.6rem", borderRadius: 10, border: "1px solid var(--border)", background: "#0f1724", color: "var(--text)" }}
          />
          <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Itens por página</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const size = Number(e.target.value);
                setPageSize(size);
                setPage(1);
                load(1, search, size);
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
        </div>
        <Table
          columns={[
            { key: "vehicle", label: "Veículo", render: (row) => vehicleLabel(row.vehicle) },
            { key: "description", label: "Descrição" },
            { key: "date", label: "Data" },
            { key: "mileage", label: "KM" },
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
          data={records}
        />
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onChange={(p) => {
            setPage(p);
            load(p, search, pageSize);
          }}
        />
      </div>
      <div className="card">
        <h3>{editingId ? "Editar manutenção" : "Registrar manutenção"}</h3>
        <form className="grid form-grid responsive" onSubmit={handleSubmit}>
          <select
            value={form.vehicle ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, vehicle: Number(e.target.value) }))}
            required
          >
            <option value="">Veículo</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.license_plate} - {v.brand} {v.model}
              </option>
            ))}
          </select>
          <input
            placeholder="Descrição"
            required
            value={form.description ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <label>
            Data
            <input
              type="date"
              required
              value={form.date ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </label>
          <label>
            Quilometragem
            <input
              type="number"
              required
              value={form.mileage ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, mileage: Number(e.target.value) }))}
            />
          </label>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
            <Button type="submit">{editingId ? "Atualizar" : "Salvar"}</Button>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm({ date: new Date().toISOString().slice(0, 10) });
                }}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
