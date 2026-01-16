import { useEffect, useState } from "react";
import { api, type Paginated } from "../../lib/api";
import { Table } from "../../components/Table";
import { Button } from "../../components/Button";
import { StatusBadge } from "../../components/StatusBadge";
import { Pagination } from "../../components/Pagination";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import "../../styles/DataPage.css";
import "./FuelStations.css"; // Reusing styles

// --- Types ---
type FuelLog = {
    id: number;
    vehicle: number;
    vehicle_plate?: string;
    driver: number;
    driver_name?: string;
    filled_at: string;
    liters: string;
    price_per_liter: string;
    total_cost: string;
    fuel_station: string;
    product: number;
    product_name?: string;
    ticket_number?: string;
    ticket_value?: string;
    notes?: string;
};

type FuelProduct = {
    id: number;
    name: string;
    unit: "LITER" | "UNIT";
    active: boolean;
};

type FuelRule = {
    id: number;
    scope: "MUNICIPALITY" | "VEHICLE" | "CONTRACT";
    vehicle?: number;
    vehicle_plate?: string;
    contract?: number;
    allowed_weekdays: number[]; // 0=Mon, 6=Sun
    allowed_start_time?: string;
    allowed_end_time?: string;
    active: boolean;
};

type FuelLimit = {
    id: number;
    fuel_station: number;
    fuel_station_name?: string;
    product: number;
    product_name?: string;
    period: "DAILY" | "WEEKLY" | "MONTHLY";
    max_quantity: string;
};

type FuelInvoice = {
    id: number;
    fuel_station: number;
    fuel_station_name?: string;
    period_start: string;
    period_end: string;
    total_value: string;
    uploaded_file?: string;
};

type FuelAlert = {
    id: number;
    alert_type: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    message: string;
    created_at: string;
    resolved_at?: string;
};

// --- Main Component ---
export const FuelManagementPage = () => {
    const { isMobile } = useMediaQuery();
    const [activeTab, setActiveTab] = useState<"LOGS" | "PRODUCTS" | "RULES" | "LIMITS" | "INVOICES" | "ALERTS">("LOGS");

    // Shared Data
    const [vehicles, setVehicles] = useState<{ id: number, license_plate: string, model: string }[]>([]);
    const [drivers, setDrivers] = useState<{ id: number, name: string }[]>([]);
    const [stations, setStations] = useState<{ id: number, name: string }[]>([]);
    const [products, setProducts] = useState<FuelProduct[]>([]);

    useEffect(() => {
        // Load common resources
        api.get("/vehicles/", { params: { page_size: 1000 } }).then(res => setVehicles((res.data as any).results || res.data));
        api.get("/drivers/", { params: { page_size: 1000 } }).then(res => setDrivers((res.data as any).results || res.data));
        api.get("/vehicles/fuel_stations/", { params: { page_size: 1000 } }).then(res => setStations((res.data as any).results || res.data));
        api.get("/vehicles/fuel_products/", { params: { page_size: 1000 } }).then(res => setProducts((res.data as any).results || res.data));
    }, []);

    return (
        <div className="data-page">
            <div className="data-header">
                <div>
                    <h1 className="data-title">Gestão de Combustível</h1>
                    <p className="data-subtitle">Controle de abastecimentos, regras e faturas.</p>
                </div>
                <div className="trips-tabs">
                    {["LOGS", "PRODUCTS", "RULES", "LIMITS", "INVOICES", "ALERTS"].map(tab => (
                        <button
                            key={tab}
                            className={activeTab === tab ? "active" : ""}
                            onClick={() => setActiveTab(tab as any)}
                        >
                            {tab === "LOGS" && "Abastecimentos"}
                            {tab === "PRODUCTS" && "Produtos"}
                            {tab === "RULES" && "Regras"}
                            {tab === "LIMITS" && "Cotas"}
                            {tab === "INVOICES" && "Faturas"}
                            {tab === "ALERTS" && "Alertas"}
                        </button>
                    ))}
                </div>
            </div>

            <div className="fuel-content">
                {activeTab === "LOGS" && <FuelLogsTab vehicles={vehicles} drivers={drivers} stations={stations} products={products} />}
                {activeTab === "PRODUCTS" && <FuelProductsTab />}
                {activeTab === "RULES" && <FuelRulesTab vehicles={vehicles} />}
                {activeTab === "LIMITS" && <FuelLimitsTab stations={stations} products={products} />}
                {activeTab === "INVOICES" && <FuelInvoicesTab stations={stations} />}
                {activeTab === "ALERTS" && <FuelAlertsTab />}
            </div>
        </div>
    );
};

// --- Sub-Components ---

const FuelLogsTab = ({ vehicles, drivers, stations, products }: any) => {
    const [data, setData] = useState<FuelLog[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<Partial<FuelLog>>({});

    const load = (p = page) => {
        api.get<Paginated<FuelLog>>("/vehicles/fuel_logs/", { params: { page: p } }).then(res => {
            const d = res.data as any;
            setData(Array.isArray(d) ? d : d.results);
            setTotal(Array.isArray(d) ? d.length : d.count);
        });
    };
    useEffect(() => { load(); }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (form.id) await api.patch(`/vehicles/fuel_logs/${form.id}/`, form);
            else await api.post("/vehicles/fuel_logs/", form);
            setIsModalOpen(false);
            load();
        } catch (err: any) {
            console.error(err);
            if (err.response?.data) {
                const data = err.response.data;
                const messages = Object.values(data).flat().join("\n");
                alert(`Erro ao salvar:\n${messages}`);
            } else {
                alert("Erro ao salvar.");
            }
        }
    };

    return (
        <>
            <div className="data-actions-bar" style={{ justifyContent: "flex-end", marginBottom: 16 }}>
                <Button onClick={() => { setForm({}); setIsModalOpen(true); }}>+ Registrar Abastecimento</Button>
            </div>
            <Table
                columns={[
                    { label: "Data", key: "filled_at", render: (d) => new Date(d.filled_at).toLocaleDateString("pt-BR") },
                    { label: "Veículo", key: "vehicle_plate", render: (d) => vehicles.find((v: any) => String(v.id) === String(d.vehicle))?.license_plate || d.vehicle_plate || "—" },
                    { label: "Motorista", key: "driver_name", render: (d) => drivers.find((dr: any) => String(dr.id) === String(d.driver))?.name || d.driver_name || "—" },
                    { label: "Posto", key: "fuel_station", render: (d) => stations.find((s: any) => s.name === d.fuel_station || String(s.id) === String(d.fuel_station))?.name || d.fuel_station || "—" },
                    { label: "Produto", key: "product_name", render: (d) => products.find((p: any) => String(p.id) === String(d.product))?.name || d.product_name || "—" },
                    { label: "Litros", key: "liters" },
                    { label: "Total (R$)", key: "total_cost" },
                    { label: "Ações", key: "actions", render: (d) => <Button variant="ghost" size="sm" onClick={() => { setForm(d); setIsModalOpen(true); }}>Editar</Button> }
                ]}
                data={data}
            />
            <Pagination page={page} pageSize={10} total={total} onChange={(p) => { setPage(p); load(p); }} />

            <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Abastecimento">
                <form onSubmit={handleSave} className="data-form">
                    <div className="data-form-grid">
                        <label className="full-width">Data * <input type="date" required value={form.filled_at || ""} onChange={e => setForm({ ...form, filled_at: e.target.value })} /></label>
                        <label>
                            Veículo *
                            <SearchableSelect
                                required
                                value={form.vehicle}
                                onChange={(val) => setForm({ ...form, vehicle: Number(val) })}
                                options={vehicles.map((v: any) => ({ value: v.id, label: `${v.model} - ${v.license_plate}` }))}
                                placeholder="Selecione o veículo"
                            />
                        </label>
                        <label>
                            Motorista *
                            <SearchableSelect
                                required
                                value={form.driver}
                                onChange={(val) => setForm({ ...form, driver: Number(val) })}
                                options={drivers.map((d: any) => ({ value: d.id, label: d.name }))}
                                placeholder="Selecione o motorista"
                            />
                        </label>
                        <label className="full-width">Posto <select value={form.fuel_station || ""} onChange={e => setForm({ ...form, fuel_station: e.target.value })}><option value="">Selecione</option>{stations.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}</select></label>
                        <label>Produto <select value={form.product || ""} onChange={e => setForm({ ...form, product: Number(e.target.value) })}>{products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                        <label>Litros * <input type="number" step="0.01" required value={form.liters || ""} onChange={e => setForm({ ...form, liters: e.target.value })} /></label>
                        <label>Preço/L * <input type="number" step="0.01" required value={form.price_per_liter || ""} onChange={e => setForm({ ...form, price_per_liter: e.target.value })} /></label>
                    </div>
                    <div className="data-form-actions"><Button type="submit">Salvar</Button></div>
                </form>
            </Modal>
        </>
    );
};

const FuelProductsTab = () => {
    const [data, setData] = useState<FuelProduct[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<Partial<FuelProduct>>({ active: true, unit: "LITER" });

    const load = () => {
        api.get("/vehicles/fuel_products/").then(res => setData((res.data as any).results || res.data));
    };
    useEffect(() => { load(); }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (form.id) await api.patch(`/vehicles/fuel_products/${form.id}/`, form);
            else await api.post("/vehicles/fuel_products/", form);
            setIsModalOpen(false);
            load();
        } catch (err: any) {
            console.error(err);
            if (err.response?.data) {
                const data = err.response.data;
                const messages = Object.values(data).flat().join("\n");
                alert(`Erro ao salvar:\n${messages}`);
            } else {
                alert("Erro ao salvar.");
            }
        }
    };

    return (
        <>
            <div className="data-actions-bar" style={{ justifyContent: "flex-end", marginBottom: 16 }}>
                <Button onClick={() => { setForm({ active: true, unit: "LITER" }); setIsModalOpen(true); }}>+ Novo Produto</Button>
            </div>
            <Table
                columns={[
                    { label: "Nome", key: "name" },
                    { label: "Unidade", key: "unit" },
                    { label: "Status", key: "active", render: (d) => <StatusBadge status={d.active ? "ACTIVE" : "INACTIVE"} /> },
                    { label: "Ações", key: "actions", render: (d) => <Button variant="ghost" size="sm" onClick={() => { setForm(d); setIsModalOpen(true); }}>Editar</Button> }
                ]}
                data={data}
            />
            <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Produto">
                <form onSubmit={handleSave} className="data-form">
                    <div className="data-form-grid">
                        <label>Nome * <input required value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
                        <label>Unidade * <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value as any })}><option value="LITER">Litro</option><option value="UNIT">Unidade</option></select></label>
                        <label className="checkbox-label"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Ativo</label>
                    </div>
                    <div className="data-form-actions"><Button type="submit">Salvar</Button></div>
                </form>
            </Modal>
        </>
    );
};

const FuelRulesTab = ({ vehicles }: any) => {
    const [data, setData] = useState<FuelRule[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<Partial<FuelRule>>({ active: true, scope: "MUNICIPALITY", allowed_weekdays: [] });

    const load = () => {
        api.get("/vehicles/fuel_rules/").then(res => setData((res.data as any).results || res.data));
    };
    useEffect(() => { load(); }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (form.id) await api.patch(`/vehicles/fuel_rules/${form.id}/`, form);
            else await api.post("/vehicles/fuel_rules/", form);
            setIsModalOpen(false);
            load();
        } catch (err: any) {
            console.error(err);
            if (err.response?.data) {
                const data = err.response.data;
                const messages = Object.values(data).flat().join("\n");
                alert(`Erro ao salvar:\n${messages}`);
            } else {
                alert("Erro ao salvar.");
            }
        }
    };

    return (
        <>
            <div className="data-actions-bar" style={{ justifyContent: "flex-end", marginBottom: 16 }}>
                <Button onClick={() => { setForm({ active: true, scope: "MUNICIPALITY", allowed_weekdays: [] }); setIsModalOpen(true); }}>+ Nova Regra</Button>
            </div>
            <Table
                columns={[
                    { label: "Escopo", key: "scope" },
                    { label: "Veículo", key: "vehicle_plate", render: (d) => d.vehicle_plate || "Todos" },
                    { label: "Horário", key: "allowed_start_time", render: (d) => d.allowed_start_time ? `${d.allowed_start_time} - ${d.allowed_end_time}` : "Livre" },
                    { label: "Status", key: "active", render: (d) => <StatusBadge status={d.active ? "ACTIVE" : "INACTIVE"} /> },
                    { label: "Ações", key: "actions", render: (d) => <Button variant="ghost" size="sm" onClick={() => { setForm(d); setIsModalOpen(true); }}>Editar</Button> }
                ]}
                data={data}
            />
            <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Regra de Abastecimento">
                <form onSubmit={handleSave} className="data-form">
                    <div className="data-form-grid">
                        <label className="full-width">Escopo * <select value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value as any })}><option value="MUNICIPALITY">Geral (Município)</option><option value="VEHICLE">Veículo Específico</option></select></label>
                        {form.scope === "VEHICLE" && (
                            <label className="full-width">
                                Veículo *
                                <SearchableSelect
                                    value={form.vehicle}
                                    onChange={(val) => setForm({ ...form, vehicle: Number(val) })}
                                    options={vehicles.map((v: any) => ({ value: v.id, label: `${v.model} - ${v.license_plate}` }))}
                                    placeholder="Selecione o veículo"
                                />
                            </label>
                        )}
                        <label>Início Permitido <input type="time" value={form.allowed_start_time || ""} onChange={e => setForm({ ...form, allowed_start_time: e.target.value })} /></label>
                        <label>Fim Permitido <input type="time" value={form.allowed_end_time || ""} onChange={e => setForm({ ...form, allowed_end_time: e.target.value })} /></label>
                        <label className="checkbox-label full-width"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Ativo</label>
                    </div>
                    <div className="data-form-actions"><Button type="submit">Salvar</Button></div>
                </form>
            </Modal>
        </>
    );
};

const FuelLimitsTab = ({ stations, products }: any) => {
    const [data, setData] = useState<FuelLimit[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<Partial<FuelLimit>>({ period: "MONTHLY" });

    const load = () => {
        api.get("/vehicles/fuel_station_limits/").then(res => setData((res.data as any).results || res.data));
    };
    useEffect(() => { load(); }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (form.id) await api.patch(`/vehicles/fuel_station_limits/${form.id}/`, form);
            else await api.post("/vehicles/fuel_station_limits/", form);
            setIsModalOpen(false);
            load();
        } catch (err: any) {
            console.error(err);
            if (err.response?.data) {
                const data = err.response.data;
                const messages = Object.values(data).flat().join("\n");
                alert(`Erro ao salvar:\n${messages}`);
            } else {
                alert("Erro ao salvar.");
            }
        }
    };

    return (
        <>
            <div className="data-actions-bar" style={{ justifyContent: "flex-end", marginBottom: 16 }}>
                <Button onClick={() => { setForm({ period: "MONTHLY" }); setIsModalOpen(true); }}>+ Nova Cota</Button>
            </div>
            <Table
                columns={[
                    { label: "Posto", key: "fuel_station_name", render: (d) => d.fuel_station_name || d.fuel_station },
                    { label: "Produto", key: "product_name", render: (d) => d.product_name || d.product },
                    { label: "Período", key: "period" },
                    { label: "Limite", key: "max_quantity" },
                    { label: "Ações", key: "actions", render: (d) => <Button variant="ghost" size="sm" onClick={() => { setForm(d); setIsModalOpen(true); }}>Editar</Button> }
                ]}
                data={data}
            />
            <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Cota de Abastecimento">
                <form onSubmit={handleSave} className="data-form">
                    <div className="data-form-grid">
                        <label className="full-width">Posto * <select required value={form.fuel_station || ""} onChange={e => setForm({ ...form, fuel_station: Number(e.target.value) })}>{stations.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                        <label>Produto * <select required value={form.product || ""} onChange={e => setForm({ ...form, product: Number(e.target.value) })}>{products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                        <label>Período * <select value={form.period} onChange={e => setForm({ ...form, period: e.target.value as any })}><option value="DAILY">Diário</option><option value="WEEKLY">Semanal</option><option value="MONTHLY">Mensal</option></select></label>
                        <label className="full-width">Quantidade Máx. * <input type="number" step="0.01" required value={form.max_quantity || ""} onChange={e => setForm({ ...form, max_quantity: e.target.value })} /></label>
                    </div>
                    <div className="data-form-actions"><Button type="submit">Salvar</Button></div>
                </form>
            </Modal>
        </>
    );
};

const FuelInvoicesTab = ({ stations }: any) => {
    const [data, setData] = useState<FuelInvoice[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<Partial<FuelInvoice>>({});

    const load = () => {
        api.get("/vehicles/fuel_invoices/").then(res => setData((res.data as any).results || res.data));
    };
    useEffect(() => { load(); }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const fd = new FormData();
            if (form.fuel_station) fd.append("fuel_station", String(form.fuel_station));
            if (form.period_start) fd.append("period_start", form.period_start);
            if (form.period_end) fd.append("period_end", form.period_end);
            if (form.total_value) fd.append("total_value", form.total_value);
            // File upload would need a file input handling

            if (form.id) await api.patch(`/vehicles/fuel_invoices/${form.id}/`, form); // JSON for patch if no file
            else await api.post("/vehicles/fuel_invoices/", form); // JSON for now
            setIsModalOpen(false);
            load();
        } catch (err: any) {
            console.error(err);
            if (err.response?.data) {
                const data = err.response.data;
                const messages = Object.values(data).flat().join("\n");
                alert(`Erro ao salvar:\n${messages}`);
            } else {
                alert("Erro ao salvar.");
            }
        }
    };

    return (
        <>
            <div className="data-actions-bar" style={{ justifyContent: "flex-end", marginBottom: 16 }}>
                <Button onClick={() => { setForm({}); setIsModalOpen(true); }}>+ Nova Fatura</Button>
            </div>
            <Table
                columns={[
                    { label: "Posto", key: "fuel_station_name", render: (d) => d.fuel_station_name || d.fuel_station },
                    { label: "Início", key: "period_start", render: (d) => new Date(d.period_start).toLocaleDateString("pt-BR") },
                    { label: "Fim", key: "period_end", render: (d) => new Date(d.period_end).toLocaleDateString("pt-BR") },
                    { label: "Valor Total", key: "total_value" },
                    { label: "Ações", key: "actions", render: (d) => <Button variant="ghost" size="sm" onClick={() => { setForm(d); setIsModalOpen(true); }}>Editar</Button> }
                ]}
                data={data}
            />
            <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Fatura de Combustível">
                <form onSubmit={handleSave} className="data-form">
                    <div className="data-form-grid">
                        <label className="full-width">Posto * <select required value={form.fuel_station || ""} onChange={e => setForm({ ...form, fuel_station: Number(e.target.value) })}>{stations.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                        <label>Início * <input type="date" required value={form.period_start || ""} onChange={e => setForm({ ...form, period_start: e.target.value })} /></label>
                        <label>Fim * <input type="date" required value={form.period_end || ""} onChange={e => setForm({ ...form, period_end: e.target.value })} /></label>
                        <label className="full-width">Valor Total <input type="number" step="0.01" value={form.total_value || ""} onChange={e => setForm({ ...form, total_value: e.target.value })} /></label>
                    </div>
                    <div className="data-form-actions"><Button type="submit">Salvar</Button></div>
                </form>
            </Modal>
        </>
    );
};

const FuelAlertsTab = () => {
    const [data, setData] = useState<FuelAlert[]>([]);
    const load = () => {
        api.get("/vehicles/fuel_alerts/").then(res => setData((res.data as any).results || res.data));
    };
    useEffect(() => { load(); }, []);

    return (
        <Table
            columns={[
                { label: "Data", key: "created_at", render: (d) => new Date(d.created_at).toLocaleString("pt-BR") },
                { label: "Tipo", key: "alert_type" },
                { label: "Gravidade", key: "severity", render: (d) => <StatusBadge status={d.severity} /> },
                { label: "Mensagem", key: "message" },
            ]}
            data={data}
        />
    );
};
