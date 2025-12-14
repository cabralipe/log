import { useEffect, useState } from "react";
import { api, type Paginated } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { Pagination } from "../components/Pagination";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { FloatingActionButton } from "../components/FloatingActionButton";
import { Modal } from "../components/Modal";
import { formatCpf } from "../utils/masks";
import "../styles/DataPage.css";

type PassengerDetail = {
  name: string;
  cpf: string;
  age?: number | null;
  special_need: "NONE" | "TEA" | "ELDERLY" | "PCD" | "OTHER";
  special_need_other?: string;
  observation?: string;
};

type Vehicle = { id: number; license_plate: string; max_passengers: number };
type Driver = { id: number; name: string };
type Trip = {
  id: number;
  origin: string;
  destination: string;
  category: "PASSENGER" | "OBJECT" | "MIXED";
  passengers_details?: PassengerDetail[];
  stops_description?: string;
  notes?: string;
  cargo_description?: string;
  cargo_size?: string;
  cargo_quantity?: number;
  cargo_purpose?: string;
  departure_datetime: string;
  return_datetime_expected: string;
  return_datetime_actual?: string | null;
  status: string;
  vehicle: number;
  driver: number;
  passengers_count: number;
  odometer_start: number;
  odometer_end?: number | null;
  wa_link?: string;
};

export const TripsPage = () => {
  const { isMobile } = useMediaQuery();
  const specialNeedOptions = [
    { value: "NONE", label: "Nenhum" },
    { value: "TEA", label: "TEA" },
    { value: "ELDERLY", label: "Idoso" },
    { value: "PCD", label: "PCD" },
    { value: "OTHER", label: "Outro" },
  ];
  const categoryLabels: Record<Trip["category"], string> = {
    PASSENGER: "Passageiro",
    OBJECT: "Objeto",
    MIXED: "Passageiro + Objeto",
  };
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Trip>>({
    category: "PASSENGER",
    status: "PLANNED",
    passengers_count: 0,
    passengers_details: [],
    stops_description: "",
    notes: "",
    cargo_description: "",
    cargo_size: "",
    cargo_quantity: 0,
    cargo_purpose: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [completion, setCompletion] = useState<{ tripId: number | ""; odometer_end: number | ""; return_datetime_actual: string }>({
    tripId: "",
    odometer_end: "",
    return_datetime_actual: "",
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [usePassengerList, setUsePassengerList] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const formatError = (payload: any) => {
    if (!payload) return "Erro ao salvar viagem.";
    if (typeof payload === "string") return payload;
    if (Array.isArray(payload)) return payload.join(", ");
    if (typeof payload === "object") return Object.values(payload).flat().join(" / ");
    return "Erro ao salvar viagem.";
  };

  const load = (nextPage = page, nextSearch = search, nextStatus = statusFilter, nextPageSize = pageSize) => {
    api
      .get<Paginated<Trip>>("/trips/", {
        params: { page: nextPage, page_size: nextPageSize, search: nextSearch, status: nextStatus || undefined },
      })
      .then((res) => {
        const data = res.data as any;
        if (Array.isArray(data)) {
          setTrips(data);
          setTotal(data.length);
        } else {
          setTrips(data.results);
          setTotal(data.count);
        }
        setError(null);
      })
      .catch((err) => setError(err.response?.data?.detail || "Erro ao carregar viagens."));
    api.get<Paginated<Vehicle>>("/vehicles/", { params: { page_size: 100 } }).then((res) => {
      const data = res.data as any;
      setVehicles(Array.isArray(data) ? data : data.results);
    });
    api.get<Paginated<Driver>>("/drivers/", { params: { page_size: 100 } }).then((res) => {
      const data = res.data as any;
      setDrivers(Array.isArray(data) ? data : data.results);
    });
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const category = form.category || "PASSENGER";
    const passengerList = category === "OBJECT" ? [] : usePassengerList ? form.passengers_details || [] : [];
    const passengerCount = category === "OBJECT" ? 0 : usePassengerList ? passengerList.length : Number(form.passengers_count) || 0;
    if (usePassengerList && category !== "OBJECT") {
      for (const [idx, p] of passengerList.entries()) {
        if (!p.name?.trim()) {
          setError(`Informe o nome do passageiro #${idx + 1}.`);
          return;
        }
        if (!p.cpf?.trim()) {
          setError(`Informe o CPF do passageiro #${idx + 1}.`);
          return;
        }
        if (p.special_need === "OTHER" && !p.special_need_other?.trim()) {
          setError(`Descreva o atendimento especial do passageiro #${idx + 1}.`);
          return;
        }
      }
    }
    if (category === "OBJECT" || category === "MIXED") {
      if (!form.cargo_description || !form.cargo_size || !form.cargo_purpose) {
        setError("Descreva o pacote (descricao, tamanho e finalidade) para viagens com objeto.");
        return;
      }
      if (!form.cargo_quantity || Number(form.cargo_quantity) < 1) {
        setError("Informe a quantidade de volumes para o objeto.");
        return;
      }
    }
    const selectedVehicle = vehicles.find((v) => v.id === form.vehicle);
    if (selectedVehicle && passengerCount > selectedVehicle.max_passengers) {
      setError("Quantidade de passageiros excede a capacidade do veículo.");
      return;
    }
    const payload = {
      ...form,
      category,
      passengers_count: passengerCount,
      passengers_details: usePassengerList ? passengerList : [],
    };
    try {
      if (editingId) {
        await api.patch(`/trips/${editingId}/`, payload);
      } else {
        await api.post("/trips/", payload);
      }
      setForm({
        category: "PASSENGER",
        status: "PLANNED",
        passengers_count: 0,
        passengers_details: [],
        stops_description: "",
        notes: "",
        cargo_description: "",
        cargo_purpose: "",
        cargo_size: "",
        cargo_quantity: 0,
      });
      setEditingId(null);
      setUsePassengerList(false);
      setError(null);
      load();
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.response?.data || "Erro ao salvar viagem.";
      setError(formatError(detail));
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completion.tripId) return;
    await api.patch(`/trips/${completion.tripId}/`, {
      status: "COMPLETED",
      odometer_end: completion.odometer_end,
      return_datetime_actual: completion.return_datetime_actual,
    });
    setCompletion({ tripId: "", odometer_end: "", return_datetime_actual: "" });
    load();
  };

  const buildWhatsapp = async (id: number) => {
    const { data } = await api.get<{ message: string; wa_link: string }>(`/trips/${id}/whatsapp_message/`);
    setMessage(data.wa_link);
  };

  const handleEdit = (trip: Trip) => {
    setEditingId(trip.id);
    setUsePassengerList(Boolean(trip.passengers_details?.length) && trip.category !== "OBJECT");
    setForm({
      origin: trip.origin,
      destination: trip.destination,
      category: trip.category,
      stops_description: trip.stops_description,
      notes: trip.notes,
      cargo_description: trip.cargo_description,
      cargo_purpose: trip.cargo_purpose,
      cargo_size: trip.cargo_size,
      cargo_quantity: trip.cargo_quantity,
      departure_datetime: trip.departure_datetime,
      return_datetime_expected: trip.return_datetime_expected,
      passengers_count: trip.passengers_details?.length || trip.passengers_count,
      passengers_details: trip.passengers_details || [],
      vehicle: trip.vehicle,
      driver: trip.driver,
      status: trip.status,
      odometer_start: trip.odometer_start,
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deseja remover esta viagem?")) return;
    try {
      await api.delete(`/trips/${id}/`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao remover viagem.");
    }
  };

  const addPassenger = () => {
    setUsePassengerList(true);
    setForm((f) => {
      const list = [...(f.passengers_details || [])];
      list.push({
        name: "",
        cpf: "",
        age: undefined,
        special_need: "NONE",
        special_need_other: "",
        observation: "",
      });
      return { ...f, passengers_details: list, passengers_count: list.length };
    });
  };

  const updatePassenger = (index: number, patch: Partial<PassengerDetail>) => {
    setForm((f) => {
      const list = [...(f.passengers_details || [])];
      list[index] = { ...list[index], ...patch };
      return { ...f, passengers_details: list, passengers_count: list.length };
    });
  };

  const removePassenger = (index: number) => {
    setForm((f) => {
      const list = [...(f.passengers_details || [])];
      list.splice(index, 1);
      return { ...f, passengers_details: list, passengers_count: list.length };
    });
  };

  const FormCard = (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <h3>{editingId ? "Editar viagem" : "Nova viagem"}</h3>
      <form className="grid form-grid responsive" onSubmit={handleSubmit}>
          <input placeholder="Origem" required value={form.origin ?? ""} onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))} />
          <input placeholder="Destino" required value={form.destination ?? ""} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} />
          <select
            value={form.category ?? "PASSENGER"}
            onChange={(e) => {
              const next = e.target.value as Trip["category"];
              setForm((f) => ({
                ...f,
                category: next,
                passengers_count: next === "OBJECT" ? 0 : f.passengers_count ?? 0,
                passengers_details: next === "OBJECT" ? [] : f.passengers_details,
              }));
              if (next === "OBJECT") setUsePassengerList(false);
            }}
          >
            <option value="PASSENGER">Passageiro</option>
            <option value="OBJECT">Objeto</option>
            <option value="MIXED">Passageiro + Objeto</option>
          </select>
          <label>
            Saída
            <input type="datetime-local" required value={form.departure_datetime ?? ""} onChange={(e) => setForm((f) => ({ ...f, departure_datetime: e.target.value }))} />
          </label>
          <label>
            Retorno
            <input type="datetime-local" required value={form.return_datetime_expected ?? ""} onChange={(e) => setForm((f) => ({ ...f, return_datetime_expected: e.target.value }))} />
          </label>
          <label>
            Pontos de parada
            <textarea
              placeholder="Descreva pontos de parada previstos"
              value={form.stops_description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, stops_description: e.target.value }))}
              rows={3}
            />
          </label>
          <label>
            Odômetro inicial
            <input
              type="number"
              required
              value={form.odometer_start ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, odometer_start: Number(e.target.value) }))}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <input
              type="checkbox"
              checked={usePassengerList}
              disabled={form.category === "OBJECT"}
              onChange={(e) => {
                setUsePassengerList(e.target.checked);
                if (!e.target.checked) {
                  setForm((f) => ({ ...f, passengers_details: [], passengers_count: f.passengers_count ?? 0 }));
                }
              }}
            />
            Informar passageiros nominalmente
          </label>
          {!usePassengerList && form.category !== "OBJECT" && (
            <input
              placeholder="Quantidade de passageiros"
              type="number"
              value={form.passengers_count ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, passengers_count: Number(e.target.value) }))}
            />
          )}
          {usePassengerList && (
            <div className="card" style={{ background: "#0f1724", border: "1px solid var(--border)", borderRadius: 12 }}>
              {(form.passengers_details || []).map((p, idx) => (
                <div key={idx} className="grid" style={{ gap: "0.4rem", marginBottom: "0.8rem", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                  <input placeholder="Nome completo" required value={p.name} onChange={(e) => updatePassenger(idx, { name: e.target.value })} />
                  <input placeholder="CPF" required value={p.cpf} onChange={(e) => updatePassenger(idx, { cpf: formatCpf(e.target.value) })} inputMode="numeric" maxLength={14} />
                  <input placeholder="Idade (opcional)" type="number" value={p.age ?? ""} onChange={(e) => updatePassenger(idx, { age: e.target.value ? Number(e.target.value) : undefined })} />
                  <select value={p.special_need} onChange={(e) => updatePassenger(idx, { special_need: e.target.value as PassengerDetail["special_need"] })}>
                    {specialNeedOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {p.special_need === "OTHER" && (
                    <input
                      placeholder="Descreva o atendimento especial"
                      value={p.special_need_other ?? ""}
                      onChange={(e) => updatePassenger(idx, { special_need_other: e.target.value })}
                      style={{ gridColumn: "span 2" }}
                    />
                  )}
                  <textarea
                    placeholder="Observação do passageiro"
                    value={p.observation ?? ""}
                    onChange={(e) => updatePassenger(idx, { observation: e.target.value })}
                    rows={2}
                    style={{ gridColumn: "span 2" }}
                  />
                  <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "flex-end" }}>
                    <Button type="button" variant="ghost" onClick={() => removePassenger(idx)}>
                      Remover passageiro
                    </Button>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Total: {form.passengers_details?.length || 0}</span>
                <Button type="button" onClick={addPassenger}>
                  Adicionar passageiro
                </Button>
              </div>
            </div>
          )}
          {(form.category === "OBJECT" || form.category === "MIXED") && (
            <div className="card" style={{ background: "#0f1724", border: "1px solid var(--border)", borderRadius: 12 }}>
              <h4>Dados do objeto</h4>
              <input
                placeholder="O que é o pacote?"
                value={form.cargo_description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, cargo_description: e.target.value }))}
                required
              />
              <input
                placeholder="Tamanho / dimensões"
                value={form.cargo_size ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, cargo_size: e.target.value }))}
                required
              />
              <input
                type="number"
                placeholder="Quantidade de volumes"
                value={form.cargo_quantity ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, cargo_quantity: Number(e.target.value) }))}
                required
              />
              <input
                placeholder="Finalidade"
                value={form.cargo_purpose ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, cargo_purpose: e.target.value }))}
                required
              />
            </div>
          )}
          <select value={form.vehicle ?? ""} onChange={(e) => setForm((f) => ({ ...f, vehicle: Number(e.target.value) }))} required>
            <option value="">Veículo</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.license_plate} (cap: {v.max_passengers})
              </option>
            ))}
          </select>
          <select value={form.driver ?? ""} onChange={(e) => setForm((f) => ({ ...f, driver: Number(e.target.value) }))} required>
            <option value="">Motorista</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="PLANNED">Planejada</option>
            <option value="IN_PROGRESS">Em andamento</option>
            <option value="COMPLETED">Concluída</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
          <label>
            Observações
            <textarea
              placeholder="Observações adicionais"
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </label>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
            <Button type="submit">{editingId ? "Atualizar" : "Salvar"}</Button>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm({
                    category: "PASSENGER",
                    status: "PLANNED",
                    passengers_count: 0,
                    passengers_details: [],
                    stops_description: "",
                    notes: "",
                    cargo_description: "",
                    cargo_purpose: "",
                    cargo_size: "",
                    cargo_quantity: 0,
                  });
                  setUsePassengerList(false);
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
          <h1 className="data-title">Viagens</h1>
          <p className="data-subtitle">Planejamento, execução e finalização de deslocamentos.</p>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
        {!isMobile && FormCard}
        <div className="grid" style={{ gap: "1rem" }}>
          {error && <div className="data-error">{error}</div>}
          <div className="data-card data-toolbar">
            <div className="data-search">
              <input
                placeholder="Buscar por origem ou destino"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                  load(1, e.target.value, statusFilter);
                }}
              />
            </div>
            <div className="data-filters">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                  load(1, search, e.target.value);
                }}
              >
                <option value="">Todos status</option>
                <option value="PLANNED">Planejada</option>
                <option value="IN_PROGRESS">Em andamento</option>
                <option value="COMPLETED">Concluída</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
              <span className="data-inline-label">Itens por página</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const size = Number(e.target.value);
                  setPageSize(size);
                  setPage(1);
                  load(1, search, statusFilter, size);
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
            { key: "origin", label: "Origem" },
            { key: "destination", label: "Destino" },
            { key: "category", label: "Categoria", render: (row) => categoryLabels[row.category as Trip["category"]] || row.category },
            { key: "departure_datetime", label: "Saída" },
            { key: "return_datetime_expected", label: "Retorno" },
            { key: "passengers_count", label: "Passageiros" },
            { key: "odometer_start", label: "Odômetro início" },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
            {
              key: "whatsapp",
              label: "WhatsApp",
              render: (row) => (
                <Button variant="ghost" onClick={() => buildWhatsapp(row.id)}>
                  Gerar link
                </Button>
              ),
            },
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
          data={trips}
        />
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onChange={(p) => {
            setPage(p);
            load(p, search, statusFilter, pageSize);
          }}
        />
        {message && (
          <div className="card" style={{ marginTop: "1rem" }}>
            <strong>Link WhatsApp</strong>
            <p>
              <a href={message} target="_blank" rel="noreferrer">
                {message}
              </a>
            </p>
          </div>
        )}
      </div>
      <div className="card" style={{ marginTop: "1rem" }}>
        <h4>Concluir viagem</h4>
        <form className="grid form-grid responsive" onSubmit={handleComplete}>
          <select
            value={completion.tripId}
            onChange={(e) => setCompletion((c) => ({ ...c, tripId: Number(e.target.value) || "" }))}
            required
          >
            <option value="">Selecione a viagem</option>
            {trips
              .filter((t) => t.status !== "COMPLETED")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id} - {t.origin} → {t.destination}
                </option>
              ))}
          </select>
          <label>
            Odômetro final
            <input
              type="number"
              required
              value={completion.odometer_end}
              onChange={(e) => setCompletion((c) => ({ ...c, odometer_end: Number(e.target.value) }))}
            />
          </label>
          <label>
            Retorno real
            <input
              type="datetime-local"
              required
              value={completion.return_datetime_actual}
              onChange={(e) => setCompletion((c) => ({ ...c, return_datetime_actual: e.target.value }))}
            />
          </label>
          <Button type="submit">Concluir</Button>
        </form>
      </div>
      {isMobile && (
        <>
          <FloatingActionButton
            onClick={() => setIsModalOpen(true)}
            aria-label="Nova viagem"
            ariaControls="trip-modal"
            ariaExpanded={isModalOpen}
          />
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar viagem" : "Nova viagem"} id="trip-modal">
        {FormCard}
      </Modal>
    </>
  )}
    </div>
  </div>
  );
};
