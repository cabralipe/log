import { useEffect, useMemo, useState } from "react";
import "./Contracts.css";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { Modal } from "../../components/Modal";
import {
  Plus,
  FileText,
  CheckCircle,
  Clock,
  DollarSign,
  Search,
  Filter,
  Car,
  AlertTriangle,
  Info,
  Calendar,
  Building2,
  Trash2,
  Edit3,
  ChevronRight
} from "lucide-react";
import { api, type Paginated } from "../../lib/api";
import { Table } from "../../components/Table";
import { Button } from "../../components/Button";
import { Pagination } from "../../components/Pagination";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../hooks/useAuth";
import { formatCnpj } from "../../utils/masks";
import "../../styles/DataPage.css";

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

type Vehicle = { id: number; license_plate: string; brand: string; model: string; municipality?: number };
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

const normalizeError = (err: any, fallback: string) => {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data.detail === "string") return data.detail;
  const first = Object.values(data)[0];
  if (Array.isArray(first)) return String(first[0]);
  if (typeof first === "string") return first;
  return fallback;
};

export const ContractsPage = () => {
  const { user: current } = useAuth();
  const { isMobile } = useMediaQuery();
  const [showFormModal, setShowFormModal] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [contractVehicles, setContractVehicles] = useState<ContractVehicle[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<number[]>([]);

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
  const [showListModal, setShowListModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Stats
  const stats = useMemo(() => {
    const active = contracts.filter(c => c.status === "ACTIVE").length;
    const expired = contracts.filter(c => c.status === "EXPIRED").length;
    const totalValue = contracts.reduce((acc, c) => acc + (c.status === "ACTIVE" ? Number(c.base_value) : 0), 0);

    return {
      total: total,
      active,
      expired,
      totalValue
    };
  }, [contracts, total]);

  const vehicleLabel = useMemo(() => {
    const map = new Map<number, string>();
    vehicles.forEach((v) => map.set(v.id, `${v.license_plate} - ${v.brand} ${v.model}`));
    return map;
  }, [vehicles]);

  const availableVehicles = useMemo(() => {
    const muni = form.municipality ?? current?.municipality;
    if (!muni) return vehicles;
    return vehicles.filter((v) => v.municipality === muni);
  }, [vehicles, form.municipality, current?.municipality]);

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
      .catch(() => { });

    if (current?.role === "SUPERADMIN") {
      api
        .get<Paginated<Municipality>>("/municipalities/", { params: { page_size: 1000 } })
        .then((res) => {
          const data = res.data as any;
          setMunicipalities(Array.isArray(data) ? data : data.results);
        })
        .catch(() => { });
      return;
    }

    if (current?.municipality) {
      api
        .get<Municipality>(`/municipalities/${current.municipality}/`)
        .then((res) => setMunicipalities([res.data]))
        .catch(() => { });
    }
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (current) {
      loadOptions();
    }
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadContractVehicles(editingId);
    setLinkForm((prev) => ({ ...prev, contract: editingId ?? undefined }));
  }, [editingId]);

  useEffect(() => {
    if (editingId) {
      setSelectedVehicleIds(contractVehicles.map((link) => link.vehicle));
    } else {
      setSelectedVehicleIds([]);
    }
  }, [editingId, contractVehicles]);

  useEffect(() => {
    const muni = form.municipality ?? current?.municipality;
    if (!muni) return;
    setSelectedVehicleIds((prev) => prev.filter((id) => availableVehicles.some((v) => v.id === id)));
  }, [form.municipality, current?.municipality, availableVehicles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, vehicle_ids: selectedVehicleIds };
    if (editingId) {
      await api.patch(`/contracts/${editingId}/`, payload);
    } else {
      await api.post("/contracts/", payload);
    }
    setForm({ type: "RENTAL", billing_model: "FIXED", status: "ACTIVE" });
    setSelectedVehicleIds([]);
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
    try {
      if (linkEditingId) {
        await api.patch(`/contract-vehicles/${linkEditingId}/`, payload);
      } else {
        await api.post("/contract-vehicles/", payload);
      }
      setLinkError(null);
      setLinkForm({ contract: editingId, custom_billing_model: null });
      setLinkEditingId(null);
      loadContractVehicles(editingId);
    } catch (err: any) {
      setLinkError(normalizeError(err, "Erro ao vincular veículo."));
    }
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
    <div className="data-page">
      <div className="data-header">
        <div>
          <h1 className="data-title">Gestão de Contratos</h1>
          <p className="data-subtitle">Administre contratos de locação, leasing e serviços da frota municipal.</p>
        </div>

        <Button
          variant="outline"
          icon={FileText}
          onClick={() => setShowListModal(true)}
        >
          Ver Lista de Contratos
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <FileText size={24} />
          </div>
          <div className="stat-info">
            <h4>Total de Contratos</h4>
            <p>{stats.total}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: "#10b981", background: "rgba(16, 185, 129, 0.1)" }}>
            <CheckCircle size={24} />
          </div>
          <div className="stat-info">
            <h4>Contratos Ativos</h4>
            <p>{stats.active}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: "#f59e0b", background: "rgba(245, 158, 11, 0.1)" }}>
            <Clock size={24} />
          </div>
          <div className="stat-info">
            <h4>Vencidos/Inativos</h4>
            <p>{stats.expired}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: "#3b82f6", background: "rgba(59, 130, 246, 0.1)" }}>
            <DollarSign size={24} />
          </div>
          <div className="stat-info">
            <h4>Valor Ativo Mensal</h4>
            <p>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.totalValue)}</p>
          </div>
        </div>
      </div>

      <div className="contracts-layout">
        <div className="main-content">
          <div className="card contracts-form-card">
            <div className="sidebar-header" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-strong)' }}>
                {editingId ? <Edit3 size={22} /> : <Plus size={22} />}
                {editingId ? "Editar Contrato" : "Novo Contrato"}
              </h3>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
                {editingId ? "Atualize as informações do contrato selecionado." : "Preencha os dados abaixo para registrar um novo contrato."}
              </p>
            </div>

            <form className="grid form-grid" onSubmit={handleSubmit} style={{ gap: '1.25rem' }}>
              <div className="form-section-title">Informações Básicas</div>
              <div className="grid responsive" style={{ gap: '0.75rem' }}>
                <div className="input-group">
                  <label>Número do Contrato</label>
                  <input
                    placeholder="Ex: 001/2024"
                    required
                    value={form.contract_number ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, contract_number: e.target.value }))}
                  />
                </div>
                <div className="input-group">
                  <label>Fornecedor</label>
                  <input
                    placeholder="Nome da empresa"
                    required
                    value={form.provider_name ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, provider_name: e.target.value }))}
                  />
                </div>
              </div>

              <div className="input-group">
                <label>CNPJ do Fornecedor</label>
                <input
                  placeholder="00.000.000/0000-00"
                  value={form.provider_cnpj ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, provider_cnpj: formatCnpj(e.target.value) }))}
                  inputMode="numeric"
                  maxLength={18}
                />
              </div>

              <div className="input-group">
                <label>Descrição / Objeto</label>
                <textarea
                  placeholder="Breve descrição do contrato..."
                  value={form.description ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>

              <div className="form-section-title">Configurações e Valores</div>
              <div className="grid responsive" style={{ gap: '0.75rem' }}>
                <div className="input-group">
                  <label>Tipo</label>
                  <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Contract["type"] }))}>
                    {CONTRACT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>Modelo de Cobrança</label>
                  <select
                    value={form.billing_model}
                    onChange={(e) => setForm((f) => ({ ...f, billing_model: e.target.value as Contract["billing_model"] }))}
                  >
                    {BILLING_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid responsive" style={{ gap: '0.75rem' }}>
                <div className="input-group">
                  <label>Data Início</label>
                  <input
                    type="date"
                    required
                    value={form.start_date ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
                <div className="input-group">
                  <label>Data Fim</label>
                  <input
                    type="date"
                    required
                    value={form.end_date ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid responsive" style={{ gap: '0.75rem' }}>
                <div className="input-group">
                  <label>Valor Base</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '0.85rem' }}>R$</span>
                    <input
                      type="number"
                      step="0.01"
                      style={{ paddingLeft: '2.25rem' }}
                      placeholder="0,00"
                      required
                      value={form.base_value ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, base_value: e.target.value === "" ? undefined : Number(e.target.value) }))}
                    />
                  </div>
                </div>
                <div className="input-group">
                  <label>KM Extra (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={form.extra_km_rate ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, extra_km_rate: e.target.value === "" ? undefined : Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="grid responsive" style={{ gap: '0.75rem' }}>
                <div className="input-group">
                  <label>Franquia KM</label>
                  <input
                    type="number"
                    placeholder="KM/mês"
                    value={form.included_km_per_month ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, included_km_per_month: e.target.value === "" ? undefined : Number(e.target.value) }))}
                  />
                </div>
                <div className="input-group">
                  <label>Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Contract["status"] }))}
                  >
                    {CONTRACT_STATUS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label>Prefeitura</label>
                <select
                  disabled={disableMunicipalitySelect}
                  value={form.municipality ?? current?.municipality ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, municipality: Number(e.target.value) }))}
                >
                  <option value="">Selecione</option>
                  {municipalities.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <Button type="submit" style={{ flex: 1 }}>{editingId ? "Atualizar" : "Salvar Contrato"}</Button>
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

            {/* Vehicle Linking Section */}
            {editingId && (
              <div className="vehicle-link-section">
                <div className="vehicle-link-header">
                  <h4 style={{ margin: 0, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Car size={16} /> Veículos Vinculados
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-strong)' }}>{contractVehicles.length} total</span>
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  {contractVehicles.length === 0 ? (
                    <p style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted)' }}>Nenhum veículo vinculado.</p>
                  ) : (
                    <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left' }}>
                          <th style={{ padding: '0.5rem' }}>Placa</th>
                          <th style={{ padding: '0.5rem' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contractVehicles.map(cv => (
                          <tr key={cv.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '0.5rem' }}>{vehicleLabel.get(cv.vehicle)?.split(' - ')[0]}</td>
                            <td style={{ padding: '0.5rem' }}>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button onClick={() => handleLinkEdit(cv)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><Edit3 size={12} /></button>
                                <button onClick={() => handleLinkDelete(cv.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={12} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <form onSubmit={handleLinkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <select
                    required
                    style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                    value={linkForm.vehicle ?? ""}
                    onChange={(e) => setLinkForm((f) => ({ ...f, vehicle: Number(e.target.value) }))}
                  >
                    <option value="">Vincular Veículo...</option>
                    {availableVehicles.map((v) => (
                      <option key={v.id} value={v.id}>{v.license_plate} - {v.brand} {v.model}</option>
                    ))}
                  </select>
                  <div className="grid responsive" style={{ gap: '0.5rem' }}>
                    <input
                      type="date"
                      required
                      style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                      value={linkForm.start_date ?? ""}
                      onChange={(e) => setLinkForm((f) => ({ ...f, start_date: e.target.value }))}
                    />
                    <Button type="submit" size="sm" icon={Plus}>Vincular</Button>
                  </div>
                  {linkError && <p style={{ color: 'var(--danger)', fontSize: '0.75rem', margin: 0 }}>{linkError}</p>}
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contract List Modal */}
      <Modal
        open={showListModal}
        onClose={() => setShowListModal(false)}
        title="Lista de Contratos"
        size="xl"
      >
        <div className="contracts-controls">
          <div className="search-bar-container">
            <Search className="search-icon" size={18} />
            <input
              className="search-input"
              placeholder="Buscar por número, fornecedor ou descrição..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
                loadContracts(1, e.target.value);
              }}
            />
          </div>
          <div className="filters-row">
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: '150px' }}>
              <Filter size={14} style={{ position: 'absolute', left: '0.75rem', color: 'var(--muted)' }} />
              <select
                className="filter-select"
                style={{ paddingLeft: '2.25rem', width: '100%' }}
                value={statusFilter}
                onChange={(e) => {
                  const next = e.target.value;
                  setStatusFilter(next);
                  setPage(1);
                  loadContracts(1, search, pageSize, next, typeFilter);
                }}
              >
                <option value="">Todos os Status</option>
                {CONTRACT_STATUS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: '150px' }}>
              <Building2 size={14} style={{ position: 'absolute', left: '0.75rem', color: 'var(--muted)' }} />
              <select
                className="filter-select"
                style={{ paddingLeft: '2.25rem', width: '100%' }}
                value={typeFilter}
                onChange={(e) => {
                  const next = e.target.value;
                  setTypeFilter(next);
                  setPage(1);
                  loadContracts(1, search, pageSize, statusFilter, next);
                }}
              >
                <option value="">Todos os Tipos</option>
                {CONTRACT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
              <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Exibir:</span>
              <select
                className="filter-select"
                style={{ minWidth: '80px' }}
                value={pageSize}
                onChange={(e) => {
                  const size = Number(e.target.value);
                  setPageSize(size);
                  setPage(1);
                  loadContracts(1, search, size, statusFilter, typeFilter);
                }}
              >
                {[8, 15, 30, 50].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="contract-table-container">
          {error && <div className="data-error" style={{ margin: '1rem' }}>{error}</div>}
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
              <Clock className="spin" size={24} style={{ marginBottom: '0.5rem' }} />
              <p>Carregando contratos...</p>
            </div>
          ) : (
            <Table
              columns={[
                {
                  key: "contract_number",
                  label: "Contrato",
                  render: (row) => (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{(row as Contract).contract_number}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{(row as Contract).provider_name}</span>
                    </div>
                  )
                },
                {
                  key: "type",
                  label: "Tipo",
                  render: (row) => (
                    <span style={{ fontSize: '0.85rem' }}>
                      {CONTRACT_TYPES.find(t => t.value === (row as Contract).type)?.label}
                    </span>
                  )
                },
                {
                  key: "billing_model",
                  label: "Modelo",
                  render: (row) => (
                    <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                      {BILLING_MODELS.find(m => m.value === (row as Contract).billing_model)?.label}
                    </span>
                  )
                },
                {
                  key: "dates",
                  label: "Vigência",
                  render: (row) => (
                    <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>{new Date((row as Contract).start_date).toLocaleDateString()}</span>
                      <ChevronRight size={12} style={{ color: 'var(--muted)' }} />
                      <span>{new Date((row as Contract).end_date).toLocaleDateString()}</span>
                    </div>
                  )
                },
                { key: "status", label: "Status", render: (row) => <StatusBadge status={(row as Contract).status} /> },
                {
                  key: "actions",
                  label: "Ações",
                  render: (row) => (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          handleEdit(row as Contract);
                          setShowListModal(false);
                        }}
                        title="Editar"
                      >
                        <Edit3 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete((row as Contract).id)}
                        title="Excluir"
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={contracts}
            />
          )}
        </div>
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onChange={(p) => {
            setPage(p);
            loadContracts(p, search, pageSize, statusFilter, typeFilter);
          }}
        />
      </Modal>



      {isMobile && (
        <button
          className="fab-button"
          onClick={() => {
            setEditingId(null);
            setForm({ type: "RENTAL", billing_model: "FIXED", status: "ACTIVE" });
            setShowFormModal(true);
          }}
        >
          <Plus size={24} />
        </button>
      )}

      {showFormModal && isMobile && (
        <Modal
          open={showFormModal}
          onClose={() => setShowFormModal(false)}
          title={editingId ? "Editar Contrato" : "Novo Contrato"}
          id="contract-modal"
        >
          <form className="grid form-grid responsive" onSubmit={handleSubmit} style={{ gap: '1rem' }}>
            <div className="input-group">
              <label>Número do Contrato</label>
              <input
                placeholder="Número"
                required
                value={form.contract_number ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, contract_number: e.target.value }))}
              />
            </div>
            <div className="input-group">
              <label>Fornecedor</label>
              <input
                placeholder="Fornecedor"
                required
                value={form.provider_name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, provider_name: e.target.value }))}
              />
            </div>
            <div className="input-group">
              <label>CNPJ</label>
              <input
                placeholder="CNPJ"
                value={form.provider_cnpj ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, provider_cnpj: formatCnpj(e.target.value) }))}
                inputMode="numeric"
                maxLength={18}
              />
            </div>
            <div className="input-group">
              <label>Descrição</label>
              <textarea
                placeholder="Descrição"
                value={form.description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid responsive" style={{ gap: '0.75rem' }}>
              <div className="input-group">
                <label>Tipo</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Contract["type"] }))}>
                  {CONTRACT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Modelo</label>
                <select
                  value={form.billing_model}
                  onChange={(e) => setForm((f) => ({ ...f, billing_model: e.target.value as Contract["billing_model"] }))}
                >
                  {BILLING_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid responsive" style={{ gap: '0.75rem' }}>
              <div className="input-group">
                <label>Início</label>
                <input
                  type="date"
                  required
                  value={form.start_date ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div className="input-group">
                <label>Fim</label>
                <input
                  type="date"
                  required
                  value={form.end_date ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid responsive" style={{ gap: '0.75rem' }}>
              <div className="input-group">
                <label>Valor Base</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Valor base"
                  required
                  value={form.base_value ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, base_value: e.target.value === "" ? undefined : Number(e.target.value) }))}
                />
              </div>
              <div className="input-group">
                <label>KM Extra</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Valor KM extra"
                  value={form.extra_km_rate ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, extra_km_rate: e.target.value === "" ? undefined : Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="grid responsive" style={{ gap: '0.75rem' }}>
              <div className="input-group">
                <label>Franquia KM</label>
                <input
                  type="number"
                  placeholder="Franquia KM"
                  value={form.included_km_per_month ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, included_km_per_month: e.target.value === "" ? undefined : Number(e.target.value) }))}
                />
              </div>
              <div className="input-group">
                <label>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Contract["status"] }))}
                >
                  {CONTRACT_STATUS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="input-group">
              <label>Prefeitura</label>
              <select
                disabled={disableMunicipalitySelect}
                value={form.municipality ?? current?.municipality ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, municipality: Number(e.target.value) }))}
              >
                <option value="">Selecione</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="form-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <Button type="submit" style={{ flex: 1 }}>{editingId ? "Atualizar" : "Salvar"}</Button>
              <Button variant="ghost" onClick={() => setShowFormModal(false)}>Fechar</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
