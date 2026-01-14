import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API_ROOT } from "../../lib/api";
import { Button } from "../../components/Button";
import "./PublicForm.css";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle, AlertCircle, FileText, Search, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";

type FormQuestion = {
  id: number;
  order: number;
  label: string;
  help_text?: string;
  field_name: string;
  type: string;
  required: boolean;
  config?: Record<string, any>;
  options?: { id: number; label: string; value: string }[];
};

type FormTemplate = {
  id: number;
  name: string;
  description?: string;
  slug: string;
  questions: FormQuestion[];
  municipality?: number;
  schools?: { id: number; name: string }[];
};

type SubmissionStatus = {
  protocol_number: string;
  status: string;
  status_notes?: string;
  card?: {
    card_number: string;
    status: string;
    expiration_date: string;
    qr_payload: string;
  };
  answers?: {
    id: number;
    field_name: string;
    question_label: string;
    value_text?: string;
    value_json?: any;
    file?: string;
  }[];
  created_at: string;
  updated_at: string;
};

type FieldValue = string | string[] | File | null;

export const PublicFormPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);
  const [cpfStatus, setCpfStatus] = useState("");
  const [statuses, setStatuses] = useState<SubmissionStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [approvedSubmission, setApprovedSubmission] = useState<SubmissionStatus | null>(null);
  const [showStatusMobile, setShowStatusMobile] = useState(false);

  const sortedQuestions = useMemo(
    () => (template ? [...template.questions].sort((a, b) => a.order - b.order) : []),
    [template]
  );

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    axios
      .get<FormTemplate>(`${API_ROOT}/public/forms/${slug}/`)
      .then((res) => {
        setTemplate(res.data);
        setError(null);
      })
      .catch(() => setError("Formulário não encontrado ou inativo."))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleChange = (field: string, value: FieldValue) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !template) return;
    setSubmitting(true);
    setSubmitResult(null);
    const formData = new FormData();
    sortedQuestions.forEach((q) => {
      const val = values[q.field_name];
      if (q.type === "CHECKBOXES") {
        const arr = Array.isArray(val) ? val : val ? [val as string] : [];
        formData.append(q.field_name, JSON.stringify(arr));
      } else if (q.type === "FILE_UPLOAD" && val instanceof File) {
        formData.append(q.field_name, val);
      } else if (val !== undefined && val !== null) {
        formData.append(q.field_name, String(val));
      }
    });
    try {
      const { data } = await axios.post(`${API_ROOT}/public/forms/${slug}/submit/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSubmitResult(`Protocolo gerado com sucesso: ${data.protocol_number}`);
      setError(null);
      const cpfVal = values["cpf"];
      if (cpfVal) {
        setCpfStatus(String(cpfVal));
        fetchStatus(String(cpfVal));
        setShowStatusMobile(true); // Auto-open status on mobile after submit
      }
      // Clear form
      setValues({});
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao enviar inscrição. Verifique os campos obrigatórios.");
    } finally {
      setSubmitting(false);
    }
  };

  const fetchStatus = async (cpf: string) => {
    if (!slug) return;
    try {
      const { data } = await axios.get<{ submissions: SubmissionStatus[] }>(
        `${API_ROOT}/public/forms/${slug}/status/`,
        { params: { cpf } }
      );
      setStatuses(data.submissions);
      const approved = data.submissions.find((s) => s.status === "APPROVED");
      setApprovedSubmission(approved || null);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao consultar status.");
    }
  };

  useEffect(() => {
    if (cpfStatus) fetchStatus(cpfStatus);
  }, [cpfStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const getAnswerValue = (answers: SubmissionStatus["answers"] | undefined, fieldNames: string | string[]) => {
    const fields = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
    const ans = answers?.find((a) => fields.includes(a.field_name));
    if (!ans) return "";
    const question = sortedQuestions.find((q) => q.field_name === ans.field_name);
    const resolveOptionLabel = (fieldName: string, rawValue: string) => {
      if (fieldName === "school_id" && template?.schools?.length) {
        return template.schools.find((s) => String(s.id) === String(rawValue))?.name ?? rawValue;
      }
      if (question?.options?.length) {
        return question.options.find((opt) => opt.value === rawValue)?.label ?? rawValue;
      }
      return rawValue;
    };
    if (ans.value_json !== null && ans.value_json !== undefined) {
      if (Array.isArray(ans.value_json)) {
        return ans.value_json.map((val) => resolveOptionLabel(ans.field_name, String(val))).join(", ");
      }
      if (typeof ans.value_json === "object") return JSON.stringify(ans.value_json);
      return String(ans.value_json);
    }
    if (!ans.value_text) return "";
    return resolveOptionLabel(ans.field_name, ans.value_text);
  };

  if (loading) return <div className="public-form-page"><div className="card">Carregando formulário...</div></div>;
  if (error && !template)
    return (
      <div className="public-form-page">
        <div className="card" style={{ color: "#f87171", textAlign: "center", padding: "2rem" }}>
          <AlertCircle size={48} style={{ margin: "0 auto 1rem" }} />
          <h3>Não foi possível carregar o formulário</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  if (!template) return null;

  const renderField = (q: FormQuestion) => {
    const dynamicOptions =
      q.field_name === "school_id" && template?.schools?.length
        ? template.schools.map((s) => ({ value: String(s.id), label: s.name }))
        : q.options;
    const baseProps = {
      required: q.required,
      id: `field-${q.id}`,
    };

    // Helper for input mode
    const getInputMode = (fieldName: string) => {
      if (fieldName === "cpf") return "numeric";
      if (fieldName.includes("email")) return "email";
      if (fieldName.includes("phone") || fieldName.includes("tel")) return "tel";
      return "text";
    };

    if (q.type === "LONG_TEXT") {
      return (
        <textarea
          {...baseProps}
          value={(values[q.field_name] as string) || ""}
          onChange={(e) => handleChange(q.field_name, e.target.value)}
          rows={3}
          placeholder="Digite sua resposta aqui..."
        />
      );
    }
    if (q.type === "MULTIPLE_CHOICE") {
      return (
        <div className="choice-list">
          {dynamicOptions?.map((opt) => (
            <label key={opt.value} className="choice-item">
              <input
                type="radio"
                name={q.field_name}
                value={opt.value}
                required={q.required}
                checked={values[q.field_name] === opt.value}
                onChange={(e) => handleChange(q.field_name, e.target.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      );
    }
    if (q.type === "CHECKBOXES") {
      return (
        <div className="choice-list">
          {dynamicOptions?.map((opt) => {
            const current = (values[q.field_name] as string[]) || [];
            const checked = current.includes(opt.value);
            return (
              <label key={opt.value} className="choice-item">
                <input
                  type="checkbox"
                  value={opt.value}
                  checked={checked}
                  onChange={() => {
                    const next = checked ? current.filter((v) => v !== opt.value) : [...current, opt.value];
                    handleChange(q.field_name, next);
                  }}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      );
    }
    if (q.type === "DROPDOWN") {
      return (
        <select
          {...baseProps}
          value={(values[q.field_name] as string) || ""}
          onChange={(e) => handleChange(q.field_name, e.target.value)}
        >
          <option value="">Selecione uma opção...</option>
          {dynamicOptions?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }
    if (q.type === "DATE") {
      return (
        <input
          type="date"
          {...baseProps}
          value={(values[q.field_name] as string) || ""}
          onChange={(e) => handleChange(q.field_name, e.target.value)}
        />
      );
    }
    if (q.type === "TIME") {
      return (
        <input
          type="time"
          {...baseProps}
          value={(values[q.field_name] as string) || ""}
          onChange={(e) => handleChange(q.field_name, e.target.value)}
        />
      );
    }
    if (q.type === "FILE_UPLOAD") {
      return <input type="file" {...baseProps} onChange={(e) => handleChange(q.field_name, e.target.files?.[0] ?? null)} />;
    }
    if (q.type === "LINEAR_SCALE") {
      return (
        <input
          type="number"
          inputMode="numeric"
          min={q.config?.min ?? 1}
          max={q.config?.max ?? 5}
          {...baseProps}
          value={(values[q.field_name] as string) || ""}
          onChange={(e) => handleChange(q.field_name, e.target.value)}
        />
      );
    }
    return (
      <input
        {...baseProps}
        type={q.field_name.includes("email") ? "email" : "text"}
        inputMode={getInputMode(q.field_name)}
        value={(values[q.field_name] as string) || ""}
        onChange={(e) => handleChange(q.field_name, e.target.value)}
        placeholder="Sua resposta"
      />
    );
  };

  return (
    <div className="public-form-page">
      <section className="form-hero">
        <div>
          <p className="eyebrow">Prefeitura Municipal</p>
          <h1>{template.name}</h1>
          {template.description && <p className="muted">{template.description}</p>}
          <div className="pill-row">
            <span className="pill">Formulário público</span>
            <span className="pill soft">Responda e gere um protocolo</span>
          </div>
        </div>
      </section>

      {approvedSubmission && approvedSubmission.card && (
        <div className="card card-overlay">
          <div className="card-overlay__inner">
            <div className="ticket-container">
              <div className="ticket-left">
                <div className="ticket-header">
                  <div className="ticket-title">Carteirinha Estudantil</div>
                  <h2 className="ticket-subtitle">Transporte Municipal</h2>
                </div>

                <div className="ticket-body">
                  <div className="ticket-field" style={{ gridColumn: "1 / -1" }}>
                    <label>Aluno</label>
                    <strong>{getAnswerValue(approvedSubmission.answers, "full_name") || "—"}</strong>
                  </div>
                  <div className="ticket-field" style={{ gridColumn: "1 / -1" }}>
                    <label>Unidade Acadêmica</label>
                    <strong>{getAnswerValue(approvedSubmission.answers, ["school", "school_name", "school_id"]) || "—"}</strong>
                  </div>
                  <div className="ticket-field">
                    <label>Turno(s)</label>
                    <strong>{getAnswerValue(approvedSubmission.answers, "shift") || "—"}</strong>
                  </div>
                  <div className="ticket-field">
                    <label>Curso(s)</label>
                    <strong>{getAnswerValue(approvedSubmission.answers, "course") || "—"}</strong>
                  </div>
                  <div className="ticket-field">
                    <label>Carteirinha</label>
                    <strong>{approvedSubmission.card.card_number}</strong>
                  </div>
                  <div className="ticket-field">
                    <label>Validade</label>
                    <strong>{approvedSubmission.card.expiration_date}</strong>
                  </div>
                </div>

                <div className="ticket-footer">
                  <div className="ticket-status">
                    <CheckCircle size={16} />
                    {approvedSubmission.status}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="ticket-field">
                      <label>Protocolo</label>
                      <strong style={{ fontSize: "0.9rem" }}>{approvedSubmission.protocol_number}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ticket-right">
                {approvedSubmission.card.qr_payload ? (
                  <QRCodeSVG
                    value={approvedSubmission.card.qr_payload}
                    size={160}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    style={{ padding: "8px", background: "white", borderRadius: "8px" }}
                  />
                ) : (
                  <div className="qr-placeholder">QR</div>
                )}
                <p className="muted" style={{ fontSize: "0.75rem", marginTop: "1rem", textAlign: "center" }}>
                  Apresente este código ao motorista
                </p>
              </div>
            </div>

            <div style={{ position: "absolute", bottom: "2rem", left: "50%", transform: "translateX(-50%)" }}>
              <Button variant="ghost" onClick={() => setApprovedSubmission(null)} style={{ background: "rgba(0,0,0,0.5)", color: "white" }}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="form-layout">
        <div className="card form-card">
          <header className="form-card__header">
            <div>
              <p className="eyebrow">Solicitação</p>
              <h2>Preencha os dados</h2>
            </div>
            <div className="badge">Campos marcados com * são obrigatórios</div>
          </header>

          {error && <div className="alert error"><AlertCircle size={18} /> {error}</div>}
          {submitResult && <div className="alert success"><CheckCircle size={18} /> {submitResult}</div>}

          <form className="form-grid responsive" onSubmit={handleSubmit}>
            {sortedQuestions.map((q) => (
              <div key={q.id} className="question-block">
                <div className="question-heading">
                  <label htmlFor={`field-${q.id}`}>
                    <span className="question-label">
                      {q.label} {q.required && <span className="required">*</span>}
                    </span>
                    {q.help_text && <small className="muted">{q.help_text}</small>}
                  </label>
                </div>
                {renderField(q)}
              </div>
            ))}
            <div className="full-width">
              <Button type="submit" disabled={submitting} style={{ width: "100%", height: "52px", fontSize: "1.1rem" }}>
                {submitting ? "Enviando..." : "Enviar solicitação"} <ArrowRight size={18} style={{ marginLeft: "8px" }} />
              </Button>
            </div>
          </form>
        </div>

        <button
          className="mobile-status-toggle"
          onClick={() => setShowStatusMobile(!showStatusMobile)}
        >
          {showStatusMobile ? (
            <>Ocultar consulta de status <ChevronUp size={16} /></>
          ) : (
            <>Consultar status / protocolo <ChevronDown size={16} /></>
          )}
        </button>

        <aside className={`card status-card ${!showStatusMobile ? 'mobile-hidden' : ''}`}>
          <div className="status-card__header">
            <p className="eyebrow">Acompanhar</p>
            <h3>Consulte pelo CPF</h3>
            <p className="muted">Veja protocolos abertos e o andamento da emissão.</p>
          </div>
          <div className="status-search">
            <input
              placeholder="Digite o CPF"
              value={cpfStatus}
              onChange={(e) => setCpfStatus(e.target.value)}
              inputMode="numeric"
            />
            <Button type="button" onClick={() => fetchStatus(cpfStatus)} disabled={!cpfStatus}>
              <Search size={18} />
            </Button>
          </div>
          {statuses.length === 0 ? (
            <p className="muted" style={{ textAlign: "center", padding: "1rem" }}>Nenhuma inscrição encontrada para este CPF.</p>
          ) : (
            <div className="status-list">
              {statuses.map((s) => (
                <div key={s.protocol_number} className="status-item">
                  <div className="status-item__top">
                    <div>
                      <p className="eyebrow">Protocolo</p>
                      <strong>{s.protocol_number}</strong>
                    </div>
                    <div className={`status-chip ${s.status.toLowerCase()}`}>{s.status}</div>
                  </div>
                  {s.status_notes && <p className="muted">{s.status_notes}</p>}
                  {s.answers?.length ? (
                    <div className="status-meta muted">
                      {s.answers.map((ans) => (
                        <div key={ans.id}>
                          <strong>{ans.question_label}:</strong>{" "}
                          {ans.value_json !== undefined && ans.value_json !== null
                            ? Array.isArray(ans.value_json)
                              ? ans.value_json.join(", ")
                              : typeof ans.value_json === "object"
                                ? JSON.stringify(ans.value_json)
                                : String(ans.value_json)
                            : ans.value_text || ""}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">Sem dados informados.</p>
                  )}
                  {s.card && (
                    <div className="status-meta">
                      <p>
                        <strong>Carteirinha:</strong> {s.card.card_number}
                      </p>
                      <p className="muted">Validade: {s.card.expiration_date}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
