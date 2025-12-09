import { useEffect, useState } from "react";
import { api, type Paginated } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { Pagination } from "../components/Pagination";

type FuelStation = {
  id: number;
  name: string;
  cnpj: string;
  address: string;
  active: boolean;
  municipality: number;
};

export const FuelStationsPage = () => {
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [form, setForm] = useState<Partial<FuelStation>>({ active: true });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = (nextPage = page, nextSearch = search, nextPageSize = pageSize) => {
    api
      .get<Paginated<FuelStation>>("/vehicles/fuel_stations/", {
        params: { page: nextPage, page_size: nextPageSize, search: nextSearch },
      })
      .then((res) => {
        const data = res.data as any;
        if (Array.isArray(data)) {
          setStations(data);
          setTotal(data.length);
        } else {
          setStations(data.results);
          setTotal(data.count);
        }
        setError(null);
      })
      .catch((err) => setError(err.response?.data?.detail || "Erro ao carregar postos."));
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.patch(`/vehicles/fuel_stations/${editingId}/`, form);
      } else {
        await api.post("/vehicles/fuel_stations/", form);
      }
      setForm({ active: true });
      setEditingId(null);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao salvar posto.");
    }
  };

  const handleEdit = (station: FuelStation) => {
    setEditingId(station.id);
    setForm({
      name: station.name,
      cnpj: station.cnpj,
      address: station.address,
      active: station.active,
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deseja remover este posto?")) return;
    try {
      await api.delete(`/vehicles/fuel_stations/${id}/`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao remover posto.");
    }
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
      <div>
        <h2>Postos credenciados</h2>
        {error && <div className="card" style={{ color: "#f87171" }}>{error}</div>}
        <div style={{ marginBottom: "0.75rem" }}>
          <input
            placeholder="Buscar por nome ou CNPJ"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
              load(1, e.target.value);
            }}
            style={{
              width: "100%",
              padding: "0.6rem",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "#0f1724",
              color: "var(--text)",
            }}
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
            { key: "name", label: "Nome" },
            { key: "cnpj", label: "CNPJ" },
            { key: "address", label: "Endereço" },
            { key: "active", label: "Status", render: (row) => <StatusBadge status={row.active ? "ACTIVE" : "INACTIVE"} /> },
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
          data={stations}
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
        <h3>{editingId ? "Editar posto" : "Novo posto credenciado"}</h3>
        <form className="grid" style={{ gap: "0.6rem" }} onSubmit={handleSubmit}>
          <input placeholder="Nome" required value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input placeholder="CNPJ" value={form.cnpj ?? ""} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} />
          <input placeholder="Endereço" value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          <select value={form.active ? "true" : "false"} onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === "true" }))}>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
            <Button type="submit">{editingId ? "Atualizar" : "Salvar"}</Button>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm({ active: true });
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
