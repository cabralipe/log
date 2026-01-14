import { useEffect, useState } from "react";
import { api, type Paginated } from "../../lib/api";
import { Table } from "../../components/Table";
import { Button } from "../../components/Button";
import { StatusBadge } from "../../components/StatusBadge";
import { Pagination } from "../../components/Pagination";
import { Modal } from "../../components/Modal";
import "../../styles/DataPage.css";

type School = {
  id: number;
  name: string;
  inep_code?: string;
  address?: string;
  city?: string;
  district?: string;
  phone?: string;
  type: "MUNICIPAL" | "ESTADUAL" | "PARTICULAR" | "FEDERAL" | "OTHER";
  is_active: boolean;
};

export const SchoolsPage = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<School>>({
    type: "MUNICIPAL",
    is_active: true,
  });

  const typeLabels: Record<string, string> = {
    MUNICIPAL: "Municipal",
    ESTADUAL: "Estadual",
    PARTICULAR: "Particular",
    FEDERAL: "Federal",
    OTHER: "Outro",
  };

  const load = (nextPage = page, nextSearch = search) => {
    setLoading(true);
    const params: any = { page: nextPage, page_size: pageSize };
    if (nextSearch) params.search = nextSearch;

    api
      .get<Paginated<School>>("/students/schools/", { params })
      .then((res) => {
        const data = res.data as any;
        if (Array.isArray(data)) {
          setSchools(data);
          setTotal(data.length);
        } else {
          setSchools(data.results);
          setTotal(data.count);
        }
        setError(null);
      })
      .catch(() => setError("Erro ao carregar escolas."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.patch(`/students/schools/${editingId}/`, form);
      } else {
        await api.post("/students/schools/", form);
      }
      setIsModalOpen(false);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao salvar escola.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deseja remover esta escola?")) return;
    try {
      await api.delete(`/students/schools/${id}/`);
      load();
    } catch (err) {
      setError("Erro ao remover escola.");
    }
  };

  const openModal = (school?: School) => {
    if (school) {
      setEditingId(school.id);
      setForm(school);
    } else {
      setEditingId(null);
      setForm({ type: "MUNICIPAL", is_active: true });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="data-page">
      <div className="data-header">
        <div>
          <h1 className="data-title">Unidades escolares</h1>
          <p className="data-subtitle">Cadastre e mantenha as escolas da rede.</p>
        </div>
        <Button onClick={() => openModal()}>+ Nova escola</Button>
      </div>

      {error && <div className="data-error">{error}</div>}

      <div className="data-filters">
        <input
          placeholder="Buscar por nome ou cidade..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
            load(1, e.target.value);
          }}
          className="data-search"
        />
      </div>

      {loading ? (
        <div className="data-loading">Carregando...</div>
      ) : (
        <>
          <Table
            columns={[
              { label: "Nome", key: "name" },
              { label: "Tipo", key: "type", render: (d) => typeLabels[d.type] || d.type },
              { label: "Cidade", key: "city" },
              { label: "Bairro", key: "district" },
              {
                label: "Status",
                key: "is_active",
                render: (d) => <StatusBadge status={d.is_active ? "ACTIVE" : "INACTIVE"} />,
              },
              {
                label: "Acoes",
                key: "actions",
                render: (d) => (
                  <div className="data-actions">
                    <Button variant="ghost" size="sm" onClick={() => openModal(d)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)}>
                      Excluir
                    </Button>
                  </div>
                ),
              },
            ]}
            data={schools}
          />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onChange={(p) => {
              setPage(p);
              load(p);
            }}
          />
        </>
      )}

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar escola" : "Nova escola"}>
        <form onSubmit={handleSave} className="data-form">
          <div className="data-form-grid">
            <label className="full-width">
              Nome da escola *
              <input required value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Tipo *
              <select
                value={form.type || "MUNICIPAL"}
                onChange={(e) => setForm({ ...form, type: e.target.value as School["type"] })}
              >
                {Object.entries(typeLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Codigo INEP
              <input
                value={form.inep_code || ""}
                onChange={(e) => setForm({ ...form, inep_code: e.target.value })}
              />
            </label>
            <label className="full-width">
              Endereco
              <input
                value={form.address || ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>
            <label>
              Cidade
              <input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </label>
            <label>
              Bairro
              <input
                value={form.district || ""}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
              />
            </label>
            <label>
              Telefone
              <input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={!!form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Ativa
            </label>
          </div>
          <div className="data-form-actions">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
