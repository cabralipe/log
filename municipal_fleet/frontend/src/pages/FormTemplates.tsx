import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { api, API_ROOT } from "../lib/api";
import { Button } from "../components/Button";
import { Table } from "../components/Table";
import { StatusBadge } from "../components/StatusBadge";
import "../styles/DataPage.css";

type FormTemplate = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  require_cpf: boolean;
  form_type: string;
  municipality?: number | null;
};

type FormQuestion = {
  id: number;
  form_template: number;
  order: number;
  label: string;
  field_name: string;
  type: string;
  required: boolean;
  options?: { id: number; label: string; value: string }[];
};

const QUESTION_TYPES = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "MULTIPLE_CHOICE",
  "CHECKBOXES",
  "DROPDOWN",
  "LINEAR_SCALE",
  "MULTIPLE_CHOICE_GRID",
  "CHECKBOX_GRID",
  "DATE",
  "TIME",
  "FILE_UPLOAD",
];

const FORM_TYPES = [
  { value: "STUDENT_CARD_APPLICATION", label: "Carteirinha Estudantil (CPF obrigatório)" },
  { value: "GENERIC", label: "Genérico (CPF opcional)" },
];

export const FormTemplatesPage = () => {
  const { user } = useAuth();
  const [municipalities, setMunicipalities] = useState<{ id: number; name: string }[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [selected, setSelected] = useState<FormTemplate | null>(null);
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<FormQuestion | null>(null);
  const [optionLabel, setOptionLabel] = useState("");
  const [optionValue, setOptionValue] = useState("");
  const [newTemplate, setNewTemplate] = useState<Partial<FormTemplate>>({
    name: "",
    description: "",
    slug: "",
    is_active: true,
    form_type: "STUDENT_CARD_APPLICATION",
    require_cpf: true,
  });
  const [newQuestion, setNewQuestion] = useState<Partial<FormQuestion>>({
    order: 1,
    type: "SHORT_TEXT",
    required: true,
  });

  const publicLink = useMemo(() => {
    if (!selected) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const base = origin || API_ROOT?.replace(/\/api\/?$/, "") || "";
    return `${base}/public/forms/${selected.slug}`;
  }, [selected]);

  useEffect(() => {
    if (user?.role === "SUPERADMIN") {
      api
        .get<{ results: { id: number; name: string }[] }>("/municipalities/", { params: { page_size: 1000 } })
        .then((res) => {
          const data = Array.isArray(res.data) ? res.data : (res.data as any).results ?? [];
          setMunicipalities(data);
        })
        .catch(() => setMunicipalities([]));
    }
    if (user?.municipality) {
      setNewTemplate((t) => ({ ...t, municipality: user.municipality }));
    }
  }, [user]);

  const loadTemplates = () => {
    api
      .get<FormTemplate[]>("/forms/templates/")
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : (res.data as any).results ?? [];
        setTemplates(data);
        setError(null);
      })
      .catch((err) => setError(parseError(err) || "Erro ao carregar formulários."));
  };

  const loadQuestions = (templateId: number) => {
    api
      .get<FormQuestion[]>("/forms/questions/", { params: { form_template: templateId, ordering: "order" } })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : (res.data as any).results ?? [];
        setQuestions(data);
        setSelectedQuestion(data[0] ?? null);
      })
      .catch(() => setQuestions([]));
  };

  useEffect(() => {
    loadTemplates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const createTemplate = async () => {
    try {
      const { data } = await api.post<FormTemplate>("/forms/templates/", newTemplate);
      setNewTemplate({
        name: "",
        description: "",
        slug: "",
        is_active: true,
        form_type: "STUDENT_CARD_APPLICATION",
        require_cpf: true,
      });
      loadTemplates();
      setSelected(data);
      loadQuestions(data.id);
    } catch (err: any) {
      setError(parseError(err) || "Erro ao criar formulário.");
    }
  };

  const createQuestion = async () => {
    if (!selected) return;
    setQuestionError(null);
    try {
      await api.post("/forms/questions/", { ...newQuestion, form_template: selected.id });
      setNewQuestion({ order: (newQuestion.order || 1) + 1, type: "SHORT_TEXT", required: true });
      loadQuestions(selected.id);
    } catch (err: any) {
      setQuestionError(parseError(err) || "Erro ao criar pergunta (campo CPF é obrigatório e deve ser required).");
    }
  };

  const updateQuestion = async (updates: Partial<FormQuestion>) => {
    if (!selectedQuestion) return;
    try {
      await api.patch(`/forms/questions/${selectedQuestion.id}/`, updates);
      loadQuestions(selectedQuestion.form_template);
    } catch (err: any) {
      setQuestionError(parseError(err) || "Erro ao atualizar pergunta.");
    }
  };

  const deleteQuestion = async (question: FormQuestion) => {
    if (!selected || !confirm("Remover esta pergunta?")) return;
    try {
      await api.delete(`/forms/questions/${question.id}/`);
      loadQuestions(selected.id);
      setSelectedQuestion(null);
    } catch (err: any) {
      setQuestionError(parseError(err) || "Não foi possível remover (CPF obrigatório não pode ser removido).");
    }
  };

  const addOption = async () => {
    if (!selectedQuestion || !optionLabel || !optionValue) return;
    try {
      await api.post("/forms/options/", {
        question: selectedQuestion.id,
        label: optionLabel,
        value: optionValue,
        order: (selectedQuestion.options?.length || 0) + 1,
      });
      setOptionLabel("");
      setOptionValue("");
      loadQuestions(selectedQuestion.form_template);
    } catch (err: any) {
      setQuestionError(parseError(err) || "Erro ao adicionar opção.");
    }
  };

  const deleteOption = async (optionId: number) => {
    if (!confirm("Remover esta opção?")) return;
    await api.delete(`/forms/options/${optionId}/`);
    if (selectedQuestion) loadQuestions(selectedQuestion.form_template);
  };

  return (
    <div className="data-page">
      <div className="data-header">
        <div>
          <h1 className="data-title">Formulários</h1>
          <p className="data-subtitle">Templates, perguntas e fluxo público com o mesmo padrão visual.</p>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1.8fr" }}>
        <div className="card">
          <h2>Novo formulário</h2>
          {error && <div className="data-error">{error}</div>}
        <div className="grid form-grid">
          <input
            placeholder="Nome (ex.: Solicitação Carteirinha 2025)"
            value={newTemplate.name ?? ""}
            onChange={(e) => setNewTemplate((t) => ({ ...t, name: e.target.value }))}
          />
          <input
            placeholder="Slug (opcional, ex.: carteirinha-2025)"
            value={newTemplate.slug ?? ""}
            onChange={(e) => setNewTemplate((t) => ({ ...t, slug: e.target.value }))}
          />
          <textarea
            placeholder="Descrição"
            value={newTemplate.description ?? ""}
            onChange={(e) => setNewTemplate((t) => ({ ...t, description: e.target.value }))}
          />
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={newTemplate.is_active ?? true}
              onChange={(e) => setNewTemplate((t) => ({ ...t, is_active: e.target.checked }))}
            />
            Ativo
          </label>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            {user?.role === "SUPERADMIN" && (
              <div>
                <label>Prefeitura</label>
                <select
                  value={newTemplate.municipality ?? ""}
                  onChange={(e) => setNewTemplate((t) => ({ ...t, municipality: Number(e.target.value) }))}
                >
                  <option value="">Selecione...</option>
                  {municipalities.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label>Tipo</label>
              <select
                value={newTemplate.form_type}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setNewTemplate((t) => ({
                    ...t,
                    form_type: nextType,
                    require_cpf: nextType === "STUDENT_CARD_APPLICATION" ? true : t.require_cpf ?? false,
                  }));
                }}
              >
                {FORM_TYPES.map((ft) => (
                  <option key={ft.value} value={ft.value}>
                    {ft.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "1.6rem" }}>
              <input
                type="checkbox"
                checked={newTemplate.require_cpf ?? false}
                disabled={newTemplate.form_type === "STUDENT_CARD_APPLICATION"}
                onChange={(e) => setNewTemplate((t) => ({ ...t, require_cpf: e.target.checked }))}
              />
              <span>Exigir CPF</span>
            </div>
          </div>
          <Button
            onClick={createTemplate}
            disabled={!newTemplate.name || (user?.role === "SUPERADMIN" && !newTemplate.municipality)}
          >
            Criar formulário
          </Button>
        </div>
        <div style={{ marginTop: "1rem" }}>
          <h3>Formulários existentes</h3>
          <Table
            columns={[
              { key: "name", label: "Nome" },
              { key: "slug", label: "Slug" },
              { key: "is_active", label: "Ativo", render: (row) => <StatusBadge status={row.is_active ? "ACTIVE" : "INACTIVE"} /> },
              {
                key: "actions",
                label: "Ações",
                render: (row) => (
                  <Button variant="ghost" onClick={() => {
                    setSelected(row);
                    loadQuestions(row.id);
                  }}>
                    Editar / Perguntas
                  </Button>
                ),
              },
            ]}
            data={templates}
          />
        </div>

        <div className="card" style={{ marginTop: "1rem" }}>
          <h2>Construtor</h2>
        {!selected ? (
          <p style={{ color: "var(--muted)" }}>Selecione um formulário para gerenciar perguntas e copiar o link público.</p>
        ) : (
          <div className="grid" style={{ gap: "0.75rem" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                <div>
                  <strong>{selected.name}</strong>
                  <div style={{ color: "var(--muted)" }}>{selected.description}</div>
                </div>
                <div className="card" style={{ background: "#0f1724", minWidth: 260 }}>
                  <small style={{ color: "var(--muted)" }}>Link que os estudantes usam para preencher</small>
                  <div style={{ fontSize: "0.95rem", wordBreak: "break-all", margin: "0.25rem 0" }}>{publicLink}</div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(publicLink);
                      }}
                    >
                      Copiar link
                    </Button>
                    <Button variant="ghost" onClick={() => window.open(publicLink, "_blank")}>
                      Abrir
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ background: "#0f1724" }}>
              <h4>Nova pergunta</h4>
              {questionError && <p style={{ color: "#f87171" }}>{questionError}</p>}
              <div className="grid form-grid">
                <input
                  placeholder="Label"
                  value={newQuestion.label ?? ""}
                  onChange={(e) => setNewQuestion((q) => ({ ...q, label: e.target.value }))}
                />
                <input
                  placeholder="field_name (ex.: cpf, full_name)"
                  value={newQuestion.field_name ?? ""}
                  onChange={(e) => setNewQuestion((q) => ({ ...q, field_name: e.target.value }))}
                />
                <input
                  type="number"
                  placeholder="Ordem"
                  value={newQuestion.order ?? 1}
                  onChange={(e) => setNewQuestion((q) => ({ ...q, order: Number(e.target.value) }))}
                />
                <select
                  value={newQuestion.type}
                  onChange={(e) => setNewQuestion((q) => ({ ...q, type: e.target.value }))}
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={newQuestion.required ?? true}
                    onChange={(e) => setNewQuestion((q) => ({ ...q, required: e.target.checked }))}
                  />
                  Obrigatório
                </label>
                <Button onClick={createQuestion} disabled={!newQuestion.label || !newQuestion.field_name}>
                  Adicionar pergunta
                </Button>
              </div>
              <small style={{ color: "var(--muted)" }}>
                Dica: crie primeiro a pergunta de CPF (field_name = cpf) marcada como obrigatória.
              </small>
            </div>

            <div>
              <h4>Perguntas</h4>
              {questions.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>Nenhuma pergunta ainda.</p>
              ) : (
                <Table
                  columns={[
                    { key: "order", label: "Ordem" },
                    { key: "label", label: "Label" },
                    { key: "field_name", label: "field_name" },
                    { key: "type", label: "Tipo" },
                    { key: "required", label: "Obrigatório", render: (row) => <StatusBadge status={row.required ? "ACTIVE" : "INACTIVE"} /> },
                    {
                      key: "actions",
                      label: "Ações",
                      render: (row) => (
                        <div style={{ display: "flex", gap: "0.35rem" }}>
                          <Button variant="ghost" onClick={() => setSelectedQuestion(row)}>
                            Gerenciar
                          </Button>
                          <Button variant="ghost" onClick={() => deleteQuestion(row)}>
                            Remover
                          </Button>
                        </div>
                      ),
                    },
                  ]}
                  data={questions}
                />
              )}
            </div>

            {selectedQuestion && (
              <div className="card" style={{ background: "#0f1724" }}>
                <h4>Editar pergunta</h4>
                <div className="grid form-grid">
                  <input
                    value={selectedQuestion.label}
                    onChange={(e) => setSelectedQuestion((q) => (q ? { ...q, label: e.target.value } : q))}
                    placeholder="Label"
                  />
                  <input
                    type="number"
                    value={selectedQuestion.order}
                    onChange={(e) => setSelectedQuestion((q) => (q ? { ...q, order: Number(e.target.value) } : q))}
                    placeholder="Ordem"
                  />
                  <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedQuestion.required}
                      onChange={(e) => setSelectedQuestion((q) => (q ? { ...q, required: e.target.checked } : q))}
                    />
                    Obrigatório
                  </label>
                  <Button
                    onClick={() =>
                      updateQuestion({
                        label: selectedQuestion.label,
                        order: selectedQuestion.order,
                        required: selectedQuestion.required,
                      })
                    }
                  >
                    Salvar alterações
                  </Button>
                </div>
                {(selectedQuestion.type === "MULTIPLE_CHOICE" ||
                  selectedQuestion.type === "CHECKBOXES" ||
                  selectedQuestion.type === "DROPDOWN") && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <h5>Opções</h5>
                    <div className="grid form-grid">
                      <input placeholder="Label" value={optionLabel} onChange={(e) => setOptionLabel(e.target.value)} />
                      <input placeholder="Valor" value={optionValue} onChange={(e) => setOptionValue(e.target.value)} />
                      <Button onClick={addOption} disabled={!optionLabel || !optionValue}>
                        Adicionar opção
                      </Button>
                    </div>
                    <div className="grid" style={{ gap: "0.35rem", marginTop: "0.5rem" }}>
                      {selectedQuestion.options?.map((opt) => (
                        <div key={opt.id} className="card" style={{ background: "#111827", display: "flex", justifyContent: "space-between" }}>
                          <span>
                            {opt.label} ({opt.value})
                          </span>
                          <Button variant="ghost" onClick={() => deleteOption(opt.id)}>
                            Remover
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
      </div>
    </div>
  );
};
