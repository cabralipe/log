import { useEffect, useMemo, useState } from "react";
import "./Contracts.css";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { Modal } from "../components/Modal";
import { Plus } from "lucide-react";
import { api, type Paginated } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { Pagination } from "../components/Pagination";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";

type Contract = {
  id: number;
  municipality: number;
  contract_number: string;
  description: string;
  type: "LEASE" | "RENTAL" | "SERVICE";
  provider_name: string;
  provider_cnpj: string;
  start_date: string;
  end_date: string;
  billing_model: "FIXED" | "PER_KM" | "PER_DAY" | "MONTHLY_WITH_KM";
  base_value: number;
  included_km_per_month: number | null;
  extra_km_rate: number | null;
  status: "ACTIVE" | "INACTIVE" | "EXPIRED";
  notes: string;
};

type ContractVehicle = {
  id: number;
  contract: number;
  vehicle: number;
  start_date: string;
  end_date: string | null;
  custom_billing_model: Contract["billing_model"] | null;
  custom_rate: number | null;
  municipality: number;
};

type Vehicle = { id: number; license_plate: string; brand: string; model: string };
type Municipality = { id: number; name: string };

const CONTRACT_TYPES = [
  { value: "LEASE", label: "Leasing" },
  { value: "RENTAL", label: "Locação" },
  { value: "SERVICE", label: "Serviço" },
] as const;

const BILLING_MODELS = [
  { value: "FIXED", label: "Valor fixo" },
  { value: "PER_KM", label: "Por KM rodado" },
  { value: "PER_DAY", label: "Por dia" },
  { value: "MONTHLY_WITH_KM", label: "Mensal com franquia de KM" },
] as const;

const CONTRACT_STATUS = [
  { value: "ACTIVE", label: "Ativo" },
  { value: "INACTIVE", label: "Inativo" },
  { value: "EXPIRED", label: "Vencido" },
] as const;

export const ContractsPage = () => {
  const { user: current } = useAuth();
  const { isMobile } = useMediaQuery();
  const [showFormModal, setShowFormModal] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [contractVehicles, setContractVehicles] = useState<ContractVehicle[]>([]);

  const [form, setForm] = useState<Partial<Contract>>({
    type: "RENTAL",
    billing_model: "FIXED",
    status: "ACTIVE",
  });
  const [linkForm, setLinkForm] = useState<Partial<ContractVehicle>>({
    custom_billing_model: null,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [linkEditingId, setLinkEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const vehicleLabel = useMemo(() => {
    const map = new Map<number, string>();
    vehicles.forEach((v) => map.set(v.id, `${v.license_plate} - ${v.brand} ${v.model}`));
    return map;
  }, [vehicles]);

  const municipalityName = useMemo(() => {
    const map = new Map<number, string>();
    municipalities.forEach((m) => map.set(m.id, m.name));
    return map;
  }, [municipalities]);

  const loadContracts = (nextPage = page, nextSearch = search, nextPageSize = pageSize, nextStatus = statusFilter, nextType = typeFilter) => {
    setLoading(true);
    api
      .get<Paginated<Contract>>("/contracts/", {
        params: {
          page: nextPage,
          page_size: nextPageSize,
          search: nextSearch,
          status: nextStatus || undefined,
          type: nextType || undefined,
        },
      })
      .then((res) => {
        const data = res.data as any;
        if (Array.isArray(data)) {
          setContracts(data);
          setTotal(data.length);
        } else {
          setContracts(data.results);
          setTotal(data.count);
        }
        setError(null);
      })
      .catch((err) => setError(err.response?.data?.detail || "Erro ao carregar contratos."))
      .finally(() => setLoading(false));
  };

  const loadOptions = () => {
    api
      .get<Paginated<Vehicle>>("/vehicles/", { params: { page_size: 500 } })
      .then((res) => {
        const data = res.data as any;
        setVehicles(Array.isArray(data) ? data : data.results);
      })
      .catch(() => {});

    api
      .get<Paginated<Municipality>>("/municipalities/", { params: { page_size: 1000 } })
      .then((res) => {
        const data = res.data as any;
        setMunicipalities(Array.isArray(data) ? data : data.results);
      })
      .catch(() => {});
  };

  const loadContractVehicles = (contractId: number | null) => {
    if (!contractId) {
      setContractVehicles([]);
      return;
    }
    api
      .get<Paginated<ContractVehicle>>("/contract-vehicles/", { params: { contract: contractId, page_size: 200 } })
      .then((res) => {
        const data = res.data as any;
        setContractVehicles(Array.isArray(data) ? data : data.results);
      })
      .catch(() => setContractVehicles([]));
  };

  useEffect(() => {
    loadContracts();
    loadOptions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadContractVehicles(editingId);
    setLinkForm((prev) => ({ ...prev, contract: editingId ?? undefined }));
  }, [editingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form };
    if (editingId) {
      await api.patch(`/contracts/${editingId}/`, payload);
    } else {
      await api.post("/contracts/", payload);
    }
    setForm({ type: "RENTAL", billing_model: "FIXED", status: "ACTIVE" });
    setEditingId(null);
    loadContracts();
  };

  const handleEdit = (contract: Contract) => {
    setEditingId(contract.id);
    setForm({
      contract_number: contract.contract_number,
      description: contract.description,
      type: contract.type,
      provider_name: contract.provider_name,
      provider_cnpj: contract.provider_cnpj,
      start_date: contract.start_date,
      end_date: contract.end_date,
      billing_model: contract.billing_model,
      base_value: Number(contract.base_value),
      included_km_per_month: contract.included_km_per_month ?? undefined,
      extra_km_rate: contract.extra_km_rate ?? undefined,
      status: contract.status,
      notes: contract.notes,
      municipality: contract.municipality,
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deseja remover este contrato?")) return;
    try {
      await api.delete(`/contracts/${id}/`);
      if (editingId === id) {
        setEditingId(null);
        setForm({ type: "RENTAL", billing_model: "FIXED", status: "ACTIVE" });
        setLinkForm({ custom_billing_model: null });
      }
      loadContracts();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao remover contrato.");
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const payload = { ...linkForm, contract: editingId };
    if (linkEditingId) {
      await api.patch(`/contract-vehicles/${linkEditingId}/`, payload);
    } else {
      await api.post("/contract-vehicles/", payload);
    }
    setLinkForm({ contract: editingId, custom_billing_model: null });
    setLinkEditingId(null);
    loadContractVehicles(editingId);
  };

  const handleLinkEdit = (link: ContractVehicle) => {
    setLinkEditingId(link.id);
    setLinkForm({
      contract: link.contract,
      vehicle: link.vehicle,
      start_date: link.start_date,
      end_date: link.end_date ?? undefined,
      custom_billing_model: link.custom_billing_model,
      custom_rate: link.custom_rate ?? undefined,
    });
  };

  const handleLinkDelete = async (id: number) => {
    if (!confirm("Deseja desvincular este veículo?")) return;
    if (!editingId) return;
    await api.delete(`/contract-vehicles/${id}/`);
    loadContractVehicles(editingId);
  };

  const disableMunicipalitySelect = current?.role !== "SUPERADMIN";

  return (
    <div className="contracts-layout">
      {isMobile && (
        <button
          className="fab-button"
          aria-haspopup="dialog"
          aria-controls="contract-modal"
          aria-expanded={showFormModal}
          title={editingId ? "Editar contrato" : "Novo contrato"}
          onClick={() => setShowFormModal(true)}
        >
          <Plus size={18} />
          {editingId ? "Editar" : "Novo"}
        </button>
      )}
      <div className="grid" style={{ gap: "1rem" }}>
        <div>
          <h2>Contratos</h2>
          {error && <div className="card" style={{ color: "#f87171" }}>{error}</div>}
          <div style={{ marginBottom: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <input
              placeholder="Buscar por número, fornecedor ou descrição"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
                loadContracts(1, e.target.value);
              }}
              style={{ width: "100%", padding: "0.6rem", borderRadius: 10, border: "1px solid var(--border)", background: "#0f1724", color: "var(--text)" }}
            />
            <div className="contracts-filters">
              <select
                value={statusFilter}
                onChange={(e) => {
                  const next = e.target.value;
                  setStatusFilter(next);
                  setPage(1);
                  loadContracts(1, search, pageSize, next, typeFilter);
                }}
                style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid var(--border)", background: "#0f1724", color: "var(--text)" }}
              >
                <option value="">Status (todos)</option>
                {CONTRACT_STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(e) => {
                  const next = e.target.value;
                  setTypeFilter(next);
                  setPage(1);
                  loadContracts(1, search, pageSize, statusFilter, next);
                }}
                style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid var(--border)", background: "#0f1724", color: "var(--text)" }}
              >
                <option value="">Tipo (todos)</option>
                {CONTRACT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", justifyContent: "flex-end" }}>
                <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Itens por página</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const size = Number(e.target.value);
                    setPageSize(size);
                    setPage(1);
                    loadContracts(1, search, size, statusFilter, typeFilter);
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
          </div>
          {loading ? (
            <p>Carregando...</p>
          ) : (
            <Table
              columns={[
                { key: "contract_number", label: "Contrato" },
                { key: "provider_name", label: "Fornecedor" },
                { key: "type", label: "Tipo" },
                { key: "billing_model", label: "Modelo" },
                { key: "start_date", label: "Início" },
                { key: "end_date", label: "Fim" },
                { key: "status", label: "Status", render: (row) => <StatusBadge status={(row as Contract).status} /> },
                {
                  key: "actions",
                  label: "Ações",
                  render: (row) => (
                    <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.3rem" }}>
                      <Button variant="ghost" onClick={() => handleEdit(row as Contract)}>
                        Editar
                      </Button>
                      <Button variant="ghost" onClick={() => handleDelete((row as Contract).id)}>
                        Excluir
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={contracts}
            />
          )}
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onChange={(p) => {
              setPage(p);
              loadContracts(p, search, pageSize, statusFilter, typeFilter);
            }}
          />
        </div>

        {editingId && (
          <div className="card">
            <h3>Veículos vinculados</h3>
            <p style={{ marginTop: "-0.25rem", color: "var(--muted)", fontSize: "0.9rem" }}>
              Gerencie a cobertura de veículos para o contrato selecionado.
            </p>
            <Table
              columns={[
                { key: "vehicle", label: "Veículo", render: (row) => vehicleLabel.get((row as ContractVehicle).vehicle) ?? (row as ContractVehicle).vehicle },
                { key: "start_date", label: "Início" },
                { key: "end_date", label: "Fim" },
                { key: "custom_billing_model", label: "Modelo" },
                { key: "custom_rate", label: "Tarifa" },
                {
                  key: "actions",
                  label: "Ações",
                  render: (row) => (
                    <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.3rem" }}>
                      <Button variant="ghost" onClick={() => handleLinkEdit(row as ContractVehicle)}>
                        Editar
                      </Button>
                      <Button variant="ghost" onClick={() => handleLinkDelete((row as ContractVehicle).id)}>
                        Excluir
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={contractVehicles}
            />
            <form className="grid form-grid responsive" style={{ marginTop: "0.75rem" }} onSubmit={handleLinkSubmit}>
              <select
                required
                value={linkForm.vehicle ?? ""}
                onChange={(e) => setLinkForm((f) => ({ ...f, vehicle: Number(e.target.value) }))}
              >
                <option value="">Selecione um veículo</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {vehicleLabel.get(v.id)}
                  </option>
                ))}
              </select>
              <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.6rem" }}>
                <input
                  type="date"
                  required
                  value={linkForm.start_date ?? ""}
                  onChange={(e) => setLinkForm((f) => ({ ...f, start_date: e.target.value }))}
                />
                <input
                  type="date"
                  value={linkForm.end_date ?? ""}
                  onChange={(e) => setLinkForm((f) => ({ ...f, end_date: e.target.value || null }))}
                  placeholder="Fim (opcional)"
                />
              </div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.6rem" }}>
                <select
                  value={linkForm.custom_billing_model ?? ""}
                  onChange={(e) =>
                    setLinkForm((f) => ({
                      ...f,
                      custom_billing_model: (e.target.value || null) as ContractVehicle["custom_billing_model"],
                    }))
                  }
                >
                  <option value="">Modelo padrão</option>
                  {BILLING_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Tarifa customizada"
                  value={linkForm.custom_rate ?? ""}
                  onChange={(e) => setLinkForm((f) => ({ ...f, custom_rate: e.target.value === "" ? undefined : Number(e.target.value) }))}
                />
              </div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
                <Button type="submit">{linkEditingId ? "Atualizar vínculo" : "Adicionar veículo"}</Button>
                {linkEditingId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setLinkEditingId(null);
                      setLinkForm({ contract: editingId, custom_billing_model: null });
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>

      {!isMobile && (
        <div className="card">
          <h3>{editingId ? "Editar contrato" : "Novo contrato"}</h3>
          <form className="grid form-grid responsive" onSubmit={handleSubmit}>
          <input
            placeholder="Número do contrato"
            required
            value={form.contract_number ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, contract_number: e.target.value }))}
          />
          <input
            placeholder="Fornecedor"
            required
            value={form.provider_name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, provider_name: e.target.value }))}
          />
          <input
            placeholder="CNPJ do fornecedor"
            value={form.provider_cnpj ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, provider_cnpj: e.target.value }))}
          />
          <textarea
            placeholder="Descrição"
            value={form.description ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
          />
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.6rem" }}>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Contract["type"] }))}>
              {CONTRACT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={form.billing_model}
              onChange={(e) => setForm((f) => ({ ...f, billing_model: e.target.value as Contract["billing_model"] }))}
            >
              {BILLING_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.6rem" }}>
            <input
              type="date"
              required
              value={form.start_date ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            />
            <input
              type="date"
              required
              value={form.end_date ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            />
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.6rem" }}>
            <input
              type="number"
              step="0.01"
              placeholder="Valor base"
              required
              value={form.base_value ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, base_value: e.target.value === "" ? undefined : Number(e.target.value) }))}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Valor por KM extra"
              value={form.extra_km_rate ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, extra_km_rate: e.target.value === "" ? undefined : Number(e.target.value) }))}
            />
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.6rem" }}>
            <input
              type="number"
              placeholder="Franquia de KM/mês"
              value={form.included_km_per_month ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, included_km_per_month: e.target.value === "" ? undefined : Number(e.target.value) }))}
            />
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Contract["status"] }))}
            >
              {CONTRACT_STATUS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            placeholder="Observações"
            value={form.notes ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
          />
          <div>
            <label style={{ display: "block", marginBottom: "0.3rem" }}>Prefeitura</label>
            <select
              disabled={disableMunicipalitySelect}
              value={form.municipality ?? current?.municipality ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, municipality: Number(e.target.value) }))}
            >
              <option value="">Selecione</option>
              {municipalities.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {form.municipality && <p style={{ color: "var(--muted)", marginTop: "0.3rem" }}>{municipalityName.get(form.municipality)}</p>}
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
            <Button type="submit">{editingId ? "Atualizar" : "Salvar"}</Button>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm({ type: "RENTAL", billing_model: "FIXED", status: "ACTIVE" });
                  setLinkForm({ custom_billing_model: null });
                  setLinkEditingId(null);
                  setContractVehicles([]);
                }}
              >
                Cancelar
              </Button>
            )}
          </div>
          </form>
        </div>
      )}
      {isMobile && (
        <Modal
          open={showFormModal}
          onClose={() => setShowFormModal(false)}
          title={editingId ? "Editar contrato" : "Novo contrato"}
          id="contract-modal"
        >
          <form className="grid form-grid responsive" onSubmit={handleSubmit}>
            <input
              placeholder="Número do contrato"
              required
              value={form.contract_number ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, contract_number: e.target.value }))}
            />
            <input
              placeholder="Fornecedor"
              required
              value={form.provider_name ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, provider_name: e.target.value }))}
            />
            <input
              placeholder="CNPJ do fornecedor"
              value={form.provider_cnpj ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, provider_cnpj: e.target.value }))}
            />
            <textarea
              placeholder="Descrição"
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
            />
            <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.6rem" }}>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Contract["type"] }))}>
                {CONTRACT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                value={form.billing_model}
                onChange={(e) => setForm((f) => ({ ...f, billing_model: e.target.value as Contract["billing_model"] }))}
              >
                {BILLING_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.6rem" }}>
              <input
                type="date"
                required
                value={form.start_date ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
              <input
                type="date"
                required
                value={form.end_date ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              />
            </div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.6rem" }}>
              <input
                type="number"
                step="0.01"
                placeholder="Valor base"
                required
                value={form.base_value ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, base_value: e.target.value === "" ? undefined : Number(e.target.value) }))}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Valor por KM extra"
                value={form.extra_km_rate ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, extra_km_rate: e.target.value === "" ? undefined : Number(e.target.value) }))}
              />
            </div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.6rem" }}>
              <input
                type="number"
                placeholder="Franquia de KM/mês"
                value={form.included_km_per_month ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, included_km_per_month: e.target.value === "" ? undefined : Number(e.target.value) }))}
              />
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Contract["status"] }))}
              >
                {CONTRACT_STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              placeholder="Observações"
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
            <div>
              <label style={{ display: "block", marginBottom: "0.3rem" }}>Prefeitura</label>
              <select
                disabled={disableMunicipalitySelect}
                value={form.municipality ?? current?.municipality ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, municipality: Number(e.target.value) }))}
              >
                <option value="">Selecione</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              {form.municipality && (
                <p style={{ color: "var(--muted)", marginTop: "0.3rem" }}>{municipalityName.get(form.municipality)}</p>
              )}
            </div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
              <Button type="submit">{editingId ? "Atualizar" : "Salvar"}</Button>
              {editingId && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null);
                    setForm({ type: "RENTAL", billing_model: "FIXED", status: "ACTIVE" });
                    setLinkForm({ custom_billing_model: null });
                    setLinkEditingId(null);
                    setContractVehicles([]);
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
