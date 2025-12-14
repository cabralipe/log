import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import "../styles/DataPage.css";

type Submission = {
  id: number;
  protocol_number: string;
  cpf: string;
  status: string;
  status_notes?: string;
  form_name?: string;
  created_at: string;
  answers?: {
    id: number;
    field_name: string;
    question_label: string;
    value_text?: string;
    value_json?: any;
    file?: string;
  }[];
  linked_student_card?: { card_number: string };
};

const STATUS_OPTIONS = ["PENDING", "APPROVED", "REJECTED", "NEEDS_CORRECTION"];

export const FormSubmissionsPage = () => {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCpf, setFilterCpf] = useState("");
  const [filterTemplate, setFilterTemplate] = useState<number | "">("");
  const [filterMunicipality, setFilterMunicipality] = useState<number | "">("");
  const [templates, setTemplates] = useState<{ id: number; name: string }[]>([]);
  const [municipalities, setMunicipalities] = useState<{ id: number; name: string }[]>([]);
  const [reviewStatus, setReviewStatus] = useState("APPROVED");
  const [reviewNotes, setReviewNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .get<Submission[]>("/forms/submissions/", {
        params: {
          status: filterStatus || undefined,
          cpf: filterCpf || undefined,
          form_template: filterTemplate || undefined,
          municipality: filterMunicipality || undefined,
        },
      })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : (res.data as any).results ?? [];
        setSubmissions(data);
        setError(null);
      })
      .catch((err) => setError(err.response?.data?.detail || "Erro ao carregar submissões."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get("/forms/templates/").then((res) => {
      const data = Array.isArray(res.data) ? res.data : (res.data as any).results ?? [];
      setTemplates(data);
    });
    if (user?.role === "SUPERADMIN") {
      api.get("/municipalities/").then((res) => {
        const data = Array.isArray(res.data) ? res.data : (res.data as any).results ?? [];
        setMunicipalities(data);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectSubmission = async (sub: Submission) => {
    setSelected(null);
    try {
      const { data } = await api.get<Submission>(`/forms/submissions/${sub.id}/`);
      setSelected(data);
      setReviewStatus(data.status);
      setReviewNotes(data.status_notes ?? "");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao carregar submissão.");
    }
  };

  const review = async () => {
    if (!selected) return;
    try {
      await api.patch(`/forms/submissions/${selected.id}/review/`, {
        status: reviewStatus,
        status_notes: reviewNotes,
      });
      setReviewNotes("");
      load();
      selectSubmission(selected);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao aplicar decisão.");
    }
  };

  return (
    <div className="data-page">
      <div className="data-header">
        <div>
          <h1 className="data-title">Submissões de formulários</h1>
          <p className="data-subtitle">Revisão e decisão das respostas com filtros padronizados.</p>
        </div>
        <Button variant="ghost" onClick={load}>
          Recarregar
        </Button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "2fr 1.2fr" }}>
        <div>
          <div className="card" style={{ marginBottom: "0.75rem", display: "flex", gap: "0.5rem" }}>
            <input
              placeholder="Filtrar por CPF"
              value={filterCpf}
              onChange={(e) => setFilterCpf(e.target.value)}
              style={{ flex: 1 }}
            />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select value={filterTemplate} onChange={(e) => setFilterTemplate(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Formulários</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {user?.role === "SUPERADMIN" && (
              <select
                value={filterMunicipality}
                onChange={(e) => setFilterMunicipality(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Prefeituras</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
            <Button onClick={load}>Filtrar</Button>
          </div>
          {error && <div className="data-error">{error}</div>}
          {loading ? (
            <p>Carregando...</p>
          ) : (
            <Table
              columns={[
                { key: "protocol_number", label: "Protocolo" },
                { key: "cpf", label: "CPF" },
                { key: "form_name", label: "Formulário" },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <StatusBadge status={row.status} />,
                },
                { key: "created_at", label: "Criado em", render: (row) => new Date(row.created_at).toLocaleString() },
                {
                  key: "actions",
                  label: "Ações",
                  render: (row) => (
                    <Button variant="ghost" onClick={() => selectSubmission(row)}>
                      Ver / Revisar
                    </Button>
                  ),
                },
              ]}
              data={submissions}
            />
          )}
        </div>

        <div className="card" style={{ marginTop: "0.75rem" }}>
          <h3>Detalhes</h3>
          {!selected ? (
            <p style={{ color: "var(--muted)" }}>Selecione uma submissão para revisar.</p>
          ) : (
            <div className="grid" style={{ gap: "0.75rem" }}>
              <div>
                <div>Protocolo: {selected.protocol_number}</div>
                <div>CPF: {selected.cpf}</div>
                <div>Status atual: {selected.status}</div>
                {selected.linked_student_card && <div>Carteirinha: {selected.linked_student_card.card_number}</div>}
              </div>
              <div>
                <label>Status</label>
                <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Notas/ressalvas</label>
                <textarea
                  rows={3}
                  placeholder="Ex.: Envie RG legível"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>
              <div>
                <Button onClick={review}>Aplicar decisão</Button>
              </div>
              <div>
                <h4>Respostas</h4>
                {selected.answers?.length ? (
                  <div className="grid" style={{ gap: "0.5rem" }}>
                    {selected.answers.map((ans) => (
                      <div key={ans.id} className="card" style={{ background: "#0f1724" }}>
                        <strong>{ans.question_label}</strong>
                        {ans.file ? (
                          <div>
                            <a href={ans.file} target="_blank" rel="noreferrer">
                              Ver arquivo
                            </a>
                            {/\.(png|jpg|jpeg|gif)$/i.test(ans.file) && (
                              <div style={{ marginTop: "0.35rem" }}>
                                <img src={ans.file} alt={ans.question_label} style={{ maxWidth: "100%", borderRadius: 8 }} />
                              </div>
                            )}
                          </div>
                        ) : ans.value_json ? (
                          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem" }}>
                            {JSON.stringify(ans.value_json, null, 2)}
                          </pre>
                        ) : (
                          <div>{ans.value_text}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "var(--muted)" }}>Sem respostas.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
