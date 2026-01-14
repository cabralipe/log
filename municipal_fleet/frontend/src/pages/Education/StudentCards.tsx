import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Table } from "../../components/Table";
import { Button } from "../../components/Button";
import { StatusBadge } from "../../components/StatusBadge";
import { HelpBalloon } from "../../components/HelpBalloon";
import { QrCode, CreditCard, CheckCircle, XCircle, Search } from "lucide-react";
import "./StudentCards.css";

type Card = {
  id: number;
  card_number: string;
  status: string;
  issue_date: string;
  expiration_date: string;
  student: number;
  student_name?: string;
};

type ValidationResult =
  | { valid: true; card: { card_number: string; status: string; expiration_date: string }; student: { full_name: string; school?: string; shift?: string | string[]; course?: string | string[] }; reason: null }
  | { valid: false; reason: string };

export const StudentCardsPage = () => {
  const [activeStep, setActiveStep] = useState<"validate" | "manage">("validate");
  const [payload, setPayload] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const loadCards = () => {
    setLoading(true);
    api
      .get<Card[]>("/students/student-cards/")
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : (res.data as any).results ?? [];
        setCards(data);
        setListError(null);
      })
      .catch((err) => setListError(err.response?.data?.detail || "Sem permissão para listar carteirinhas."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (activeStep === "manage") {
      loadCards();
    }
  }, [activeStep]);

  const validate = async () => {
    setValidation(null);
    setError(null);
    if (!payload) return;
    try {
      const { data } = await api.get<ValidationResult>("/students/student-cards/validate/", { params: { payload } });
      setValidation(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Falha ao validar carteirinha.");
    }
  };

  return (
    <div className="student-cards-page">
      <div className="student-cards-wizard">
        <div className="wizard-steps">
          <button
            className={`wizard-step ${activeStep === "validate" ? "active" : ""}`}
            onClick={() => setActiveStep("validate")}
          >
            <div className="wizard-step__number">1</div>
            <div className="wizard-step__content">
              <strong>Validar Carteirinha</strong>
              <p>Verificar autenticidade via QR Code</p>
            </div>
          </button>
          <button
            className={`wizard-step ${activeStep === "manage" ? "active" : ""}`}
            onClick={() => setActiveStep("manage")}
          >
            <div className="wizard-step__number">2</div>
            <div className="wizard-step__content">
              <strong>Gerenciar Emissões</strong>
              <p>Listar e consultar carteirinhas</p>
            </div>
          </button>
        </div>

        <div className="wizard-panel">
          {activeStep === "validate" && (
            <div className="card">
              <div className="wizard-header">
                <div>
                  <h2>Validação de QR Code</h2>
                  <p className="muted">Confirme se a carteirinha apresentada é válida e está ativa.</p>
                </div>
                <HelpBalloon
                  title="Como validar?"
                  description="Utilize um leitor de QR Code para escanear o código na carteirinha do estudante. O código lido (payload) deve ser inserido no campo abaixo."
                />
              </div>

              <div className="validation-box">
                <QrCode size={48} className="muted" style={{ opacity: 0.5, marginBottom: "1rem" }} />
                <h3>Escaneie o código</h3>
                <p className="muted">Cole o conteúdo do QR Code abaixo para verificar instantaneamente.</p>

                <div className="validation-input-group">
                  <div style={{ position: "relative", flex: 1 }}>
                    <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                    <input
                      placeholder="Cole o código aqui (ex: STDCARD:...)"
                      value={payload}
                      onChange={(e) => setPayload(e.target.value)}
                      style={{ width: "100%", paddingLeft: "36px" }}
                    />
                  </div>
                  <Button onClick={validate} disabled={!payload}>
                    Verificar
                  </Button>
                </div>
                {error && <p style={{ color: "var(--danger)", marginTop: "0.5rem" }}>{error}</p>}
              </div>

              {validation && (
                <div className={`validation-result ${validation.valid ? "valid" : "invalid"}`}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                    {validation.valid ? (
                      <CheckCircle size={24} color="var(--success)" />
                    ) : (
                      <XCircle size={24} color="var(--danger)" />
                    )}
                    <h3 style={{ margin: 0, color: validation.valid ? "var(--success)" : "var(--danger)" }}>
                      {validation.valid ? "Carteirinha Válida" : "Carteirinha Inválida"}
                    </h3>
                  </div>

                  {validation.valid ? (
                    <div className="validation-details">
                      <div className="validation-detail-item">
                        <label>Aluno</label>
                        <strong>{validation.student.full_name}</strong>
                      </div>
                      <div className="validation-detail-item">
                        <label>Número</label>
                        <strong>{validation.card.card_number}</strong>
                      </div>
                      <div className="validation-detail-item">
                        <label>Status</label>
                        <StatusBadge status={validation.card.status} />
                      </div>
                      <div className="validation-detail-item">
                        <label>Validade</label>
                        <strong>{validation.card.expiration_date}</strong>
                      </div>
                      {validation.student.school && (
                        <div className="validation-detail-item" style={{ gridColumn: "1 / -1" }}>
                          <label>Unidade Acadêmica</label>
                          <strong>{validation.student.school}</strong>
                        </div>
                      )}
                      {validation.student.shift && (
                        <div className="validation-detail-item" style={{ gridColumn: "1 / -1" }}>
                          <label>Turno(s)</label>
                          <strong>{Array.isArray(validation.student.shift) ? validation.student.shift.join(", ") : validation.student.shift}</strong>
                        </div>
                      )}
                      {validation.student.course && (
                        <div className="validation-detail-item" style={{ gridColumn: "1 / -1" }}>
                          <label>Curso(s)</label>
                          <strong>{Array.isArray(validation.student.course) ? validation.student.course.join(", ") : validation.student.course}</strong>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p>{validation.reason}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeStep === "manage" && (
            <div className="card">
              <div className="wizard-header">
                <div>
                  <h2>Carteirinhas Emitidas</h2>
                  <p className="muted">Histórico de todas as carteirinhas geradas pelo sistema.</p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <HelpBalloon
                    title="Status das Carteirinhas"
                    description="ATIVO: Válida para uso. EXPIRADO: Data de validade vencida. CANCELADO: Revogada manualmente."
                  />
                  <Button variant="ghost" onClick={loadCards} disabled={loading}>
                    {loading ? "Atualizando..." : "Atualizar Lista"}
                  </Button>
                </div>
              </div>

              {listError && <div className="alert error">{listError}</div>}

              {!listError && (
                <>
                  {cards.length === 0 && !loading ? (
                    <div className="empty-state">
                      <CreditCard size={48} style={{ opacity: 0.3, marginBottom: "1rem" }} />
                      <p>Nenhuma carteirinha emitida encontrada.</p>
                    </div>
                  ) : (
                    <Table
                      columns={[
                        { key: "card_number", label: "Número" },
                        { key: "student_name", label: "Aluno" },
                        { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
                        { key: "issue_date", label: "Emissão" },
                        { key: "expiration_date", label: "Validade" },
                      ]}
                      data={cards}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
