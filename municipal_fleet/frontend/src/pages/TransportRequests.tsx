import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { api, API_ROOT } from "../lib/api";
import { Button } from "../components/Button";
import { Table } from "../components/Table";
import "../styles/DataPage.css";
import "./TransportRequests.css";

type Template = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  municipality?: number;
};

type Submission = {
  id: number;
  protocol_number: string;
  status: string;
  status_notes?: string;
  created_at: string;
  linked_trip?: number | null;
  answers?: {
    id: number;
    field_name: string;
    question_label: string;
    value_text?: string;
    value_json?: any;
    modified_by_staff?: boolean;
    staff_value_text?: string;
    staff_value_json?: any;
  }[];
};

const parseError = (err: any) => {
  if (!err || !err.response) return err?.message || "Erro desconhecido";
  const data = err.response.data;
  if (!data) return err.message || "Erro desconhecido";
  if (data.detail) return data.detail;
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    try {
      const vals = Object.values(data)
        .flat()
        .map((v: any) => (typeof v === "string" ? v : JSON.stringify(v)));
      return vals.join(" ");
    } catch (e) {
      return JSON.stringify(data);
    }
  }
  return err.message || "Erro desconhecido";
};

export const TransportRequestsPage = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: "", description: "", is_active: true });
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [reviewStatus, setReviewStatus] = useState("APPROVED");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewUpdates, setReviewUpdates] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [driverOptions, setDriverOptions] = useState<{ id: number; name: string }[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<{ id: number; label: string }[]>([]);

  const publicBase = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return origin || API_ROOT?.replace(/\/api\/?$/, "") || "";
  }, []);

  const publicLink = useMemo(() => {
    if (!selectedTemplate) return "";
    return `${publicBase}/forms/${selectedTemplate.slug}`;
  }, [selectedTemplate, publicBase]);

  const loadTemplates = async () => {
    try {
      const { data } = await api.get<Template[]>("/forms/templates/", { params: { form_type: "TRANSPORT_REQUEST" } });
      const list = Array.isArray(data) ? data : (data as any).results ?? [];
      setTemplates(list);
      setSelectedTemplate(list[0] ?? null);
      setError(null);
    } catch (err: any) {
      setError(parseError(err) || "Erro ao carregar formulários de transporte.");
    }
  };

  const loadSubmissions = async (templateId?: number) => {
    const tid = templateId ?? selectedTemplate?.id;
    if (!tid) {
      setSubmissions([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get<Submission[]>("/forms/submissions/", { params: { form_template: tid } });
      const list = Array.isArray(data) ? data : (data as any).results ?? [];
      setSubmissions(list);
      setError(null);
    } catch (err: any) {
      setError(parseError(err) || "Erro ao carregar solicitações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    api.get<{ results: { id: number; name: string }[] }>("/drivers/", { params: { page_size: 200 } }).then((res) => {
      const arr = Array.isArray(res.data) ? res.data : (res.data as any).results ?? [];
      setDriverOptions(arr);
    });
    api.get<{ results: { id: number; license_plate: string; model: string }[] }>("/vehicles/", { params: { page_size: 200 } }).then((res) => {
      const arr = Array.isArray(res.data) ? res.data : (res.data as any).results ?? [];
      setVehicleOptions(arr.map((v: any) => ({ id: v.id, label: `${v.license_plate} — ${v.model}` })));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadSubmissions();
  }, [selectedTemplate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Auto-preenche motorista/veículo na revisão se estiverem vazios e houver opções.
    setReviewUpdates((prev) => {
      const next = { ...prev };
      if (!next.driver_id && driverOptions.length) {
        next.driver_id = String(driverOptions[0].id);
      }
      if (!next.vehicle_id && vehicleOptions.length) {
        next.vehicle_id = String(vehicleOptions[0].id);
      }
      return next;
    });
  }, [driverOptions, vehicleOptions]);

  const createTemplate = async () => {
    try {
      const payload: any = {
        ...newTemplate,
        form_type: "TRANSPORT_REQUEST",
        require_cpf: true,
      };
      if (user?.role !== "SUPERADMIN") {
        payload.municipality = user?.municipality;
      }
      const { data } = await api.post<Template>("/forms/templates/", payload);
      setNewTemplate({ name: "", description: "", is_active: true });
      await loadTemplates();
      setSelectedTemplate(data);
    } catch (err: any) {
      setError(parseError(err) || "Erro ao criar formulário de transporte.");
    }
  };

  const selectSubmission = async (submission: Submission) => {
    try {
      const { data } = await api.get<Submission>(`/forms/submissions/${submission.id}/`);
      setSelectedSubmission(data);
      setReviewStatus(data.status);
      setReviewNotes(data.status_notes ?? "");
      const baseUpdates: Record<string, string> = {};
      data.answers?.forEach((ans) => {
        const value = ans.staff_value_text || ans.value_text || "";
        baseUpdates[ans.field_name] = value;
      });
      setReviewUpdates(baseUpdates);
    } catch (err: any) {
      setError(parseError(err) || "Erro ao carregar detalhes.");
    }
  };

  const deleteTemplate = async (templateId: number) => {
    if (!confirm("Remover este formulário público?")) return;
    try {
      await api.delete(`/forms/templates/${templateId}/`);
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
      }
      await loadTemplates();
    } catch (err: any) {
      setError(parseError(err) || "Não foi possível remover o formulário.");
    }
  };

  const reviewSubmission = async () => {
    if (!selectedSubmission) return;
    try {
      await api.patch(`/forms/submissions/${selectedSubmission.id}/review/`, {
        status: reviewStatus,
        status_notes: reviewNotes,
        updates: reviewUpdates,
      });
      setReviewNotes("");
      await loadSubmissions();
      setSelectedSubmission(null);
    } catch (err: any) {
      setError(parseError(err) || "Não foi possível aplicar a decisão.");
    }
  };

  return (
    <div className="data-page">
      <div className="data-header">
        <div>
          <p className="eyebrow">Solicitações externas</p>
          <h2 className="data-title">Formulário de Transporte</h2>
          <p className="data-subtitle">Gerencie formulários públicos e processe solicitações de cidadãos.</p>
        </div>
        <div className="inline-row">
          <Button variant="ghost" onClick={loadTemplates}>
            Recarregar
          </Button>
          {selectedTemplate && (
            <a className="btn ghost" href={publicLink} target="_blank" rel="noreferrer">
              Abrir formulário público
            </a>
          )}
        </div>
      </div>

      {error && <div className="data-error">{error}</div>}

      <div className="requests-layout">
        <div className="requests-sidebar">
          <div className="card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Configuração</p>
                <h3>Formulário Público</h3>
              </div>
            </div>

            <div className="form-group">
              <label>Nome do formulário</label>
              <input
                value={newTemplate.name}
                onChange={(e) => setNewTemplate((t) => ({ ...t, name: e.target.value }))}
                placeholder="Ex.: Transporte Escolar 2024"
              />
            </div>

            <div className="form-group">
              <label>Descrição pública</label>
              <textarea
                value={newTemplate.description}
                onChange={(e) => setNewTemplate((t) => ({ ...t, description: e.target.value }))}
                placeholder="Instruções para o cidadão..."
                rows={3}
              />
            </div>

            <label className="inline-checkbox">
              <input
                type="checkbox"
                checked={newTemplate.is_active}
                onChange={(e) => setNewTemplate((t) => ({ ...t, is_active: e.target.checked }))}
              />
              Aceitando respostas
            </label>

            <Button onClick={createTemplate} disabled={!newTemplate.name} fullWidth>
              Criar Novo Formulário
            </Button>

            <div className="divider" />

            <p className="muted-label">Seus formulários</p>
            <div className="template-list">
              {templates.map(tmpl => (
                <div
                  key={tmpl.id}
                  className={`template-item ${selectedTemplate?.id === tmpl.id ? 'active' : ''}`}
                  onClick={() => setSelectedTemplate(tmpl)}
                >
                  <div className="template-info">
                    <strong>{tmpl.name}</strong>
                    <span className={`status-dot ${tmpl.is_active ? 'active' : 'inactive'}`}>
                      {tmpl.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="template-actions">
                    <a href={`${publicBase}/forms/${tmpl.slug}`} target="_blank" rel="noreferrer" title="Ver link">
                      Link
                    </a>
                    <button className="text-danger" onClick={(e) => { e.stopPropagation(); deleteTemplate(tmpl.id); }}>
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="requests-main">
          <div className="card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Entrada</p>
                <h3>Solicitações Recebidas</h3>
              </div>
              <span className="pill ghost">{submissions.length} protocolos</span>
            </div>

            {loading ? (
              <div className="skeleton-loader">Carregando solicitações...</div>
            ) : (
              <Table
                columns={[
                  { key: "protocol_number", label: "Protocolo" },
                  { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
                  { key: "created_at", label: "Data", render: (row) => new Date(row.created_at).toLocaleDateString("pt-BR") },
                  { key: "trip", label: "Viagem", render: (row) => row.linked_trip ? <span className="pill">#{row.linked_trip}</span> : "—" },
                  {
                    key: "actions",
                    label: "",
                    render: (row) => (
                      <Button size="sm" variant={selectedSubmission?.id === row.id ? "primary" : "ghost"} onClick={() => selectSubmission(row)}>
                        Revisar
                      </Button>
                    ),
                  },
                ]}
                data={submissions}
              />
            )}
          </div>

          {selectedSubmission && (
            <div className="card review-card animate-slide-up">
              <div className="review-header">
                <div>
                  <p className="eyebrow">Revisão</p>
                  <h3>Protocolo {selectedSubmission.protocol_number}</h3>
                </div>
                <Button variant="ghost" onClick={() => setSelectedSubmission(null)}>Fechar</Button>
              </div>

              <div className="review-grid">
                <div className="review-form">
                  <h4>Decisão</h4>
                  <div className="decision-box">
                    <label>
                      Ação
                      <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
                        <option value="APPROVED">✅ Aprovar e Gerar Viagem</option>
                        <option value="REJECTED">❌ Rejeitar Solicitação</option>
                        <option value="NEEDS_CORRECTION">⚠️ Solicitar Correção</option>
                      </select>
                    </label>
                    <label className="full-width">
                      Observações internas
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Justificativa ou notas para a equipe..."
                        rows={2}
                      />
                    </label>
                  </div>

                  <h4>Dados da Viagem</h4>
                  <div className="trip-form-grid">
                    <label>
                      Motorista
                      <select
                        value={reviewUpdates["driver_id"] || ""}
                        onChange={(e) => setReviewUpdates((u) => ({ ...u, driver_id: e.target.value }))}
                      >
                        <option value="">Selecione...</option>
                        {driverOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </label>
                    <label>
                      Veículo
                      <select
                        value={reviewUpdates["vehicle_id"] || ""}
                        onChange={(e) => setReviewUpdates((u) => ({ ...u, vehicle_id: e.target.value }))}
                      >
                        <option value="">Selecione...</option>
                        {vehicleOptions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                      </select>
                    </label>
                    <label>Origem <input value={reviewUpdates["origin"] || ""} onChange={(e) => setReviewUpdates((u) => ({ ...u, origin: e.target.value }))} /></label>
                    <label>Destino <input value={reviewUpdates["destination"] || ""} onChange={(e) => setReviewUpdates((u) => ({ ...u, destination: e.target.value }))} /></label>
                    <label>Saída <input type="datetime-local" value={reviewUpdates["departure_date"] ? `${reviewUpdates["departure_date"]}T${reviewUpdates["departure_time"] || "00:00"}` : ""} onChange={(e) => {
                      const [d, t] = e.target.value.split("T");
                      setReviewUpdates((u) => ({ ...u, departure_date: d, departure_time: t }));
                    }} /></label>
                    <label>Passageiros <input type="number" value={reviewUpdates["passengers_count"] || ""} onChange={(e) => setReviewUpdates((u) => ({ ...u, passengers_count: e.target.value }))} /></label>
                  </div>

                  <div className="review-actions">
                    <Button onClick={reviewSubmission} variant="primary">Confirmar Decisão</Button>
                  </div>
                </div>

                <div className="review-answers">
                  <h4>Respostas do Cidadão</h4>
                  <div className="answers-list">
                    {selectedSubmission.answers?.map((a) => (
                      <div key={a.id} className="answer-item">
                        <span className="question">{a.question_label}</span>
                        <span className="answer">{a.value_text || JSON.stringify(a.value_json) || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; className: string }> = {
    PENDING: { label: "Pendente", className: "warning" },
    APPROVED: { label: "Aprovado", className: "success" },
    REJECTED: { label: "Rejeitado", className: "danger" },
    NEEDS_CORRECTION: { label: "Correção", className: "warning" },
  };
  const info = map[status] || { label: status, className: "default" };
  return <span className={`status-badge ${info.className}`}>{info.label}</span>;
};
