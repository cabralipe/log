import { useEffect, useMemo, useState } from "react";
import { api, API_ROOT } from "../lib/api";
import { Button } from "../components/Button";
import { Table } from "../components/Table";
import { StatusBadge } from "../components/StatusBadge";

type FormTemplate = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  require_cpf: boolean;
  form_type: string;
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

export const FormTemplatesPage = () => {
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
  });
  const [newQuestion, setNewQuestion] = useState<Partial<FormQuestion>>({
    order: 1,
    type: "SHORT_TEXT",
    required: true,
  });

  const publicLink = useMemo(() => {
    if (!selected) return "";
    return `${API_ROOT}/public/forms/${selected.slug}`;
  }, [selected]);

  const loadTemplates = () => {
    api
      .get<FormTemplate[]>("/forms/templates/")
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : (res.data as any).results ?? [];
        setTemplates(data);
        setError(null);
      })
      .catch((err) => setError(err.response?.data?.detail || "Erro ao carregar formulários."));
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

  const createTemplate = async () => {
    try {
      const { data } = await api.post<FormTemplate>("/forms/templates/", newTemplate);
      setNewTemplate({ name: "", description: "", slug: "", is_active: true, form_type: "STUDENT_CARD_APPLICATION" });
      loadTemplates();
      setSelected(data);
      loadQuestions(data.id);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao criar formulário.");
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
      setQuestionError(err.response?.data?.detail || "Erro ao criar pergunta (campo CPF é obrigatório e deve ser required).");
    }
  };

  const updateQuestion = async (updates: Partial<FormQuestion>) => {
    if (!selectedQuestion) return;
    try {
      await api.patch(`/forms/questions/${selectedQuestion.id}/`, updates);
      loadQuestions(selectedQuestion.form_template);
    } catch (err: any) {
      setQuestionError(err.response?.data?.detail || "Erro ao atualizar pergunta.");
    }
  };

  const deleteQuestion = async (question: FormQuestion) => {
    if (!selected || !confirm("Remover esta pergunta?")) return;
    try {
      await api.delete(`/forms/questions/${question.id}/`);
      loadQuestions(selected.id);
      setSelectedQuestion(null);
    } catch (err: any) {
      setQuestionError(err.response?.data?.detail || "Não foi possível remover (CPF obrigatório não pode ser removido).");
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
      setQuestionError(err.response?.data?.detail || "Erro ao adicionar opção.");
    }
  };

  const deleteOption = async (optionId: number) => {
    if (!confirm("Remover esta opção?")) return;
    await api.delete(`/forms/options/${optionId}/`);
    if (selectedQuestion) loadQuestions(selectedQuestion.form_template);
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "1.2fr 1.8fr" }}>
      <div className="card">
        <h2>Novo formulário</h2>
        {error && <p style={{ color: "#f87171" }}>{error}</p>}
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
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input type="radio" checked readOnly />
            Tipo: Carteirinha Estudantil (CPF obrigatório)
          </label>
          <Button onClick={createTemplate} disabled={!newTemplate.name}>
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
      </div>
      <div className="card">
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
                <div style={{ textAlign: "right" }}>
                  <small style={{ color: "var(--muted)" }}>Link público</small>
                  <div style={{ fontSize: "0.9rem" }}>{publicLink}</div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(publicLink);
                    }}
                  >
                    Copiar link
                  </Button>
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
  );
};
