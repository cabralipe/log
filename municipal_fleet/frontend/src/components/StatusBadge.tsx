import "./StatusBadge.css";

const palette: Record<string, string> = {
  AVAILABLE: "ok",
  ACTIVE: "ok",
  IN_USE: "warn",
  MAINTENANCE: "warn",
  INACTIVE: "muted",
  PLANNED: "muted",
  IN_PROGRESS: "warn",
  COMPLETED: "ok",
  CANCELLED: "danger",
  EXPIRED: "danger",
  OPEN: "warn",
  CLOSED: "ok",
  INVOICED: "ok",
};

const STATUS_TRANSLATIONS: Record<string, string> = {
  AVAILABLE: "Disponível",
  ACTIVE: "Ativo",
  IN_USE: "Em uso",
  MAINTENANCE: "Manutenção",
  INACTIVE: "Inativo",
  PLANNED: "Planejado",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
  OPEN: "Aberto",
  CLOSED: "Fechado",
  INVOICED: "Faturado",
  WAITING_PARTS: "Aguardando peças",
  CORRECTIVE: "Corretiva",
  PREVENTIVE: "Preventiva",
  TIRE: "Pneus",
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  CONFIRMED: "Confirmado",
  SCHEDULED: "Agendado",
  DONE: "Realizado",
  SKIPPED: "Pulado",
  MISSED: "Perdido",
};

export const StatusBadge = ({ status }: { status: string }) => {
  const variant = palette[status] ?? "muted";
  const label = STATUS_TRANSLATIONS[status] ?? status;
  return <span className={`status ${variant}`}>{label}</span>;
};
