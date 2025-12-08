import { useEffect, useState } from "react";
import { api, type Paginated } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { Pagination } from "../components/Pagination";

type Vehicle = {
  id: number;
  license_plate: string;
  brand: string;
  model: string;
  year: number;
  max_passengers: number;
  status: string;
  municipality: number;
};

export const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Vehicle>>({ status: "AVAILABLE" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = (nextPage = page, nextSearch = search, nextPageSize = pageSize) => {
    setLoading(true);
    api
      .get<Paginated<Vehicle>>("/vehicles/", { params: { page: nextPage, page_size: nextPageSize, search: nextSearch } })
      .then((res) => {
        const data = res.data as any;
        if (Array.isArray(data)) {
          setVehicles(data);
          setTotal(data.length);
        } else {
          setVehicles(data.results);
          setTotal(data.count);
        }
        setError(null);
      })
      .catch((err) => setError(err.response?.data?.detail || "Erro ao carregar veículos."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await api.patch(`/vehicles/${editingId}/`, form);
    } else {
      await api.post("/vehicles/", form);
    }
    setForm({ status: "AVAILABLE" });
    setEditingId(null);
    load();
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingId(vehicle.id);
    setForm({
      license_plate: vehicle.license_plate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      max_passengers: vehicle.max_passengers,
      status: vehicle.status,
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deseja remover este veículo?")) return;
    try {
      await api.delete(`/vehicles/${id}/`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao remover veículo.");
    }
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
      <div>
        <h2>Veículos</h2>
        {error && <div className="card" style={{ color: "#f87171" }}>{error}</div>}
        <div style={{ marginBottom: "0.75rem" }}>
          <input
            placeholder="Buscar por placa, modelo ou marca"
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
        {loading ? (
          <p>Carregando...</p>
        ) : (
          <Table
            columns={[
              { key: "license_plate", label: "Placa" },
              { key: "brand", label: "Marca" },
              { key: "model", label: "Modelo" },
              { key: "year", label: "Ano" },
              { key: "max_passengers", label: "Cap." },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
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
            data={vehicles}
          />
        )}
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
        <h3>{editingId ? "Editar veículo" : "Novo veículo"}</h3>
        <form className="grid" style={{ gap: "0.6rem" }} onSubmit={handleSubmit}>
          <input placeholder="Placa" required value={form.license_plate ?? ""} onChange={(e) => setForm((f) => ({ ...f, license_plate: e.target.value }))} />
          <input placeholder="Marca" required value={form.brand ?? ""} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
          <input placeholder="Modelo" required value={form.model ?? ""} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
          <input placeholder="Ano" type="number" required value={form.year ?? ""} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))} />
          <input placeholder="Capacidade" type="number" required value={form.max_passengers ?? ""} onChange={(e) => setForm((f) => ({ ...f, max_passengers: Number(e.target.value) }))} />
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="AVAILABLE">Disponível</option>
            <option value="IN_USE">Em uso</option>
            <option value="MAINTENANCE">Manutenção</option>
            <option value="INACTIVE">Inativo</option>
          </select>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
            <Button type="submit">{editingId ? "Atualizar" : "Salvar"}</Button>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm({ status: "AVAILABLE" });
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
