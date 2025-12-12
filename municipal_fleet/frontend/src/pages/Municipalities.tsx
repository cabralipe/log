import { useEffect, useState } from "react";
import { api, type Paginated } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { Pagination } from "../components/Pagination";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { FloatingActionButton } from "../components/FloatingActionButton";
import { Modal } from "../components/Modal";
import { formatCnpj, formatPhone } from "../utils/masks";

type Municipality = {
  id: number;
  name: string;
  cnpj: string;
  address: string;
  city: string;
  state: string;
  phone: string;
};

export const MunicipalitiesPage = () => {
  const { isMobile } = useMediaQuery();
  const [items, setItems] = useState<Municipality[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Municipality>>({ state: "SP" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [total, setTotal] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const load = (nextPage = page, nextSearch = search, nextPageSize = pageSize) => {
    api
      .get<Paginated<Municipality>>("/municipalities/", { params: { page: nextPage, page_size: nextPageSize, search: nextSearch } })
      .then((res) => {
        const data = res.data as any;
        if (Array.isArray(data)) {
          setItems(data);
          setTotal(data.length);
        } else {
          setItems(data.results);
          setTotal(data.count);
        }
        setError(null);
      })
      .catch((err) => {
        if (err.response?.status === 403) {
          setError("Apenas superadmin pode acessar prefeituras.");
        }
      });
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.patch(`/municipalities/${editingId}/`, form);
      } else {
        await api.post("/municipalities/", form);
      }
      setForm({ state: "SP" });
      setEditingId(null);
      load();
    } catch (err: any) {
      if (err.response?.status === 403) setError("Apenas superadmin pode criar prefeituras.");
    }
  };

  const handleEdit = (item: Municipality) => {
    setEditingId(item.id);
    setForm(item);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deseja remover esta prefeitura?")) return;
    try {
      await api.delete(`/municipalities/${id}/`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao remover. Talvez haja dados associados.");
    }
  };

  useEffect(() => {
    if (isMobile && editingId) setIsModalOpen(true);
  }, [isMobile, editingId]);

  const FormCard = (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <h3>{editingId ? "Editar prefeitura" : "Nova prefeitura"}</h3>
      <form className="grid form-grid responsive" onSubmit={handleSubmit}>
        <input placeholder="Nome" required value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <input placeholder="CNPJ" required value={form.cnpj ?? ""} onChange={(e) => setForm((f) => ({ ...f, cnpj: formatCnpj(e.target.value) }))} inputMode="numeric" maxLength={18} />
        <input placeholder="Endereço" required value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        <input placeholder="Cidade" required value={form.city ?? ""} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
        <input placeholder="UF" required maxLength={2} value={form.state ?? ""} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))} />
        <input placeholder="Telefone" required value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))} inputMode="numeric" maxLength={15} />
        <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
          <Button type="submit">{editingId ? "Atualizar" : "Salvar"}</Button>
          {editingId && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setForm({ state: "SP" });
                setError(null);
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
    <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
      {!isMobile && FormCard}
      <div>
        <h2>Prefeituras</h2>
        {error && <div className="card" style={{ color: "#f87171" }}>{error}</div>}
        {!error && (
          <>
            <div style={{ marginBottom: "0.75rem" }}>
              <input
                placeholder="Buscar por nome ou cidade"
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
                { key: "cnpj", label: "CNPJ" },
                { key: "city", label: "Cidade" },
                { key: "state", label: "UF" },
                { key: "phone", label: "Telefone" },
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
              data={items}
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
          </>
        )}
      </div>
      {isMobile && (
        <>
          <FloatingActionButton
            onClick={() => setIsModalOpen(true)}
            aria-label="Nova prefeitura"
            ariaControls="municipality-modal"
            ariaExpanded={isModalOpen}
          />
          <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar prefeitura" : "Nova prefeitura"} id="municipality-modal">
            {FormCard}
          </Modal>
        </>
      )}
    </div>
  );
};
