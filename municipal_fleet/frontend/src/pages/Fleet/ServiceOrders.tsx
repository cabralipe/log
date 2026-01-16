import { useEffect, useState } from "react";
import { api, type Paginated } from "../../lib/api";
import { Table } from "../../components/Table";
import { Button } from "../../components/Button";
import { StatusBadge } from "../../components/StatusBadge";
import { Pagination } from "../../components/Pagination";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import "../../styles/DataPage.css";

type ServiceOrderStatus = "OPEN" | "IN_PROGRESS" | "WAITING_PARTS" | "COMPLETED" | "CANCELLED";
type ServiceOrderType = "CORRECTIVE" | "PREVENTIVE" | "TIRE";
type ServiceOrderPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type ServiceOrder = {
    id: number;
    vehicle: number;
    vehicle_license_plate?: string;
    type: ServiceOrderType;
    priority: ServiceOrderPriority;
    status: ServiceOrderStatus;
    description: string;
    provider_name?: string;
    opened_at: string;
    completed_at?: string;
    total_cost?: string | number;
};

type Vehicle = { id: number; license_plate: string; model: string; brand?: string };

export const ServiceOrdersPage = () => {
    const [orders, setOrders] = useState<ServiceOrder[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<Partial<ServiceOrder>>({
        status: "OPEN",
        type: "CORRECTIVE",
        priority: "MEDIUM",
    });

    const [vehicles, setVehicles] = useState<Vehicle[]>([]);

    const loadOrders = (p = page, s = search) => {
        setLoading(true);
        api.get<Paginated<ServiceOrder>>("/service-orders/", { params: { page: p, search: s } })
            .then(res => {
                const data = res.data as any;
                setOrders(Array.isArray(data) ? data : data.results);
                setTotal(Array.isArray(data) ? data.length : data.count);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadOrders();
        // Load dependencies
        api.get("/vehicles/", { params: { page_size: 1000 } }).then(res => {
            const data = res.data as any;
            setVehicles(Array.isArray(data) ? data : data.results);
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                vehicle: form.vehicle ? Number(form.vehicle) : undefined,
                type: form.type,
                priority: form.priority,
                status: form.status,
                description: form.description?.trim(),
                provider_name: form.provider_name?.trim() || undefined,
            };
            if (form.id) {
                await api.patch(`/service-orders/${form.id}/`, payload);
            } else {
                await api.post("/service-orders/", payload);
            }
            setIsModalOpen(false);
            loadOrders();
        } catch (err) {
            alert("Erro ao salvar Ordem de Serviço.");
        }
    };

    const openModal = (order?: ServiceOrder) => {
        if (order) setForm(order);
        else setForm({ status: "OPEN", type: "CORRECTIVE", priority: "MEDIUM" });
        setIsModalOpen(true);
    };

    const statusLabels: Record<ServiceOrderStatus, string> = {
        OPEN: "Aberta",
        IN_PROGRESS: "Em andamento",
        WAITING_PARTS: "Aguardando peças",
        COMPLETED: "Concluída",
        CANCELLED: "Cancelada",
    };

    const typeLabels: Record<ServiceOrderType, string> = {
        CORRECTIVE: "Corretiva",
        PREVENTIVE: "Preventiva",
        TIRE: "Pneus",
    };

    const priorityLabels: Record<ServiceOrderPriority, string> = {
        LOW: "Baixa",
        MEDIUM: "Média",
        HIGH: "Alta",
        CRITICAL: "Crítica",
    };

    return (
        <div className="data-page">
            <div className="data-header">
                <div>
                    <h1 className="data-title">Ordens de Serviço</h1>
                    <p className="data-subtitle">Integração com sistemas externos e gestão de demandas.</p>
                </div>
                <div className="data-actions-bar">
                    <Button onClick={() => openModal()}>+ Nova OS</Button>
                </div>
            </div>

            <div className="data-filters">
                <input
                    type="text"
                    placeholder="Buscar por descrição, placa ou prestador"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                        loadOrders(1, e.target.value);
                    }}
                    className="data-search"
                />
            </div>

            {loading ? <div className="data-loading">Carregando...</div> : (
                <>
                    <Table
                        columns={[
                            { label: "ID", key: "id" },
                            { label: "Veículo", key: "vehicle_license_plate", render: (d) => d.vehicle_license_plate || "—" },
                            { label: "Tipo", key: "type", render: (d) => <StatusBadge status={d.type} /> },
                            { label: "Prioridade", key: "priority", render: (d) => <StatusBadge status={d.priority} /> },
                            { label: "Aberta em", key: "opened_at", render: (d) => d.opened_at ? new Date(d.opened_at).toLocaleString("pt-BR") : "—" },
                            { label: "Status", key: "status", render: (d) => <StatusBadge status={d.status} /> },
                            {
                                label: "Ações",
                                key: "actions",
                                render: (d) => (
                                    <Button variant="ghost" size="sm" onClick={() => openModal(d)}>Editar</Button>
                                )
                            }
                        ]}
                        data={orders}
                    />
                    <Pagination
                        page={page}
                        pageSize={10}
                        total={total}
                        onChange={(p) => { setPage(p); loadOrders(p); }}
                    />
                </>
            )}

            <Modal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={form.id ? "Editar OS" : "Nova Ordem de Serviço"}
            >
                <form onSubmit={handleSave} className="data-form">
                    <div className="data-form-grid">
                        <label>
                            Veículo *
                            <SearchableSelect
                                required
                                value={form.vehicle}
                                onChange={(val) => setForm({ ...form, vehicle: Number(val) })}
                                options={vehicles.map(v => ({
                                    value: v.id,
                                    label: `${v.license_plate} - ${(v.brand || "").trim()} ${(v.model || "").trim()}`.trim()
                                }))}
                                placeholder="Selecione o veículo"
                            />
                        </label>
                        <label>
                            Tipo *
                            <select
                                required
                                value={form.type}
                                onChange={e => setForm({ ...form, type: e.target.value as ServiceOrderType })}
                            >
                                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </label>
                        <label>
                            Prioridade *
                            <select
                                required
                                value={form.priority}
                                onChange={e => setForm({ ...form, priority: e.target.value as ServiceOrderPriority })}
                            >
                                {Object.entries(priorityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </label>
                        <label className="full-width">
                            Descrição *
                            <textarea
                                required
                                value={form.description || ""}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                            />
                        </label>
                        <label>
                            Prestador (opcional)
                            <input value={form.provider_name || ""} onChange={e => setForm({ ...form, provider_name: e.target.value })} />
                        </label>
                        <label>
                            Status
                            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ServiceOrderStatus })}>
                                {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </label>
                    </div>
                    <div className="data-form-actions">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Salvar</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
