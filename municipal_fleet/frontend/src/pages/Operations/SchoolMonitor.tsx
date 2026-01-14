import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Button } from "../../components/Button";
import "../../styles/DataPage.css";
import "./SchoolMonitor.css";

type Stop = {
  id: number;
  order: number;
  destination_id: number;
  destination_name?: string | null;
  address?: string | null;
};

type StudentEntry = {
  id: number;
  student_id: number;
  student_name: string;
  school_name?: string | null;
  class_group_name?: string | null;
  has_special_needs: boolean;
  special_needs_details?: string | null;
};

type Execution = {
  id: number;
  status: string;
  scheduled_departure: string;
  scheduled_return: string;
  vehicle_plate?: string | null;
  driver_name?: string | null;
  itinerary_link: string;
  stops: Stop[];
  students_count: number;
  special_needs_count: number;
  students: StudentEntry[];
};

type MonitorPayload = {
  date?: string | null;
  executions: Execution[];
};

export const SchoolMonitorPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [payload, setPayload] = useState<MonitorPayload>({ executions: [] });
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = async (targetDate = date) => {
    setLoading(true);
    try {
      const res = await api.get<MonitorPayload>("/trips/school-monitor/", { params: { date: targetDate } });
      setPayload(res.data);
      setError(null);
    } catch (err) {
      setError("Erro ao carregar monitor escolar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = (id: number) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  return (
    <div className="data-page">
      <div className="data-header">
        <div>
          <h1 className="data-title">Monitor Escolar</h1>
          <p className="data-subtitle">Itinerarios e lista de alunos por veiculo.</p>
        </div>
        <div className="data-actions" style={{ gap: "0.5rem" }}>
          <input
            type="date"
            className="data-search"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Button onClick={() => load(date)}>Atualizar</Button>
        </div>
      </div>

      {error && <div className="data-error">{error}</div>}

      {loading ? (
        <div className="data-loading">Carregando...</div>
      ) : payload.executions.length === 0 ? (
        <div className="data-empty">Nenhuma viagem escolar encontrada para a data.</div>
      ) : (
        <div className="school-monitor-grid">
          {payload.executions.map((execution) => {
            const isOpen = expanded.has(execution.id);
            return (
              <div key={execution.id} className="school-monitor-card">
                <div className="school-monitor-header">
                  <div>
                    <div className="school-monitor-title">
                      {execution.vehicle_plate || "Veiculo"} • {execution.driver_name || "Motorista"}
                    </div>
                    <div className="school-monitor-subtitle">
                      Saida {new Date(execution.scheduled_departure).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {" "}• Retorno {new Date(execution.scheduled_return).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="school-monitor-metrics">
                    <span>{execution.students_count} alunos</span>
                    <span>{execution.special_needs_count} especiais</span>
                  </div>
                </div>

                <div className="school-monitor-stops">
                  {execution.stops.map((stop) => (
                    <div key={stop.id} className="school-monitor-stop">
                      <span className="stop-order">{stop.order}</span>
                      <div>
                        <div className="stop-title">{stop.destination_name || "Destino"}</div>
                        {stop.address && <div className="stop-subtitle">{stop.address}</div>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="school-monitor-actions">
                  <a href={execution.itinerary_link} className="school-monitor-link" target="_blank" rel="noreferrer">
                    Abrir itinerario
                  </a>
                  <Button variant="ghost" size="sm" onClick={() => toggleExpand(execution.id)}>
                    {isOpen ? "Ocultar alunos" : "Ver alunos"}
                  </Button>
                </div>

                {isOpen && (
                  <div className="school-monitor-students">
                    {execution.students.map((student) => (
                      <div key={student.id} className="student-row">
                        <div>
                          <div className="student-name">{student.student_name}</div>
                          <div className="student-meta">
                            {student.school_name || "Escola"} • {student.class_group_name || "Turma"}
                          </div>
                        </div>
                        <div className={`student-badge ${student.has_special_needs ? "warn" : "ok"}`}>
                          {student.has_special_needs ? "Necessidade" : "Regular"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
