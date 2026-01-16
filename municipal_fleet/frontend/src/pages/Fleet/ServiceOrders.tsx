import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Paginated } from "../../lib/api";
import { Table } from "../../components/Table";
import { Button } from "../../components/Button";
import { StatusBadge } from "../../components/StatusBadge";
import { Pagination } from "../../components/Pagination";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import "../../styles/DataPage.css";

type ServiceOrder = {
    id: number;
    external_id: string;
    service_type: string;
    vehicle: number;
    vehicle_plate?: string;
    driver: number;
    driver_name?: string;
    planned_start?: string;
    planned_end?: string;
    executed_start?: string;
    executed_end?: string;
    status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    raw_payload?: any;
    created_at: string;
};

type Vehicle = { id: number; license_plate: string; model: string };
type Driver = { id: number; name: string };

export const ServiceOrdersPage = () => {
    const navigate = useNavigate();
    const { isMobile } = useMediaQuery();
    const [orders, setOrders] = useState<ServiceOrder[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<Partial<ServiceOrder>>({
        status: "PLANNED",
    });

    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);

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
        api.get("/drivers/", { params: { page_size: 1000 } }).then(res => {
            const data = res.data as any;
            setDrivers(Array.isArray(data) ? data : data.results);
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (form.id) {
                await api.patch(`/service-orders/${form.id}/`, form);
            } else {
                await api.post("/service-orders/", form);
            }
            setIsModalOpen(false);
            loadOrders();
        } catch (err) {
            alert("Erro ao salvar Ordem de Serviço.");
        }
    };

    const openModal = (order?: ServiceOrder) => {
        if (order) setForm(order);
        else setForm({ status: "PLANNED" });
        setIsModalOpen(true);
    };

    const statusLabels: Record<string, string> = {
        PLANNED: "Planejada",
        IN_PROGRESS: "Em andamento",
        COMPLETED: "Concluída",
        CANCELLED: "Cancelada",
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
                    placeholder="Buscar por ID Externo ou Placa"
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
                            { label: "ID Externo", key: "external_id" },
                            { label: "Tipo", key: "service_type" },
                            { label: "Veículo", key: "vehicle_plate", render: (d) => d.vehicle_plate || "—" },
                            { label: "Motorista", key: "driver_name", render: (d) => d.driver_name || "—" },
                            { label: "Início Planejado", key: "planned_start", render: (d) => d.planned_start ? new Date(d.planned_start).toLocaleString("pt-BR") : "—" },
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
                            ID Externo *
                            <input required value={form.external_id || ""} onChange={e => setForm({ ...form, external_id: e.target.value })} />
                        </label>
                        <label>
                            Tipo de Serviço
                            <input value={form.service_type || ""} onChange={e => setForm({ ...form, service_type: e.target.value })} />
                        </label>

                        <label>
                            Veículo *
                            <SearchableSelect
                                required
                                value={form.vehicle}
                                onChange={(val) => setForm({ ...form, vehicle: Number(val) })}
                                options={vehicles.map(v => ({ value: v.id, label: `${v.model} - ${v.license_plate}` }))}
                                placeholder="Selecione o veículo"
                            />
                        </label>
                        <label>
                            Motorista *
                            <SearchableSelect
                                required
                                value={form.driver}
                                onChange={(val) => setForm({ ...form, driver: Number(val) })}
                                options={drivers.map(d => ({ value: d.id, label: d.name }))}
                                placeholder="Selecione o motorista"
                            />
                        </label>

                        <label>
                            Início Planejado
                            <input type="datetime-local" value={form.planned_start ? form.planned_start.slice(0, 16) : ""} onChange={e => setForm({ ...form, planned_start: e.target.value })} />
                        </label>
                        <label>
                            Fim Planejado
                            <input type="datetime-local" value={form.planned_end ? form.planned_end.slice(0, 16) : ""} onChange={e => setForm({ ...form, planned_end: e.target.value })} />
                        </label>

                        <label className="full-width">
                            Status
                            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })}>
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
