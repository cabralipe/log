import { useEffect, useMemo, useState } from "react";
import { api, type Paginated } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { Pagination } from "../components/Pagination";
import { StatusBadge } from "../components/StatusBadge";

type RentalPeriod = {
  id: number;
  municipality: number;
  contract: number;
  vehicle: number | null;
  start_datetime: string;
  end_datetime: string | null;
  odometer_start: number | null;
  odometer_end: number | null;
  billed_km: number | null;
  billed_amount: number | null;
  status: "OPEN" | "CLOSED" | "INVOICED";
};

type Contract = { id: number; contract_number: string; provider_name: string };
type Vehicle = { id: number; license_plate: string; brand: string; model: string };

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Aberto" },
  { value: "CLOSED", label: "Fechado" },
  { value: "INVOICED", label: "Faturado" },
] as const;

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatMoney = (value?: number | null) => {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
};

export const RentalPeriodsPage = () => {
  const [periods, setPeriods] = useState<RentalPeriod[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [form, setForm] = useState<Partial<RentalPeriod>>({
    status: "OPEN",
    start_datetime: new Date().toISOString().slice(0, 16),
  });
  const [closeForm, setCloseForm] = useState<Partial<RentalPeriod>>({});
  const [closingId, setClosingId] = useState<number | null>(null);
  const [filterContract, setFilterContract] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const contractLabel = useMemo(() => {
    const map = new Map<number, string>();
    contracts.forEach((c) => map.set(c.id, `${c.contract_number} - ${c.provider_name}`));
    return map;
  }, [contracts]);

  const vehicleLabel = useMemo(() => {
    const map = new Map<number, string>();
    vehicles.forEach((v) => map.set(v.id, `${v.license_plate} - ${v.brand} ${v.model}`));
    return map;
  }, [vehicles]);

  const loadPeriods = (nextPage = page, nextContract = filterContract, nextStatus = filterStatus, nextPageSize = pageSize) => {
    setLoading(true);
    api
      .get<Paginated<RentalPeriod>>("/rental-periods/", {
        params: {
          page: nextPage,
          page_size: nextPageSize,
          contract: nextContract || undefined,
          status: nextStatus || undefined,
        },
      })
      .then((res) => {
        const data = res.data as any;
        if (Array.isArray(data)) {
          setPeriods(data);
          setTotal(data.length);
        } else {
          setPeriods(data.results);
          setTotal(data.count);
        }
        setError(null);
      })
      .catch((err) => setError(err.response?.data?.detail || "Erro ao carregar períodos."))
      .finally(() => setLoading(false));
  };

  const loadOptions = () => {
    api
      .get<Paginated<Contract>>("/contracts/", { params: { page_size: 500 } })
      .then((res) => {
        const data = res.data as any;
        setContracts(Array.isArray(data) ? data : data.results);
      })
      .catch(() => {});

    api
      .get<Paginated<Vehicle>>("/vehicles/", { params: { page_size: 500 } })
      .then((res) => {
        const data = res.data as any;
        setVehicles(Array.isArray(data) ? data : data.results);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadPeriods();
    loadOptions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form };
    await api.post("/rental-periods/", payload);
    setForm({
      status: "OPEN",
      start_datetime: new Date().toISOString().slice(0, 16),
    });
    loadPeriods();
  };

  const prepareClose = (period: RentalPeriod) => {
    setClosingId(period.id);
    setCloseForm({
      end_datetime: period.end_datetime ? period.end_datetime.slice(0, 16) : new Date().toISOString().slice(0, 16),
      odometer_start: period.odometer_start ?? undefined,
      odometer_end: period.odometer_end ?? undefined,
    });
  };

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingId) return;
    await api.patch(`/rental-periods/${closingId}/close/`, {
      end_datetime: closeForm.end_datetime,
      odometer_start: closeForm.odometer_start,
      odometer_end: closeForm.odometer_end,
    });
    setClosingId(null);
    setCloseForm({});
    loadPeriods();
  };

  const handleInvoice = async (id: number) => {
    await api.patch(`/rental-periods/${id}/invoice/`);
    loadPeriods();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deseja remover este período?")) return;
    await api.delete(`/rental-periods/${id}/`);
    if (closingId === id) {
      setClosingId(null);
      setCloseForm({});
    }
    loadPeriods();
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr", gap: "1rem" }}>
      <div className="grid" style={{ gap: "1rem" }}>
        <div className="card">
          <h3>Novo período</h3>
          <form className="grid form-grid responsive" onSubmit={handleSubmit}>
            <select
              required
              value={form.contract ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, contract: Number(e.target.value) }))}
            >
              <option value="">Contrato</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {contractLabel.get(c.id)}
                </option>
              ))}
            </select>
            <select
              value={form.vehicle ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, vehicle: e.target.value === "" ? null : Number(e.target.value) }))}
            >
              <option value="">Veículo (opcional)</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {vehicleLabel.get(v.id)}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              required
              value={form.start_datetime ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, start_datetime: e.target.value }))}
            />
            <input
              type="number"
              placeholder="Odômetro inicial (opcional)"
              value={form.odometer_start ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, odometer_start: e.target.value === "" ? undefined : Number(e.target.value) }))}
            />
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as RentalPeriod["status"] }))}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <Button type="submit">Iniciar período</Button>
          </form>
        </div>
        <div>
          <h2>Períodos de locação</h2>
          {error && <div className="card" style={{ color: "#f87171" }}>{error}</div>}
          <div style={{ marginBottom: "0.75rem", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.5rem" }}>
            <select
              value={filterContract}
              onChange={(e) => {
                const next = e.target.value;
                setFilterContract(next);
                setPage(1);
                loadPeriods(1, next, filterStatus, pageSize);
              }}
            >
              <option value="">Contrato (todos)</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {contractLabel.get(c.id)}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => {
                const next = e.target.value;
                setFilterStatus(next);
                setPage(1);
                loadPeriods(1, filterContract, next, pageSize);
              }}
            >
              <option value="">Status (todos)</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
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
                  loadPeriods(1, filterContract, filterStatus, size);
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
          {loading ? (
            <p>Carregando...</p>
          ) : (
            <Table
              columns={[
                { key: "contract", label: "Contrato", render: (row) => contractLabel.get((row as RentalPeriod).contract) ?? (row as RentalPeriod).contract },
                { key: "vehicle", label: "Veículo", render: (row) => (row as RentalPeriod).vehicle ? vehicleLabel.get((row as RentalPeriod).vehicle as number) ?? (row as RentalPeriod).vehicle : "—" },
                { key: "start_datetime", label: "Início", render: (row) => formatDateTime((row as RentalPeriod).start_datetime) },
                { key: "end_datetime", label: "Fim", render: (row) => formatDateTime((row as RentalPeriod).end_datetime) },
                { key: "status", label: "Status", render: (row) => <StatusBadge status={(row as RentalPeriod).status} /> },
                { key: "billed_amount", label: "Valor", render: (row) => formatMoney((row as RentalPeriod).billed_amount) },
                {
                  key: "actions",
                  label: "Ações",
                  render: (row) => {
                    const period = row as RentalPeriod;
                    return (
                      <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.3rem" }}>
                        {period.status === "OPEN" && (
                          <Button variant="ghost" onClick={() => prepareClose(period)}>
                            Encerrar
                          </Button>
                        )}
                        {period.status === "CLOSED" && (
                          <Button variant="ghost" onClick={() => handleInvoice(period.id)}>
                            Faturar
                          </Button>
                        )}
                        <Button variant="ghost" onClick={() => handleDelete(period.id)}>
                          Excluir
                        </Button>
                      </div>
                    );
                  },
                },
              ]}
              data={periods}
            />
          )}
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onChange={(p) => {
              setPage(p);
              loadPeriods(p, filterContract, filterStatus, pageSize);
            }}
          />
        </div>

        {closingId && (
          <div className="card">
            <h3>Encerrar período</h3>
            <form className="grid form-grid responsive" onSubmit={handleClose}>
              <input
                type="datetime-local"
                required
                value={closeForm.end_datetime ?? ""}
                onChange={(e) => setCloseForm((f) => ({ ...f, end_datetime: e.target.value }))}
              />
              <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.6rem" }}>
                <input
                  type="number"
                  placeholder="Odômetro inicial"
                  value={closeForm.odometer_start ?? ""}
                  onChange={(e) => setCloseForm((f) => ({ ...f, odometer_start: e.target.value === "" ? undefined : Number(e.target.value) }))}
                />
                <input
                  type="number"
                  placeholder="Odômetro final"
                  value={closeForm.odometer_end ?? ""}
                  onChange={(e) => setCloseForm((f) => ({ ...f, odometer_end: e.target.value === "" ? undefined : Number(e.target.value) }))}
                />
              </div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
                <Button type="submit">Confirmar encerramento</Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setClosingId(null);
                    setCloseForm({});
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
