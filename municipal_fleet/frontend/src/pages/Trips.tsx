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
import "./Trips.css";

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

// Wizard steps
const WIZARD_STEPS = [
  { id: 1, label: "Rota", icon: "📍" },
  { id: 2, label: "Horários", icon: "🕒" },
  { id: 3, label: "Passageiros", icon: "👥" },
  { id: 4, label: "Veículo", icon: "🚐" },
  { id: 5, label: "Confirmar", icon: "✓" },
];

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
  const statusLabels: Record<string, string> = {
    PLANNED: "Planejada",
    IN_PROGRESS: "Em andamento",
    COMPLETED: "Concluída",
    CANCELLED: "Cancelada",
  };

  // Wizard state
  const [wizardStep, setWizardStep] = useState(1);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Data state
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  // Form state
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
  const [usePassengerList, setUsePassengerList] = useState(false);

  // Complete trip state
  const [completion, setCompletion] = useState<{ tripId: number | ""; odometer_end: number | ""; return_datetime_actual: string }>({
    tripId: "",
    odometer_end: "",
    return_datetime_actual: "",
  });

  // Filters state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [driverFilter, setDriverFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const formatError = (payload: any) => {
    if (!payload) return "Erro ao salvar viagem.";
    if (typeof payload === "string") return payload;
    if (Array.isArray(payload)) return payload.join(", ");
    if (typeof payload === "object") return Object.values(payload).flat().join(" / ");
    return "Erro ao salvar viagem.";
  };

  const formatDateTime = (value: string) => {
    if (!value) return "—";
    const date = new Date(value);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const load = (nextPage = page, nextSearch = search, nextStatus = statusFilter, nextPageSize = pageSize) => {
    const params: any = { page: nextPage, page_size: nextPageSize };
    if (nextSearch) params.search = nextSearch;
    if (nextStatus) params.status = nextStatus;
    if (categoryFilter) params.category = categoryFilter;
    if (driverFilter) params.driver = driverFilter;
    if (dateFrom) params.departure_datetime__gte = dateFrom;
    if (dateTo) params.departure_datetime__lte = dateTo;

    api
      .get<Paginated<Trip>>("/trips/", { params })
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

  const resetForm = () => {
    setForm({
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
    setEditingId(null);
    setUsePassengerList(false);
    setWizardStep(1);
  };

  const openWizard = (trip?: Trip) => {
    if (trip) {
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
    } else {
      resetForm();
    }
    setWizardStep(1);
    setIsWizardOpen(true);
  };

  const closeWizard = () => {
    setIsWizardOpen(false);
    resetForm();
  };

  const handleSubmit = async () => {
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
        setError("Descreva o pacote (descrição, tamanho e finalidade) para viagens com objeto.");
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
      closeWizard();
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

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 1:
        return Boolean(form.origin?.trim() && form.destination?.trim());
      case 2:
        return Boolean(form.departure_datetime && form.return_datetime_expected && form.odometer_start);
      case 3:
        if (form.category === "OBJECT") return Boolean(form.cargo_description);
        return true;
      case 4:
        return Boolean(form.vehicle && form.driver);
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (wizardStep < 5 && canProceed(wizardStep)) {
      setWizardStep(wizardStep + 1);
      setError(null);
    }
  };

  const prevStep = () => {
    if (wizardStep > 1) {
      setWizardStep(wizardStep - 1);
      setError(null);
    }
  };

  // Wizard Step Content
  const renderWizardStep = () => {
    switch (wizardStep) {
      case 1:
        return (
          <div className="trips-wizard__form-section">
            <h4>Defina a rota da viagem</h4>
            <div className="trips-wizard__form-grid">
              <label>
                Origem *
                <input
                  placeholder="Local de partida"
                  required
                  value={form.origin ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
                />
              </label>
              <label>
                Destino *
                <input
                  placeholder="Local de chegada"
                  required
                  value={form.destination ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Pontos de parada (opcional)
                <textarea
                  placeholder="Descreva pontos de parada previstos"
                  value={form.stops_description ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, stops_description: e.target.value }))}
                  rows={3}
                />
              </label>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="trips-wizard__form-section">
            <h4>Data e horários</h4>
            <div className="trips-wizard__form-grid">
              <label>
                Data/hora de saída *
                <input
                  type="datetime-local"
                  required
                  value={form.departure_datetime ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, departure_datetime: e.target.value }))}
                />
              </label>
              <label>
                Retorno previsto *
                <input
                  type="datetime-local"
                  required
                  value={form.return_datetime_expected ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, return_datetime_expected: e.target.value }))}
                />
              </label>
              <label>
                Odômetro inicial *
                <input
                  type="number"
                  required
                  placeholder="Km"
                  value={form.odometer_start ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, odometer_start: Number(e.target.value) }))}
                />
              </label>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="trips-wizard__form-section">
            <h4>Tipo e passageiros/carga</h4>
            <div className="trips-wizard__form-grid">
              <label>
                Categoria *
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
              </label>

              {form.category !== "OBJECT" && (
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="checkbox"
                    checked={usePassengerList}
                    onChange={(e) => {
                      setUsePassengerList(e.target.checked);
                      if (!e.target.checked) {
                        setForm((f) => ({ ...f, passengers_details: [], passengers_count: f.passengers_count ?? 0 }));
                      }
                    }}
                  />
                  Informar passageiros nominalmente
                </label>
              )}

              {!usePassengerList && form.category !== "OBJECT" && (
                <label>
                  Quantidade de passageiros
                  <input
                    type="number"
                    value={form.passengers_count ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, passengers_count: Number(e.target.value) }))}
                  />
                </label>
              )}

              {usePassengerList && form.category !== "OBJECT" && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div className="trips-passengers">
                    {(form.passengers_details || []).map((p, idx) => (
                      <div key={idx} className="trips-passenger-card">
                        <div className="trips-passenger-card__header">
                          <span className="trips-passenger-card__number">Passageiro #{idx + 1}</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removePassenger(idx)}>
                            Remover
                          </Button>
                        </div>
                        <div className="trips-passenger-card__fields">
                          <input
                            placeholder="Nome completo *"
                            required
                            value={p.name}
                            onChange={(e) => updatePassenger(idx, { name: e.target.value })}
                          />
                          <input
                            placeholder="CPF *"
                            required
                            value={p.cpf}
                            onChange={(e) => updatePassenger(idx, { cpf: formatCpf(e.target.value) })}
                            inputMode="numeric"
                            maxLength={14}
                          />
                          <input
                            placeholder="Idade"
                            type="number"
                            value={p.age ?? ""}
                            onChange={(e) => updatePassenger(idx, { age: e.target.value ? Number(e.target.value) : undefined })}
                          />
                          <select
                            value={p.special_need}
                            onChange={(e) => updatePassenger(idx, { special_need: e.target.value as PassengerDetail["special_need"] })}
                          >
                            {specialNeedOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          {p.special_need === "OTHER" && (
                            <input
                              className="trips-passenger-card__field-full"
                              placeholder="Descreva o atendimento especial"
                              value={p.special_need_other ?? ""}
                              onChange={(e) => updatePassenger(idx, { special_need_other: e.target.value })}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem" }}>
                    <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Total: {form.passengers_details?.length || 0}</span>
                    <Button type="button" onClick={addPassenger}>+ Adicionar passageiro</Button>
                  </div>
                </div>
              )}

              {(form.category === "OBJECT" || form.category === "MIXED") && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <h4 style={{ margin: "0.5rem 0" }}>Dados do objeto/carga</h4>
                  <div className="trips-wizard__form-grid">
                    <input
                      placeholder="O que é o pacote? *"
                      value={form.cargo_description ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, cargo_description: e.target.value }))}
                      required
                    />
                    <input
                      placeholder="Tamanho/dimensões *"
                      value={form.cargo_size ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, cargo_size: e.target.value }))}
                      required
                    />
                    <input
                      type="number"
                      placeholder="Quantidade de volumes"
                      value={form.cargo_quantity ?? 0}
                      onChange={(e) => setForm((f) => ({ ...f, cargo_quantity: Number(e.target.value) }))}
                    />
                    <input
                      placeholder="Finalidade *"
                      value={form.cargo_purpose ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, cargo_purpose: e.target.value }))}
                      required
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="trips-wizard__form-section">
            <h4>Veículo e motorista</h4>
            <div className="trips-wizard__form-grid">
              <label>
                Veículo *
                <select
                  value={form.vehicle ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, vehicle: Number(e.target.value) }))}
                  required
                >
                  <option value="">Selecione o veículo</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.license_plate} (cap: {v.max_passengers})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Motorista *
                <select
                  value={form.driver ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, driver: Number(e.target.value) }))}
                  required
                >
                  <option value="">Selecione o motorista</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Observações
                <textarea
                  placeholder="Observações adicionais da viagem"
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                />
              </label>
            </div>
          </div>
        );

      case 5:
        const selectedVehicle = vehicles.find((v) => v.id === form.vehicle);
        const selectedDriver = drivers.find((d) => d.id === form.driver);
        return (
          <div className="trips-wizard__form-section">
            <h4>Confirme os dados da viagem</h4>
            <div className="trips-confirmation">
              <div className="trips-confirmation__section">
                <h5>Rota</h5>
                <div className="trips-confirmation__row">
                  <span className="trips-confirmation__label">Origem</span>
                  <span className="trips-confirmation__value">{form.origin}</span>
                </div>
                <div className="trips-confirmation__row">
                  <span className="trips-confirmation__label">Destino</span>
                  <span className="trips-confirmation__value">{form.destination}</span>
                </div>
                {form.stops_description && (
                  <div className="trips-confirmation__row">
                    <span className="trips-confirmation__label">Paradas</span>
                    <span className="trips-confirmation__value">{form.stops_description}</span>
                  </div>
                )}
              </div>
              <div className="trips-confirmation__section">
                <h5>Horários</h5>
                <div className="trips-confirmation__row">
                  <span className="trips-confirmation__label">Saída</span>
                  <span className="trips-confirmation__value">{formatDateTime(form.departure_datetime || "")}</span>
                </div>
                <div className="trips-confirmation__row">
                  <span className="trips-confirmation__label">Retorno</span>
                  <span className="trips-confirmation__value">{formatDateTime(form.return_datetime_expected || "")}</span>
                </div>
                <div className="trips-confirmation__row">
                  <span className="trips-confirmation__label">Odômetro inicial</span>
                  <span className="trips-confirmation__value">{form.odometer_start} km</span>
                </div>
              </div>
              <div className="trips-confirmation__section">
                <h5>Passageiros/Carga</h5>
                <div className="trips-confirmation__row">
                  <span className="trips-confirmation__label">Categoria</span>
                  <span className="trips-confirmation__value">{categoryLabels[form.category as Trip["category"]]}</span>
                </div>
                {form.category !== "OBJECT" && (
                  <div className="trips-confirmation__row">
                    <span className="trips-confirmation__label">Passageiros</span>
                    <span className="trips-confirmation__value">{usePassengerList ? form.passengers_details?.length : form.passengers_count}</span>
                  </div>
                )}
              </div>
              <div className="trips-confirmation__section">
                <h5>Recursos</h5>
                <div className="trips-confirmation__row">
                  <span className="trips-confirmation__label">Veículo</span>
                  <span className="trips-confirmation__value">{selectedVehicle?.license_plate || "—"}</span>
                </div>
                <div className="trips-confirmation__row">
                  <span className="trips-confirmation__label">Motorista</span>
                  <span className="trips-confirmation__value">{selectedDriver?.name || "—"}</span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Trip Cards for Mobile
  const renderTripCards = () => (
    <div className="trips-cards">
      {trips.map((trip) => (
        <div key={trip.id} className="trips-card">
          <div className="trips-card__header">
            <div className="trips-card__route">
              {trip.origin}
              <span className="trips-card__route-arrow">→</span>
              {trip.destination}
            </div>
            <div className="trips-card__badge">
              <StatusBadge status={trip.status} />
            </div>
          </div>
          <div className="trips-card__meta">
            <div className="trips-card__meta-item">
              <span className="trips-card__meta-label">Categoria</span>
              <span className="trips-card__meta-value">{categoryLabels[trip.category]}</span>
            </div>
            <div className="trips-card__meta-item">
              <span className="trips-card__meta-label">Saída</span>
              <span className="trips-card__meta-value">{formatDateTime(trip.departure_datetime)}</span>
            </div>
            <div className="trips-card__meta-item">
              <span className="trips-card__meta-label">Passageiros</span>
              <span className="trips-card__meta-value">{trip.passengers_count}</span>
            </div>
            <div className="trips-card__meta-item">
              <span className="trips-card__meta-label">Motorista</span>
              <span className="trips-card__meta-value">{drivers.find((d) => d.id === trip.driver)?.name || "—"}</span>
            </div>
          </div>
          <div className="trips-card__actions">
            <Button variant="ghost" size="sm" onClick={() => openWizard(trip)}>Editar</Button>
            <Button variant="ghost" size="sm" onClick={() => buildWhatsapp(trip.id)}>WhatsApp</Button>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(trip.id)}>Excluir</Button>
          </div>
        </div>
      ))}
      {trips.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", padding: "2rem" }}>Nenhuma viagem encontrada.</div>}
    </div>
  );

  return (
    <div className="data-page">
      <div className="data-header">
        <div>
          <h1 className="data-title">Viagens</h1>
          <p className="data-subtitle">Planejamento, execução e finalização de deslocamentos.</p>
        </div>
        {!isMobile && (
          <Button onClick={() => openWizard()}>+ Nova viagem</Button>
        )}
      </div>

      {error && <div className="data-error">{error}</div>}

      {/* Filters */}
      <div className="trips-filters">
        <div className="trips-filters__search">
          <input
            placeholder="Buscar origem ou destino..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
              load(1, e.target.value, statusFilter);
            }}
          />
        </div>
        <div className="trips-filters__group">
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
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
              load();
            }}
          >
            <option value="">Todas categorias</option>
            <option value="PASSENGER">Passageiro</option>
            <option value="OBJECT">Objeto</option>
            <option value="MIXED">Misto</option>
          </select>
          <select
            value={driverFilter}
            onChange={(e) => {
              setDriverFilter(e.target.value);
              setPage(1);
              load();
            }}
          >
            <option value="">Todos motoristas</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="trips-filters__date-range">
          <span className="trips-filters__label">De:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
              load();
            }}
          />
          <span className="trips-filters__date-separator">até</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
              load();
            }}
          />
        </div>
      </div>

      {/* Table (Desktop) / Cards (Mobile) */}
      <div className="trips-table-desktop">
        <div className="trips-table-wrapper">
          <Table
            columns={[
              { key: "origin", label: "Origem" },
              { key: "destination", label: "Destino" },
              { key: "category", label: "Categoria", render: (row) => categoryLabels[row.category as Trip["category"]] },
              { key: "departure_datetime", label: "Saída", render: (row) => formatDateTime(row.departure_datetime) },
              { key: "passengers_count", label: "Pass." },
              { key: "driver", label: "Motorista", render: (row) => drivers.find((d) => d.id === row.driver)?.name || "—" },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
              {
                key: "actions",
                label: "Ações",
                render: (row) => (
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                    <Button variant="ghost" size="sm" onClick={() => openWizard(row)}>Editar</Button>
                    <Button variant="ghost" size="sm" onClick={() => buildWhatsapp(row.id)}>WA</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id)}>Excluir</Button>
                  </div>
                ),
              },
            ]}
            data={trips}
          />
        </div>
      </div>

      <div className="trips-cards-mobile">
        {renderTripCards()}
      </div>

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
          <p><a href={message} target="_blank" rel="noreferrer">{message}</a></p>
        </div>
      )}

      {/* Complete Trip Card */}
      <div className="trips-complete-card">
        <h4>Concluir viagem</h4>
        <form className="trips-complete-card__form" onSubmit={handleComplete}>
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

      {/* Wizard Modal */}
      <Modal
        open={isWizardOpen}
        onClose={closeWizard}
        title={editingId ? "Editar viagem" : "Nova viagem"}
        id="trip-wizard-modal"
      >
        <div className="trips-wizard">
          <ul className="trips-wizard__steps">
            {WIZARD_STEPS.map((step) => (
              <li
                key={step.id}
                className={`trips-wizard__step ${wizardStep === step.id ? "trips-wizard__step--active" : ""} ${wizardStep > step.id ? "trips-wizard__step--completed" : ""}`}
                onClick={() => {
                  if (step.id <= wizardStep || canProceed(step.id - 1)) {
                    setWizardStep(step.id);
                  }
                }}
              >
                <span className="trips-wizard__step-number">
                  {wizardStep > step.id ? "✓" : step.id}
                </span>
                <span>{step.label}</span>
              </li>
            ))}
          </ul>
          <div className="trips-wizard__content">
            {error && <div className="data-error" style={{ marginBottom: "1rem" }}>{error}</div>}
            {renderWizardStep()}
          </div>
          <div className="trips-wizard__actions">
            <Button variant="ghost" onClick={prevStep} disabled={wizardStep === 1}>
              ← Anterior
            </Button>
            {wizardStep < 5 ? (
              <Button onClick={nextStep} disabled={!canProceed(wizardStep)}>
                Próximo →
              </Button>
            ) : (
              <Button onClick={handleSubmit}>
                {editingId ? "Salvar alterações" : "Cadastrar viagem"}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* FAB for Mobile */}
      {isMobile && (
        <FloatingActionButton
          onClick={() => openWizard()}
          aria-label="Nova viagem"
          ariaControls="trip-wizard-modal"
          ariaExpanded={isWizardOpen}
        />
      )}
    </div>
  );
};
