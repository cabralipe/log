import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle, Filter } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/Button";
import { Table } from "../../components/Table";
import "../../styles/DataPage.css";
import "./Notifications.css";

type NotificationRow = {
  id: number;
  event_type: string;
  title: string;
  message: string;
  channel: "IN_APP" | "EMAIL" | "PUSH";
  is_read: boolean;
  created_at: string;
  metadata?: Record<string, any>;
};

const CHANNEL_LABEL: Record<NotificationRow["channel"], string> = {
  IN_APP: "In-app",
  EMAIL: "Email",
  PUSH: "Push",
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export const NotificationsPage = () => {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ unreadOnly: boolean; channel: string; event: string }>({
    unreadOnly: false,
    channel: "",
    event: "",
  });

  const load = () => {
    setLoading(true);
    api
      .get<NotificationRow[]>("/notifications/")
      .then((res) => {
        const data = res.data as any;
        setItems(Array.isArray(data) ? data : data.results || []);
        setError(null);
      })
      .catch((err) => setError(err.response?.data?.detail || "Erro ao carregar alertas."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filter.unreadOnly && item.is_read) return false;
      if (filter.channel && item.channel !== filter.channel) return false;
      if (filter.event && item.event_type !== filter.event) return false;
      return true;
    });
  }, [items, filter]);

  const eventTypes = useMemo(
    () => Array.from(new Set(items.map((item) => item.event_type))).sort(),
    [items]
  );

  const markRead = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/`, { is_read: true });
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao marcar como lido.");
    }
  };

  const unreadCount = items.filter((item) => !item.is_read).length;

  return (
    <div className="data-page notifications-page">
      <div className="data-header">
        <div>
          <h2 className="data-title">Alertas e Notificações</h2>
          <p className="data-subtitle">CNH, manutenção, geofencing e lembretes de viagens.</p>
        </div>
        <div className="notifications-kpi">
          <Bell size={18} />
          <span>{unreadCount} não lidas</span>
        </div>
      </div>

      {error && <div className="data-error">{error}</div>}

      <div className="notifications-toolbar card">
        <div className="toolbar-title">
          <Filter size={16} /> Filtros
        </div>
        <div className="toolbar-fields">
          <label className="toggle">
            <input
              type="checkbox"
              checked={filter.unreadOnly}
              onChange={(e) => setFilter((prev) => ({ ...prev, unreadOnly: e.target.checked }))}
            />
            <span>Somente não lidas</span>
          </label>
          <select
            value={filter.channel}
            onChange={(e) => setFilter((prev) => ({ ...prev, channel: e.target.value }))}
          >
            <option value="">Todos canais</option>
            <option value="PUSH">Push</option>
            <option value="EMAIL">Email</option>
            <option value="IN_APP">In-app</option>
          </select>
          <select
            value={filter.event}
            onChange={(e) => setFilter((prev) => ({ ...prev, event: e.target.value }))}
          >
            <option value="">Todos tipos</option>
            {eventTypes.map((event) => (
              <option key={event} value={event}>
                {event}
              </option>
            ))}
          </select>
          <Button variant="ghost" onClick={load} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="notifications-empty card">
          <CheckCircle size={22} />
          <div>
            <strong>Nenhum alerta encontrado</strong>
            <p className="muted">Sem notificações para os filtros atuais.</p>
          </div>
        </div>
      ) : (
        <Table
          columns={[
            { key: "created_at", label: "Data", render: (row) => formatDateTime(row.created_at) },
            { key: "title", label: "Título" },
            { key: "message", label: "Mensagem", render: (row) => <span className="message">{row.message}</span> },
            { key: "event_type", label: "Tipo" },
            { key: "channel", label: "Canal", render: (row) => CHANNEL_LABEL[row.channel] },
            {
              key: "is_read",
              label: "Status",
              render: (row) => (
                <span className={`status-pill ${row.is_read ? "read" : "unread"}`}>
                  {row.is_read ? "Lido" : "Novo"}
                </span>
              ),
            },
            {
              key: "actions",
              label: "Ações",
              render: (row) => (
                <Button variant="ghost" size="sm" onClick={() => markRead(row.id)} disabled={row.is_read}>
                  Marcar lido
                </Button>
              ),
            },
          ]}
          data={filtered}
        />
      )}
    </div>
  );
};
