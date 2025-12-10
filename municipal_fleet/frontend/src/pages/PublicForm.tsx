import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API_ROOT } from "../lib/api";
import { Button } from "../components/Button";

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
  student?: {
    id: number;
    full_name: string;
    school?: string;
    grade?: string;
    shift?: string;
  };
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
      setSubmitResult(`Protocolo gerado: ${data.protocol_number}`);
      setError(null);
      const cpfVal = values["cpf"];
      if (cpfVal) setCpfStatus(String(cpfVal));
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
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao consultar status.");
    }
  };

  useEffect(() => {
    if (cpfStatus) fetchStatus(cpfStatus);
  }, [cpfStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div style={{ padding: "2rem" }}>Carregando formulário...</div>;
  if (error && !template) return <div style={{ padding: "2rem", color: "#f87171" }}>{error}</div>;
  if (!template) return null;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h1 style={{ marginBottom: "0.25rem" }}>{template.name}</h1>
        {template.description && <p style={{ color: "var(--muted)" }}>{template.description}</p>}
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3>Solicitação</h3>
        {error && <p style={{ color: "#f87171" }}>{error}</p>}
        {submitResult && <p style={{ color: "#34d399" }}>{submitResult}</p>}
        <form className="grid form-grid" onSubmit={handleSubmit}>
          {sortedQuestions.map((q) => (
            <div key={q.id} style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <label style={{ fontWeight: 600 }}>
                {q.label} {q.required && <span style={{ color: "#fbbf24" }}>*</span>}
              </label>
              {q.help_text && <small style={{ color: "var(--muted)" }}>{q.help_text}</small>}
              {q.type === "LONG_TEXT" ? (
                <textarea
                  required={q.required}
                  value={(values[q.field_name] as string) || ""}
                  onChange={(e) => handleChange(q.field_name, e.target.value)}
                  rows={3}
                />
              ) : q.type === "MULTIPLE_CHOICE" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  {q.options?.map((opt) => (
                    <label key={opt.value} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
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
              ) : q.type === "CHECKBOXES" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  {q.options?.map((opt) => {
                    const current = (values[q.field_name] as string[]) || [];
                    const checked = current.includes(opt.value);
                    return (
                      <label key={opt.value} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <input
                          type="checkbox"
                          value={opt.value}
                          checked={checked}
                          onChange={(e) => {
                            const next = checked ? current.filter((v) => v !== opt.value) : [...current, opt.value];
                            handleChange(q.field_name, next);
                          }}
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              ) : q.type === "DROPDOWN" ? (
                <select
                  required={q.required}
                  value={(values[q.field_name] as string) || ""}
                  onChange={(e) => handleChange(q.field_name, e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {q.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : q.type === "DATE" ? (
                <input
                  type="date"
                  required={q.required}
                  value={(values[q.field_name] as string) || ""}
                  onChange={(e) => handleChange(q.field_name, e.target.value)}
                />
              ) : q.type === "TIME" ? (
                <input
                  type="time"
                  required={q.required}
                  value={(values[q.field_name] as string) || ""}
                  onChange={(e) => handleChange(q.field_name, e.target.value)}
                />
              ) : q.type === "FILE_UPLOAD" ? (
                <input
                  type="file"
                  required={q.required}
                  onChange={(e) => handleChange(q.field_name, e.target.files?.[0] ?? null)}
                />
              ) : q.type === "LINEAR_SCALE" ? (
                <input
                  type="number"
                  min={q.config?.min ?? 1}
                  max={q.config?.max ?? 5}
                  required={q.required}
                  value={(values[q.field_name] as string) || ""}
                  onChange={(e) => handleChange(q.field_name, e.target.value)}
                />
              ) : (
                <input
                  required={q.required}
                  value={(values[q.field_name] as string) || ""}
                  onChange={(e) => handleChange(q.field_name, e.target.value)}
                />
              )}
            </div>
          ))}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar solicitação"}
          </Button>
        </form>
      </div>

      <div className="card">
        <h3>Acompanhar pelo CPF</h3>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <input
            placeholder="Digite o CPF"
            value={cpfStatus}
            onChange={(e) => setCpfStatus(e.target.value)}
            style={{ flex: 1 }}
          />
          <Button type="button" onClick={() => fetchStatus(cpfStatus)} disabled={!cpfStatus}>
            Consultar
          </Button>
        </div>
        {statuses.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Nenhuma inscrição encontrada para este CPF.</p>
        ) : (
          <div className="grid" style={{ gap: "0.75rem" }}>
            {statuses.map((s) => (
              <div key={s.protocol_number} className="card" style={{ background: "#0f1724" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <strong>Protocolo</strong>
                    <div>{s.protocol_number}</div>
                  </div>
                  <div>
                    <strong>Status</strong>
                    <div>{s.status}</div>
                  </div>
                </div>
                {s.status_notes && <p style={{ marginTop: "0.5rem", color: "var(--muted)" }}>{s.status_notes}</p>}
                {s.card && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <strong>Carteirinha</strong>
                    <div>Número: {s.card.card_number}</div>
                    <div>Validade: {s.card.expiration_date}</div>
                  </div>
                )}
                {s.student && (
                  <div style={{ marginTop: "0.5rem", color: "var(--muted)" }}>
                    <div>Aluno: {s.student.full_name}</div>
                    {s.student.school && <div>Escola: {s.student.school}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
