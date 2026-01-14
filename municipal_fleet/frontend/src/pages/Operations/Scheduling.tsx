import { useEffect, useMemo, useState } from "react";
import { api, API_ROOT, type Paginated } from "../../lib/api";
import { Button } from "../../components/Button";
import { Table } from "../../components/Table";
import { Pagination } from "../../components/Pagination";
import { useAuth } from "../../hooks/useAuth";
import "../../styles/DataPage.css";
import "./Scheduling.css";

type BlockType =
  | "VACATION"
  | "SICK_LEAVE"
  | "DAY_OFF"
  | "TRAINING"
  | "ADMIN_BLOCK"
  | "OTHER";

type BlockStatus = "ACTIVE" | "CANCELLED";

type AvailabilityBlock = {
  id: number;
  driver: number;
  driver_name: string;
  type: BlockType;
  start_datetime: string;
  end_datetime: string;
  status: BlockStatus;
  reason?: string;
  all_day: boolean;
  attachment?: string | null;
  created_by_email?: string | null;
};

type Driver = { id: number; name: string; municipality?: number | null };

type AvailableDriver = { id: number; name: string; municipality: number; status: string };

type CalendarEvent = {
  id: number;
  type: "TRIP" | "BLOCK";
  title: string;
  start: string;
  end: string;
  status?: string;
  block_type?: BlockType;
};

type DriverAllocation = { driver_id: number; driver_name: string; hours: number; trips: number };

type AvailabilityReport = {
  range: { start: string; end: string };
  blocked_drivers: Array<{
    id: number;
    driver_id: number;
    driver__name: string;
    type: BlockType;
    start_datetime: string;
    end_datetime: string;
  }>;
  allocation_hours: DriverAllocation[];
  top_load: DriverAllocation[];
  pending_trips_without_driver: number;
};

type BlockFormState = {
  driver: string;
  type: BlockType;
  start_datetime: string;
  end_datetime: string;
  status: BlockStatus;
  reason: string;
  all_day: boolean;
  attachment: File | null;
};

const blockTypeLabels: Record<BlockType, string> = {
  VACATION: "Férias",
  SICK_LEAVE: "Afastamento/Atestado",
  DAY_OFF: "Folga",
  TRAINING: "Treinamento",
  ADMIN_BLOCK: "Bloqueio administrativo",
  OTHER: "Outro",
};

const statusLabels: Record<BlockStatus, string> = {
  ACTIVE: "Ativo",
  CANCELLED: "Cancelado",
};

const toInputDate = (value: Date) => value.toISOString().slice(0, 10);

const toInputDateTime = (value: Date | string) => {
  const date = typeof value === "string" ? new Date(value) : value;
  const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString();
  return iso.slice(0, 16);
};

const formatDate = (value: string) => new Date(value).toLocaleDateString("pt-BR");
const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const defaultBlockRange = () => {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start: toInputDateTime(start), end: toInputDateTime(end) };
};

const defaultReportRange = () => {
  const start = new Date();
  start.setDate(1);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(end.getDate() - 1);
  return { start: toInputDate(start), end: toInputDate(end) };
};

export const SchedulingPage = () => {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [blockPage, setBlockPage] = useState(1);
  const [blockTotal, setBlockTotal] = useState(0);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockFilters, setBlockFilters] = useState({
    driver_id: "",
    type: "",
    status: "ACTIVE",
    start_date: toInputDate(new Date()),
    end_date: toInputDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
  });
  const [blockForm, setBlockForm] = useState<BlockFormState>(() => {
    const { start, end } = defaultBlockRange();
    return {
      driver: "",
      type: "VACATION",
      start_datetime: start,
      end_datetime: end,
      status: "ACTIVE",
      reason: "",
      all_day: false,
      attachment: null,
    };
  });
  const [editingBlock, setEditingBlock] = useState<number | null>(null);

  const [availabilityQuery, setAvailabilityQuery] = useState({
    start: defaultBlockRange().start,
    end: defaultBlockRange().end,
    municipality: "",
  });
  const [availableDrivers, setAvailableDrivers] = useState<AvailableDriver[]>([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const [calendarDriver, setCalendarDriver] = useState("");
  const [calendarRange, setCalendarRange] = useState({
    start_date: toInputDate(new Date()),
    end_date: toInputDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
  });
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const [reportRange, setReportRange] = useState(defaultReportRange());
  const [reportData, setReportData] = useState<AvailabilityReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const blockPageSize = 8;

  const loadDrivers = async () => {
    try {
      const { data } = await api.get<Paginated<Driver>>("/drivers/", { params: { page_size: 200 } });
      const list = Array.isArray(data) ? data : data.results || [];
      setDrivers(list);
    } catch (err: any) {
      setBlockError(err.response?.data?.detail || "Não foi possível carregar motoristas.");
    }
  };

  const loadBlocks = async (page = blockPage) => {
    setBlockLoading(true);
    const params = {
      page,
      page_size: blockPageSize,
      ...(blockFilters.driver_id ? { driver_id: blockFilters.driver_id } : {}),
      ...(blockFilters.type ? { type: blockFilters.type } : {}),
      ...(blockFilters.status ? { status: blockFilters.status } : {}),
      ...(blockFilters.start_date ? { start_date: blockFilters.start_date } : {}),
      ...(blockFilters.end_date ? { end_date: blockFilters.end_date } : {}),
    };
    try {
      const { data } = await api.get<Paginated<AvailabilityBlock>>("/driver-availability-blocks/", { params });
      if (Array.isArray(data)) {
        setBlocks(data);
        setBlockTotal(data.length);
      } else {
        setBlocks(data.results || []);
        setBlockTotal(data.count || 0);
      }
      setBlockPage(page);
      setBlockError(null);
    } catch (err: any) {
      setBlockError(err.response?.data?.detail || "Erro ao carregar bloqueios.");
    } finally {
      setBlockLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
  }, []);

  useEffect(() => {
    loadBlocks(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockFilters.driver_id, blockFilters.type, blockFilters.status, blockFilters.start_date, blockFilters.end_date]);

  const resetForm = () => {
    const { start, end } = defaultBlockRange();
    setBlockForm({
      driver: "",
      type: "VACATION",
      start_datetime: start,
      end_datetime: end,
      status: "ACTIVE",
      reason: "",
      all_day: false,
      attachment: null,
    });
    setEditingBlock(null);
  };

  const saveBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockForm.driver || !blockForm.start_datetime || !blockForm.end_datetime) {
      setBlockError("Informe motorista e datas para salvar o bloqueio.");
      return;
    }
    const formData = new FormData();
    formData.append("driver", blockForm.driver);
    formData.append("type", blockForm.type);
    formData.append("start_datetime", blockForm.start_datetime);
    formData.append("end_datetime", blockForm.end_datetime);
    formData.append("status", blockForm.status);
    formData.append("all_day", String(blockForm.all_day));
    if (blockForm.reason.trim()) formData.append("reason", blockForm.reason.trim());
    if (blockForm.attachment) formData.append("attachment", blockForm.attachment);
    try {
      if (editingBlock) {
        await api.patch(`/driver-availability-blocks/${editingBlock}/`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("/driver-availability-blocks/", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      resetForm();
      await loadBlocks(editingBlock ? blockPage : 1);
    } catch (err: any) {
      const data = err?.response?.data;
      const detail =
        data?.detail ||
        (data && typeof data === "object"
          ? Object.values(data as Record<string, any>)
            .flat()
            .filter(Boolean)
            .join(" | ")
          : null);
      setBlockError(detail || "Não foi possível salvar o bloqueio.");
    }
  };

  const handleEdit = (block: AvailabilityBlock) => {
    setEditingBlock(block.id);
    setBlockForm({
      driver: String(block.driver),
      type: block.type,
      start_datetime: toInputDateTime(block.start_datetime),
      end_datetime: toInputDateTime(block.end_datetime),
      status: block.status,
      reason: block.reason || "",
      all_day: block.all_day,
      attachment: null,
    });
  };

  const handleCancel = async (block: AvailabilityBlock) => {
    if (!confirm("Cancelar este bloqueio?")) return;
    try {
      await api.delete(`/driver-availability-blocks/${block.id}/`);
      await loadBlocks();
    } catch (err: any) {
      setBlockError(err.response?.data?.detail || "Erro ao cancelar bloqueio.");
    }
  };

  const fetchAvailableDrivers = async () => {
    if (!availabilityQuery.start || !availabilityQuery.end) {
      setAvailabilityError("Preencha início e fim para consultar disponibilidade.");
      return;
    }
    setAvailabilityLoading(true);
    try {
      const params: Record<string, any> = { start: availabilityQuery.start, end: availabilityQuery.end };
      if (user?.role === "SUPERADMIN" && availabilityQuery.municipality) {
        params.municipality = availabilityQuery.municipality;
      }
      const { data } = await api.get<{ available_drivers: AvailableDriver[]; count: number }>(
        "/drivers/available/",
        { params }
      );
      setAvailableDrivers(data.available_drivers || []);
      setAvailableCount(data.count || data.available_drivers?.length || 0);
      setAvailabilityError(null);
    } catch (err: any) {
      setAvailableDrivers([]);
      setAvailabilityError(err.response?.data?.detail || "Erro ao consultar motoristas disponíveis.");
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const fetchCalendar = async () => {
    if (!calendarDriver) {
      setCalendarError("Selecione um motorista para visualizar o calendário.");
      return;
    }
    setCalendarLoading(true);
    try {
      const { data } = await api.get<{ events: CalendarEvent[] }>(`/drivers/${calendarDriver}/calendar/`, {
        params: calendarRange,
      });
      setCalendarEvents(data.events || []);
      setCalendarError(null);
    } catch (err: any) {
      setCalendarEvents([]);
      setCalendarError(err.response?.data?.detail || "Erro ao carregar calendário.");
    } finally {
      setCalendarLoading(false);
    }
  };

  const loadReport = async () => {
    setReportLoading(true);
    try {
      const { data } = await api.get<AvailabilityReport>("/reports/driver-availability/", {
        params: { start_date: reportRange.start, end_date: reportRange.end },
      });
      setReportData(data);
      setReportError(null);
    } catch (err: any) {
      setReportError(err.response?.data?.detail || "Erro ao carregar relatório de disponibilidade.");
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calendarSummary = useMemo(() => {
    const trips = calendarEvents.filter((e) => e.type === "TRIP").length;
    const blocksCount = calendarEvents.filter((e) => e.type === "BLOCK").length;
    return { trips, blocks: blocksCount };
  }, [calendarEvents]);

  return (
    <div className="data-page scheduling-page">
      <div className="data-header">
        <div>
          <p className="eyebrow">Agenda e disponibilidade</p>
          <h2 className="data-title">Escala de motoristas</h2>
          <p className="data-subtitle">
            Cadastre bloqueios, veja quem está livre e acompanhe a agenda de cada motorista.
          </p>
        </div>
        <div className="header-actions">
          <Button type="button" onClick={resetForm}>
            Novo bloqueio
          </Button>
          <Button type="button" variant="ghost" onClick={loadReport}>
            Atualizar relatório
          </Button>
        </div>
      </div>

      {blockError && <div className="data-error">{blockError}</div>}

      <div className="grid block-grid">
        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Bloqueios</p>
              <h3>Disponibilidade de motoristas</h3>
            </div>
            <Button type="button" onClick={saveBlock}>
              {editingBlock ? "Salvar edição" : "Salvar bloqueio"}
            </Button>
          </div>
          <form className="grid form-grid responsive" onSubmit={saveBlock}>
            <label>
              Motorista
              <select
                value={blockForm.driver}
                onChange={(e) => setBlockForm((f) => ({ ...f, driver: e.target.value }))}
                required
              >
                <option value="">Selecione</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Motivo
              <select
                value={blockForm.type}
                onChange={(e) => setBlockForm((f) => ({ ...f, type: e.target.value as BlockType }))}
              >
                {Object.entries(blockTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Início
              <input
                type="datetime-local"
                value={blockForm.start_datetime}
                onChange={(e) => setBlockForm((f) => ({ ...f, start_datetime: e.target.value }))}
                required
              />
            </label>
            <label>
              Fim
              <input
                type="datetime-local"
                value={blockForm.end_datetime}
                onChange={(e) => setBlockForm((f) => ({ ...f, end_datetime: e.target.value }))}
                required
              />
            </label>
            <label className="inline-row">
              <input
                type="checkbox"
                checked={blockForm.all_day}
                onChange={(e) =>
                  setBlockForm((f) => {
                    if (e.target.checked && f.start_datetime) {
                      const date = f.start_datetime.slice(0, 10);
                      return {
                        ...f,
                        all_day: true,
                        start_datetime: `${date}T00:00`,
                        end_datetime: `${date}T23:59`,
                      };
                    }
                    return { ...f, all_day: e.target.checked };
                  })
                }
              />
              Dia inteiro
            </label>
            <label>
              Status
              <select
                value={blockForm.status}
                onChange={(e) => setBlockForm((f) => ({ ...f, status: e.target.value as BlockStatus }))}
              >
                <option value="ACTIVE">Ativo</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </label>
            <label className="full-width">
              Observação
              <textarea
                placeholder="Detalhes do bloqueio, contato ou protocolo"
                value={blockForm.reason}
                onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </label>
            <label>
              Anexo
              <input
                type="file"
                onChange={(e) =>
                  setBlockForm((f) => ({ ...f, attachment: e.target.files?.[0] ? e.target.files[0] : null }))
                }
              />
              {editingBlock && <span className="muted">Ao salvar, mantém o anexo atual se nenhum arquivo for enviado.</span>}
            </label>
            <div className="inline-row">
              <Button type="submit" disabled={blockLoading}>
                {editingBlock ? "Salvar edição" : "Criar bloqueio"}
              </Button>
              <Button type="button" variant="ghost" onClick={resetForm}>
                Limpar
              </Button>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Filtros</p>
              <h3>Buscar bloqueios</h3>
            </div>
            <Button type="button" variant="ghost" onClick={() => loadBlocks(1)}>
              Atualizar
            </Button>
          </div>
          <div className="grid form-grid responsive" style={{ marginBottom: "0.5rem" }}>
            <label>
              Motorista
              <select
                value={blockFilters.driver_id}
                onChange={(e) => setBlockFilters((f) => ({ ...f, driver_id: e.target.value }))}
              >
                <option value="">Todos</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select value={blockFilters.type} onChange={(e) => setBlockFilters((f) => ({ ...f, type: e.target.value }))}>
                <option value="">Todos</option>
                {Object.entries(blockTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={blockFilters.status}
                onChange={(e) => setBlockFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="">Todos</option>
                <option value="ACTIVE">Ativos</option>
                <option value="CANCELLED">Cancelados</option>
              </select>
            </label>
            <label>
              Início (data)
              <input
                type="date"
                value={blockFilters.start_date}
                onChange={(e) => setBlockFilters((f) => ({ ...f, start_date: e.target.value }))}
              />
            </label>
            <label>
              Fim (data)
              <input
                type="date"
                value={blockFilters.end_date}
                onChange={(e) => setBlockFilters((f) => ({ ...f, end_date: e.target.value }))}
              />
            </label>
          </div>
          <div className="table card" style={{ margin: 0 }}>
            {blockLoading ? (
              <p>Carregando bloqueios...</p>
            ) : (
              <Table
                columns={[
                  { key: "driver", label: "Motorista", render: (row) => row.driver_name },
                  {
                    key: "type",
                    label: "Tipo",
                    render: (row) => <span className="pill">{blockTypeLabels[row.type as BlockType]}</span>,
                  },
                  {
                    key: "period",
                    label: "Período",
                    render: (row) => (
                      <div className="stack">
                        <strong>{formatDateTime(row.start_datetime)}</strong>
                        <span className="muted">até {formatDateTime(row.end_datetime)}</span>
                      </div>
                    ),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => <span className={`status-chip ${row.status.toLowerCase()}`}>{statusLabels[row.status as BlockStatus]}</span>,
                  },
                  {
                    key: "actions",
                    label: "Ações",
                    render: (row) => (
                      <div className="inline-row">
                        <button className="link" onClick={() => handleEdit(row)}>
                          Editar
                        </button>
                        {row.status === "ACTIVE" && (
                          <button className="link danger" onClick={() => handleCancel(row)}>
                            Cancelar
                          </button>
                        )}
                        {row.attachment && (
                          <a className="link" href={`${API_ROOT}${row.attachment}`} target="_blank" rel="noreferrer">
                            Anexo
                          </a>
                        )}
                      </div>
                    ),
                  },
                ]}
                data={blocks}
              />
            )}
          </div>
          <Pagination page={blockPage} pageSize={blockPageSize} total={blockTotal} onChange={(p) => loadBlocks(p)} />
        </div>
      </div>

      <div className="grid availability-grid">
        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Quem está livre?</p>
              <h3>Consultar disponibilidade</h3>
            </div>
            <Button type="button" onClick={fetchAvailableDrivers} disabled={availabilityLoading}>
              Consultar
            </Button>
          </div>
          <div className="grid form-grid responsive">
            <label>
              Início
              <input
                type="datetime-local"
                value={availabilityQuery.start}
                onChange={(e) => setAvailabilityQuery((f) => ({ ...f, start: e.target.value }))}
              />
            </label>
            <label>
              Fim
              <input
                type="datetime-local"
                value={availabilityQuery.end}
                onChange={(e) => setAvailabilityQuery((f) => ({ ...f, end: e.target.value }))}
              />
            </label>
            {user?.role === "SUPERADMIN" && (
              <label>
                Prefeitura (opcional)
                <input
                  placeholder="ID da prefeitura"
                  value={availabilityQuery.municipality}
                  onChange={(e) => setAvailabilityQuery((f) => ({ ...f, municipality: e.target.value }))}
                />
              </label>
            )}
          </div>
          {availabilityError && <div className="data-error">{availabilityError}</div>}
          <div className="availability-results">
            <div className="pill active">
              Livres no período <span className="pill-count">{availableCount}</span>
            </div>
            <div className="chips">
              {availableDrivers.map((d) => (
                <span key={d.id} className="pill ghost">
                  {d.name}
                </span>
              ))}
              {!availableDrivers.length && <p className="muted">Nenhum motorista livre para o período selecionado.</p>}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Agenda</p>
              <h3>Calendário do motorista</h3>
            </div>
            <Button type="button" onClick={fetchCalendar} disabled={calendarLoading}>
              Ver agenda
            </Button>
          </div>
          <div className="grid form-grid responsive">
            <label>
              Motorista
              <select value={calendarDriver} onChange={(e) => setCalendarDriver(e.target.value)}>
                <option value="">Selecione</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Início
              <input
                type="date"
                value={calendarRange.start_date}
                onChange={(e) => setCalendarRange((f) => ({ ...f, start_date: e.target.value }))}
              />
            </label>
            <label>
              Fim
              <input
                type="date"
                value={calendarRange.end_date}
                onChange={(e) => setCalendarRange((f) => ({ ...f, end_date: e.target.value }))}
              />
            </label>
          </div>
          {calendarError && <div className="data-error">{calendarError}</div>}
          <div className="calendar-summary">
            <div className="pill">
              Viagens <span className="pill-count">{calendarSummary.trips}</span>
            </div>
            <div className="pill">
              Bloqueios <span className="pill-count">{calendarSummary.blocks}</span>
            </div>
          </div>
          <div className="timeline">
            {calendarLoading ? (
              <p>Carregando agenda...</p>
            ) : calendarEvents.length ? (
              calendarEvents.map((event) => (
                <div key={`${event.type}-${event.id}`} className="timeline-row">
                  <div className={`dot ${event.type === "TRIP" ? "trip" : "block"}`} />
                  <div className="stack">
                    <strong>{event.title}</strong>
                    <span className="muted">
                      {formatDateTime(event.start)} — {formatDateTime(event.end)}
                    </span>
                  </div>
                  <div className="pill ghost">
                    {event.type === "TRIP" ? event.status : blockTypeLabels[event.block_type || "OTHER"]}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">Nenhum evento no período selecionado.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">Relatório</p>
            <h3>Disponibilidade e carga de trabalho</h3>
          </div>
          <div className="inline-row">
            <label>
              Início
              <input
                type="date"
                value={reportRange.start}
                onChange={(e) => setReportRange((f) => ({ ...f, start: e.target.value }))}
              />
            </label>
            <label>
              Fim
              <input
                type="date"
                value={reportRange.end}
                onChange={(e) => setReportRange((f) => ({ ...f, end: e.target.value }))}
              />
            </label>
            <Button type="button" onClick={loadReport} disabled={reportLoading}>
              Atualizar
            </Button>
          </div>
        </div>
        {reportError && <div className="data-error">{reportError}</div>}
        {reportData ? (
          <>
            <div className="insights-grid">
              <div className="insight-card">
                <span className="muted">Período</span>
                <strong>
                  {formatDate(reportData.range.start)} - {formatDate(reportData.range.end)}
                </strong>
              </div>
              <div className="insight-card">
                <span className="muted">Bloqueios ativos</span>
                <strong>{reportData.blocked_drivers.length}</strong>
              </div>
              <div className="insight-card">
                <span className="muted">Viagens sem motorista</span>
                <strong>{reportData.pending_trips_without_driver}</strong>
              </div>
            </div>
            <div className="report-columns">
              <div className="card mini">
                <h4>Maior carga de horas</h4>
                <ul className="list">
                  {reportData.top_load.length ? (
                    reportData.top_load.map((item) => (
                      <li key={item.driver_id} className="stack">
                        <strong>{item.driver_name}</strong>
                        <span className="muted">
                          {item.hours.toFixed(2)} h · {item.trips} viagens
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="muted">Sem dados para o período.</li>
                  )}
                </ul>
              </div>
              <div className="card mini">
                <h4>Bloqueios no período</h4>
                <ul className="list">
                  {reportData.blocked_drivers.length ? (
                    reportData.blocked_drivers.map((item) => (
                      <li key={item.id} className="stack">
                        <strong>{item.driver__name}</strong>
                        <span className="muted">
                          {blockTypeLabels[item.type]} · {formatDateTime(item.start_datetime)} -{" "}
                          {formatDateTime(item.end_datetime)}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="muted">Nenhum bloqueio registrado.</li>
                  )}
                </ul>
              </div>
            </div>
          </>
        ) : (
          <p className="muted">Carregando relatório...</p>
        )}
      </div>
    </div>
  );
};
