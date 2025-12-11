import { useEffect, useState } from "react";
import { api, type Paginated } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { Pagination } from "../components/Pagination";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { Modal } from "../components/Modal";
import { FloatingActionButton } from "../components/FloatingActionButton";

type Driver = {
  id: number;
  name: string;
  cpf: string;
  phone: string;
  status: string;
  cnh_number: string;
  cnh_category: string;
  cnh_expiration_date: string;
  access_code: string;
};

export const DriversPage = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [form, setForm] = useState<Partial<Driver>>({
    status: "ACTIVE",
    cnh_category: "B",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { isMobile, isTablet, isDesktop } = useMediaQuery();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const load = (nextPage = page, nextSearch = search, nextPageSize = pageSize) => {
    api
      .get<Paginated<Driver>>("/drivers/", { params: { page: nextPage, page_size: nextPageSize, search: nextSearch } })
      .then((res) => {
        const data = res.data as any;
        if (Array.isArray(data)) {
          setDrivers(data);
          setTotal(data.length);
        } else {
          setDrivers(data.results);
          setTotal(data.count);
        }
        setError(null);
      })
      .catch((err) => setError(err.response?.data?.detail || "Erro ao carregar motoristas."));
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await api.patch(`/drivers/${editingId}/`, form);
    } else {
      await api.post("/drivers/", form);
    }
    setForm({ status: "ACTIVE", cnh_category: "B" });
    setEditingId(null);
    load();
  };

  const handleEdit = (driver: Driver) => {
    setEditingId(driver.id);
    setForm({
      name: driver.name,
      cpf: driver.cpf,
      phone: driver.phone,
      status: driver.status,
      cnh_number: driver.cnh_number,
      cnh_category: driver.cnh_category,
      cnh_expiration_date: driver.cnh_expiration_date,
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deseja remover este motorista?")) return;
    try {
      await api.delete(`/drivers/${id}/`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao remover motorista.");
    }
  };

  const formCard = (
    <div className="card">
      <h3>{editingId ? "Editar motorista" : "Novo motorista"}</h3>
      <form className="grid form-grid responsive" onSubmit={handleSubmit}>
        <input placeholder="Nome" required value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <input placeholder="CPF" required value={form.cpf ?? ""} onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))} />
        <input placeholder="Telefone" required value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        <input placeholder="CNH" required value={form.cnh_number ?? ""} onChange={(e) => setForm((f) => ({ ...f, cnh_number: e.target.value }))} />
        <label>
          Validade CNH
          <input
            type="date"
            required
            value={form.cnh_expiration_date ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, cnh_expiration_date: e.target.value }))}
          />
        </label>
        <label>
          Categoria CNH
          <select value={form.cnh_category} onChange={(e) => setForm((f) => ({ ...f, cnh_category: e.target.value }))}>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
            <option value="E">E</option>
          </select>
        </label>
        <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
          <option value="ACTIVE">Ativo</option>
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
                setForm({ status: "ACTIVE", cnh_category: "B" });
              }}
            >
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </div>
  );

  return (
    <div className="grid" style={{ gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr" }}>
      <div>
        <h2>Motoristas</h2>
        {error && <div className="card" style={{ color: "#f87171" }}>{error}</div>}
        <div style={{ marginBottom: "0.75rem" }}>
          <input
            placeholder="Buscar por nome ou CPF"
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
            { key: "name", label: "Nome" },
            { key: "cpf", label: "CPF" },
            { key: "phone", label: "Telefone" },
            { key: "access_code", label: "Código" },
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
          data={drivers}
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
      {!isMobile && formCard}

      {isMobile && (
        <>
          <FloatingActionButton onClick={() => setIsModalOpen(true)} aria-label="Adicionar novo motorista" />
          <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar motorista" : "Novo motorista"}>
            {formCard}
          </Modal>
        </>
      )}
    </div>
  );
};
