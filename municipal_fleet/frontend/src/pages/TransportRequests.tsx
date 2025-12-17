import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { api, API_ROOT } from "../lib/api";
import { Button } from "../components/Button";
import { Table } from "../components/Table";
import "../styles/DataPage.css";

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
      setVehicleOptions(arr.map((v) => ({ id: v.id, label: `${v.license_plate} — ${v.model}` })));
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
          <p className="data-subtitle">Gere o link público, acompanhe protocolos e aprove para virar viagem.</p>
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

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1.8fr", gap: "1rem" }}>
        <div className="card">
          <p className="eyebrow">Formulário público</p>
          <h3>Configuração</h3>
          <p className="muted">Campos fixos: CPF, contatos, origem/destino, datas/horários, passageiros (quantidade e lista opcional), motorista e veículo (seleção), observações.</p>
          <label>
            Nome
            <input
              value={newTemplate.name}
              onChange={(e) => setNewTemplate((t) => ({ ...t, name: e.target.value }))}
              placeholder="Ex.: Solicitação de transporte escolar"
            />
          </label>
          <label>
            Descrição
            <textarea
              value={newTemplate.description}
              onChange={(e) => setNewTemplate((t) => ({ ...t, description: e.target.value }))}
              placeholder="Texto que o solicitante vê no topo do formulário."
            />
          </label>
          <label className="inline-checkbox">
            <input
              type="checkbox"
              checked={newTemplate.is_active}
              onChange={(e) => setNewTemplate((t) => ({ ...t, is_active: e.target.checked }))}
            />
            Formulário ativo
          </label>
          <Button onClick={createTemplate} disabled={!newTemplate.name}>
            Gerar formulário
          </Button>
          <hr />
          <h4>Formulários existentes</h4>
          <Table
            columns={[
              { key: "name", label: "Nome" },
              { key: "slug", label: "Slug" },
              { key: "status", label: "Ativo", render: (row) => (row.is_active ? "Sim" : "Não") },
              {
                key: "actions",
                label: "Ações",
                render: (row) => (
                  <div className="inline-row">
                    <Button variant={selectedTemplate?.id === row.id ? "primary" : "ghost"} onClick={() => setSelectedTemplate(row)}>
                      Usar
                    </Button>
                    <a className="link" href={`${publicBase}/forms/${row.slug}`} target="_blank" rel="noreferrer">
                      Link
                    </a>
                    <button className="link danger" onClick={() => deleteTemplate(row.id)}>
                      Excluir
                    </button>
                  </div>
                ),
              },
            ]}
            data={templates}
          />
          {selectedTemplate && (
            <div className="card" style={{ marginTop: "0.75rem" }}>
              <p className="eyebrow">Link público</p>
              <code style={{ display: "block", overflowWrap: "anywhere" }}>{publicLink}</code>
              <p className="muted">Compartilhe para que cidadãos façam pedidos de transporte.</p>
            </div>
          )}
        </div>

        <div className="card">
          <p className="eyebrow">Solicitações recebidas</p>
          <h3>Protocolos</h3>
          {loading ? (
            <p>Carregando...</p>
          ) : (
            <Table
              columns={[
                { key: "protocol_number", label: "Protocolo" },
                { key: "status", label: "Status" },
                { key: "created_at", label: "Criado em", render: (row) => new Date(row.created_at).toLocaleString("pt-BR") },
                {
                  key: "trip",
                  label: "Viagem",
                  render: (row) => (row.linked_trip ? `#${row.linked_trip}` : "—"),
                },
                {
                  key: "actions",
                  label: "Ações",
                  render: (row) => (
                    <Button variant="ghost" onClick={() => selectSubmission(row)}>
                      Revisar
                    </Button>
                  ),
                },
              ]}
              data={submissions}
            />
          )}
          {selectedSubmission && (
            <div className="card" style={{ marginTop: "0.75rem" }}>
              <h4>Revisar protocolo {selectedSubmission.protocol_number}</h4>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "0.5rem" }}>
                <label>
                  Status
                  <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
                    <option value="APPROVED">Aprovar (gera viagem)</option>
                    <option value="REJECTED">Rejeitar</option>
                    <option value="NEEDS_CORRECTION">Correção necessária</option>
                  </select>
                </label>
                <label>
                  Motorista
                  <select
                    value={reviewUpdates["driver_id"] || ""}
                    onChange={(e) => setReviewUpdates((u) => ({ ...u, driver_id: e.target.value }))}
                  >
                    <option value="">Selecione</option>
                    {driverOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Veículo
                  <select
                    value={reviewUpdates["vehicle_id"] || ""}
                    onChange={(e) => setReviewUpdates((u) => ({ ...u, vehicle_id: e.target.value }))}
                  >
                    <option value="">Selecione</option>
                    {vehicleOptions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Origem
                  <input
                    value={reviewUpdates["origin"] || ""}
                    onChange={(e) => setReviewUpdates((u) => ({ ...u, origin: e.target.value }))}
                  />
                </label>
                <label>
                  Destino
                  <input
                    value={reviewUpdates["destination"] || ""}
                    onChange={(e) => setReviewUpdates((u) => ({ ...u, destination: e.target.value }))}
                  />
                </label>
                <label>
                  Data de saída
                  <input
                    type="date"
                    value={reviewUpdates["departure_date"] || ""}
                    onChange={(e) => setReviewUpdates((u) => ({ ...u, departure_date: e.target.value }))}
                  />
                </label>
                <label>
                  Horário de saída
                  <input
                    type="time"
                    value={reviewUpdates["departure_time"] || ""}
                    onChange={(e) => setReviewUpdates((u) => ({ ...u, departure_time: e.target.value }))}
                  />
                </label>
                <label>
                  Data de retorno
                  <input
                    type="date"
                    value={reviewUpdates["return_date"] || ""}
                    onChange={(e) => setReviewUpdates((u) => ({ ...u, return_date: e.target.value }))}
                  />
                </label>
                <label>
                  Horário de retorno
                  <input
                    type="time"
                    value={reviewUpdates["return_time"] || ""}
                    onChange={(e) => setReviewUpdates((u) => ({ ...u, return_time: e.target.value }))}
                  />
                </label>
                <label>
                  Passageiros (quantidade)
                  <input
                    type="number"
                    value={reviewUpdates["passengers_count"] || ""}
                    onChange={(e) => setReviewUpdates((u) => ({ ...u, passengers_count: e.target.value }))}
                  />
                </label>
                <label className="full-width">
                  Observações
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Opcional — será salvo junto ao protocolo."
                  />
                </label>
                <label className="full-width">
                  Passageiros (lista/nomes, opcional)
                  <textarea
                    value={reviewUpdates["passengers_details"] || ""}
                    onChange={(e) => setReviewUpdates((u) => ({ ...u, passengers_details: e.target.value }))}
                    placeholder="Informe nomes e contatos, se quiser."
                  />
                </label>
              </div>
              <Button onClick={reviewSubmission}>Aplicar decisão</Button>
              <div style={{ marginTop: "0.75rem" }}>
                <p className="eyebrow">Respostas</p>
                {selectedSubmission.answers?.length ? (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.35rem" }}>
                    {selectedSubmission.answers.map((a) => (
                      <li key={a.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem" }}>
                        <strong>{a.question_label}</strong>
                        <div style={{ color: "var(--muted)" }}>{a.value_text || JSON.stringify(a.value_json) || "—"}</div>
                        {a.modified_by_staff && (
                          <div style={{ color: "#f59e0b", fontSize: "0.9rem" }}>
                            Ajustado pela secretaria: {a.staff_value_text || JSON.stringify(a.staff_value_json)}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Respostas não carregadas.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
