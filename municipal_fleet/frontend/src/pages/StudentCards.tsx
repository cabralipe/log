import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";

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
  | { valid: true; card: { card_number: string; status: string; expiration_date: string }; student: { full_name: string; school?: string }; reason: null }
  | { valid: false; reason: string };

export const StudentCardsPage = () => {
  const [payload, setPayload] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const loadCards = () => {
    api
      .get<Card[]>("/students/student-cards/")
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : (res.data as any).results ?? [];
        setCards(data);
        setListError(null);
      })
      .catch((err) => setListError(err.response?.data?.detail || "Sem permissão para listar carteirinhas."));
  };

  useEffect(() => {
    loadCards();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="grid" style={{ gridTemplateColumns: "1.1fr 1.9fr" }}>
      <div className="card">
        <h2>Validação de QR</h2>
        <p style={{ color: "var(--muted)" }}>Cole o payload lido do QR code para confirmar autenticidade.</p>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
          <input placeholder="STDCARD:..." value={payload} onChange={(e) => setPayload(e.target.value)} style={{ flex: 1 }} />
          <Button onClick={validate} disabled={!payload}>
            Validar
          </Button>
        </div>
        {error && <p style={{ color: "#f87171", marginTop: "0.5rem" }}>{error}</p>}
        {validation && (
          <div className="card" style={{ marginTop: "0.75rem", background: validation.valid ? "#0f1724" : "#1f2937" }}>
            {validation.valid ? (
              <>
                <div style={{ color: "#34d399", fontWeight: 700 }}>Carteirinha Válida</div>
                <div>Número: {validation.card.card_number}</div>
                <div>Status: {validation.card.status}</div>
                <div>Validade: {validation.card.expiration_date}</div>
                <div>Aluno: {validation.student.full_name}</div>
                {validation.student.school && <div>Escola: {validation.student.school}</div>}
              </>
            ) : (
              <div style={{ color: "#f87171", fontWeight: 700 }}>Inválida: {validation.reason}</div>
            )}
          </div>
        )}
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Carteirinhas emitidas</h2>
          <Button variant="ghost" onClick={loadCards}>
            Recarregar
          </Button>
        </div>
        {listError && <div className="card" style={{ color: "#f87171" }}>{listError}</div>}
        {!listError && (
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
      </div>
    </div>
  );
};
