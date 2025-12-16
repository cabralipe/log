import { useEffect, useState } from "react";
import { api, type Paginated } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { Pagination } from "../components/Pagination";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { Modal } from "../components/Modal";
import { formatCpf, formatPhone } from "../utils/masks";
import { FloatingActionButton } from "../components/FloatingActionButton";
import "../styles/DataPage.css";
import "./Drivers.css";

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
  free_trip_enabled?: boolean;
};

export const DriversPage = () => {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [form, setForm] = useState<Partial<Driver>>({
    status: "ACTIVE",
    cnh_category: "B",
    free_trip_enabled: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [municipalities, setMunicipalities] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedMunicipality, setSelectedMunicipality] = useState<number | null>(null);
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

  useEffect(() => {
    if (user?.municipality) {
      setSelectedMunicipality(user.municipality);
    }
    if (user && user.role === "SUPERADMIN") {
      api
        .get<any>("/municipalities/", { params: { page_size: 1000 } })
        .then((res) => {
          const data = res.data as any;
          const items = Array.isArray(data) ? data : data.results || [];
          const list = items.map((m: any) => ({ id: m.id, name: m.name }));
          setMunicipalities(list);
          if (!selectedMunicipality && list.length > 0) setSelectedMunicipality(list[0].id);
        })
        .catch(() => {
          /* ignore */
        });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!form.name || !form.name.trim()) errors.name = "Nome é obrigatório";
    if (!form.cpf || !form.cpf.trim()) errors.cpf = "CPF é obrigatório";
    if (!form.phone || !form.phone.trim()) errors.phone = "Telefone é obrigatório";
    if (!form.cnh_number || !form.cnh_number.trim()) errors.cnh_number = "CNH é obrigatória";
    if (!form.cnh_expiration_date || !form.cnh_expiration_date.trim()) errors.cnh_expiration_date = "Validade CNH é obrigatória";
    if (!form.cnh_category) errors.cnh_category = "Categoria CNH é obrigatória";
    if (!form.status) errors.status = "Status é obrigatório";
    if (user?.role === "SUPERADMIN" && !selectedMunicipality) errors.municipality = "Prefeitura é obrigatória";
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        ...(user?.role === "SUPERADMIN" && selectedMunicipality ? { municipality: selectedMunicipality } : {}),
      };
      if (editingId) {
        await api.patch(`/drivers/${editingId}/`, payload);
      } else {
        await api.post("/drivers/", payload);
      }
      setForm({ status: "ACTIVE", cnh_category: "B" });
      setEditingId(null);
      load();
    } catch (err: any) {
      const data = err?.response?.data;
      const detail = data?.detail;
      const fieldErrors = data && typeof data === "object"
        ? Object.entries(data)
            .filter(([k]) => k !== "detail")
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
            .join(" | ")
        : null;
      setError(detail || fieldErrors || "Erro ao salvar motorista.");
    } finally {
      setSubmitting(false);
    }
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
      free_trip_enabled: !!driver.free_trip_enabled,
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
      {user?.role === "SUPERADMIN" && (
        <div className="grid" style={{ gridTemplateColumns: "1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <label>
            Prefeitura
            <select
              value={selectedMunicipality ?? ""}
              onChange={(e) => setSelectedMunicipality(Number(e.target.value))}
              style={{ width: "100%" }}
              aria-invalid={!!formErrors.municipality}
            >
              {municipalities.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {formErrors.municipality && <span className="error-message">{formErrors.municipality}</span>}
          </label>
        </div>
      )}
      <form className="grid form-grid responsive" onSubmit={handleSubmit}>
        <input placeholder="Nome" value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} aria-invalid={!!formErrors.name} />
        {formErrors.name && <span className="error-message">{formErrors.name}</span>}
        <input placeholder="CPF" value={form.cpf ?? ""} onChange={(e) => setForm((f) => ({ ...f, cpf: formatCpf(e.target.value) }))} aria-invalid={!!formErrors.cpf} inputMode="numeric" maxLength={14} />
        {formErrors.cpf && <span className="error-message">{formErrors.cpf}</span>}
        <input placeholder="Telefone" value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))} aria-invalid={!!formErrors.phone} inputMode="numeric" maxLength={15} />
        {formErrors.phone && <span className="error-message">{formErrors.phone}</span>}
        <input placeholder="CNH" value={form.cnh_number ?? ""} onChange={(e) => setForm((f) => ({ ...f, cnh_number: e.target.value }))} aria-invalid={!!formErrors.cnh_number} />
        {formErrors.cnh_number && <span className="error-message">{formErrors.cnh_number}</span>}
        <label>
          Validade CNH
          <input
            type="date"
            value={form.cnh_expiration_date ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, cnh_expiration_date: e.target.value }))}
            aria-invalid={!!formErrors.cnh_expiration_date}
          />
          {formErrors.cnh_expiration_date && <span className="error-message">{formErrors.cnh_expiration_date}</span>}
        </label>
        <label>
          Categoria CNH
          <select value={form.cnh_category} onChange={(e) => setForm((f) => ({ ...f, cnh_category: e.target.value }))} aria-invalid={!!formErrors.cnh_category}>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
            <option value="E">E</option>
          </select>
          {formErrors.cnh_category && <span className="error-message">{formErrors.cnh_category}</span>}
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            checked={!!form.free_trip_enabled}
            onChange={(e) => setForm((f) => ({ ...f, free_trip_enabled: e.target.checked }))}
          />
          Habilitar viagem livre
        </label>
        <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} aria-invalid={!!formErrors.status}>
          <option value="ACTIVE">Ativo</option>
          <option value="INACTIVE">Inativo</option>
        </select>
        {formErrors.status && <span className="error-message">{formErrors.status}</span>}
        <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
          <Button type="submit" disabled={submitting}>{editingId ? "Atualizar" : "Salvar"}</Button>
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
    <div className="data-page">
      <div className="data-header">
        <div>
          <h1 className="data-title">Motoristas</h1>
          <p className="data-subtitle">Cadastro, acesso e situação de cada motorista credenciado.</p>
        </div>
      </div>
      <div className="drivers-layout">
        {!isMobile && <div className="drivers-form-card">{formCard}</div>}
        <div className="drivers-content">
          {error && <div className="data-error">{error}</div>}
          <div className="data-card data-toolbar drivers-toolbar">
            <div className="drivers-search">
              <input
                placeholder="Buscar por nome ou CPF"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                  load(1, e.target.value);
                }}
              />
            </div>
            <div className="drivers-filters">
              <span className="data-inline-label">Itens por página</span>
              <select
                className="data-select"
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
              { key: "name", label: "Nome" },
              { key: "cpf", label: "CPF" },
              { key: "phone", label: "Telefone" },
              { key: "access_code", label: "Código" },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
              {
                key: "actions",
                label: "Ações",
                render: (row) => (
                  <div className="drivers-actions">
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
          <div className="drivers-pagination">
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
        </div>

        {isMobile && (
          <>
            <FloatingActionButton onClick={() => setIsModalOpen(true)} aria-label="Adicionar novo motorista" />
            <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar motorista" : "Novo motorista"}>
              {formCard}
            </Modal>
          </>
        )}
      </div>
    </div>
  );
};
