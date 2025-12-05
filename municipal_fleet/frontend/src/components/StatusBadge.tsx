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
};

export const StatusBadge = ({ status }: { status: string }) => {
  const variant = palette[status] ?? "muted";
  return <span className={`status ${variant}`}>{status}</span>;
};
