import { useEffect, useMemo, useState } from "react";
import { api, type Paginated } from "../lib/api";
import { Table } from "../components/Table";
import { Pagination } from "../components/Pagination";
import { Button } from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { FloatingActionButton } from "../components/FloatingActionButton";
import { Modal } from "../components/Modal";
import "../styles/DataPage.css";
import "./Users.css";

type User = {
  id: number;
  email: string;
  role: string;
  municipality: number | null;
};

type Municipality = { id: number; name: string };

export const UsersPage = () => {
  const { isMobile } = useMediaQuery();
  const { user: current } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<User & { password: string }>>({
    role: "VIEWER",
    municipality: current?.municipality ?? null,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [total, setTotal] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const municipalityName = useMemo(() => {
    const map = new Map<number, string>();
    municipalities.forEach((m) => map.set(m.id, m.name));
    return map;
  }, [municipalities]);

  const load = (nextPage = page, nextSearch = search, nextPageSize = pageSize) => {
    api
      .get<Paginated<User>>("/auth/users/", { params: { page: nextPage, page_size: nextPageSize, search: nextSearch } })
      .then((res) => {
        const data = res.data as any;
        if (Array.isArray(data)) {
          setUsers(data);
          setTotal(data.length);
        } else {
          setUsers(data.results);
          setTotal(data.count);
        }
        setError(null);
      })
      .catch((err) => {
        if (err.response?.status === 403) setError("Apenas admin pode listar usuários.");
      });

    api
      .get<Paginated<Municipality>>("/municipalities/", { params: { page_size: 1000 } })
      .then((res) => {
        const data = res.data as any;
        setMunicipalities(Array.isArray(data) ? data : data.results);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.patch(`/auth/users/${editingId}/`, form);
      } else {
        await api.post("/auth/users/", form);
      }
      setForm({ role: "VIEWER", municipality: current?.municipality ?? null });
      setEditingId(null);
      load();
    } catch (err: any) {
      if (err.response?.status === 403) setError("Apenas admin pode criar usuários.");
    }
  };

  const handleEdit = (u: User) => {
    setEditingId(u.id);
    setForm({
      email: u.email,
      role: u.role,
      municipality: u.municipality,
      password: "",
    });
    if (isMobile) setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deseja remover este usuário?")) return;
    try {
      await api.delete(`/auth/users/${id}/`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao remover usuário.");
    }
  };

  useEffect(() => {
    if (isMobile && editingId) setIsModalOpen(true);
  }, [isMobile, editingId]);

  const disableMunicipalitySelect = current?.role !== "SUPERADMIN";

  const FormCard = (
    <div className="card">
      <h3>{editingId ? "Editar usuário" : "Novo usuário"}</h3>
      <form className="grid form-grid responsive" onSubmit={handleSubmit}>
        <input
          placeholder="Email"
          type="email"
          required
          value={form.email ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <input
          placeholder="Senha"
          type="password"
          required={!editingId}
          value={form.password ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
        />
        <label>
          Papel
          <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="ADMIN_MUNICIPALITY">Admin Prefeitura</option>
            <option value="OPERATOR">Operador</option>
            <option value="VIEWER">Visualizador</option>
            {current?.role === "SUPERADMIN" && <option value="SUPERADMIN">Superadmin</option>}
          </select>
        </label>
        <label>
          Prefeitura
          <select
            value={form.municipality ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, municipality: e.target.value ? Number(e.target.value) : null }))}
            disabled={disableMunicipalitySelect}
          >
            <option value="">Selecione</option>
            {municipalities.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-actions">
          <Button type="submit">{editingId ? "Atualizar" : "Salvar"}</Button>
          {editingId && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setForm({ role: "VIEWER", municipality: current?.municipality ?? null });
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
    <div className="data-page">
      <div className="data-header">
        <div>
          <h1 className="data-title">Usuários</h1>
          <p className="data-subtitle">Perfis, credenciais e prefeitura vinculada.</p>
        </div>
      </div>
      <div className="users-layout">
        {!isMobile && <div className="users-form-card">{FormCard}</div>}
        <div className="users-content">
          {error && <div className="card data-error">{error}</div>}
          {!error && (
            <>
              <div className="data-card data-toolbar users-toolbar">
                <div className="users-search">
                  <input
                    placeholder="Buscar por email"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                      load(1, e.target.value);
                    }}
                  />
                </div>
                <div className="users-filters">
                  <span className="data-inline-label">Itens por página</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const size = Number(e.target.value);
                      setPageSize(size);
                      setPage(1);
                      load(1, search, size);
                    }}
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
                  { key: "email", label: "Email" },
                  { key: "role", label: "Papel" },
                  { key: "municipality", label: "Prefeitura", render: (row) => (row.municipality ? municipalityName.get(row.municipality) || row.municipality : "—") },
                  {
                    key: "actions",
                    label: "Ações",
                    render: (row) => (
                      <div className="users-actions">
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
                data={users}
              />
              <div className="users-pagination">
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
            </>
          )}
        </div>
        {isMobile && (
          <>
            <FloatingActionButton
              onClick={() => setIsModalOpen(true)}
              aria-label="Novo usuário"
              ariaControls="users-modal"
              ariaExpanded={isModalOpen}
            />
            <Modal
              open={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              title={editingId ? "Editar usuário" : "Novo usuário"}
              id="users-modal"
            >
              {FormCard}
            </Modal>
          </>
        )}
      </div>
    </div>
  );
};
