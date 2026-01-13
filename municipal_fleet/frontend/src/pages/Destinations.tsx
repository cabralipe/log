import { useEffect, useState } from "react";
import { api, type Paginated } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { Pagination } from "../components/Pagination";
import { Modal } from "../components/Modal";
import { useMediaQuery } from "../hooks/useMediaQuery";
import "../styles/DataPage.css";

type Destination = {
    id: number;
    name: string;
    type: "SCHOOL" | "HEALTH_UNIT" | "EVENT" | "OTHER";
    address: string;
    number?: string;
    district?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    latitude: number;
    longitude: number;
    notes?: string;
    active: boolean;
};

export const DestinationsPage = () => {
    const { isMobile } = useMediaQuery();
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<Partial<Destination>>({
        type: "OTHER",
        active: true,
        latitude: 0,
        longitude: 0,
    });

    const typeLabels: Record<string, string> = {
        SCHOOL: "Escola",
        HEALTH_UNIT: "Unidade de Saúde",
        EVENT: "Evento",
        OTHER: "Outro",
    };

    const load = (nextPage = page, nextSearch = search, nextType = typeFilter) => {
        setLoading(true);
        const params: any = { page: nextPage, page_size: pageSize };
        if (nextSearch) params.search = nextSearch;
        if (nextType) params.type = nextType;

        api
            .get<Paginated<Destination>>("/destinations/", { params })
            .then((res) => {
                const data = res.data as any; // Handle potential different response structure
                if (Array.isArray(data)) {
                    setDestinations(data);
                    setTotal(data.length);
                } else {
                    setDestinations(data.results);
                    setTotal(data.count);
                }
                setError(null);
            })
            .catch((err) => setError("Erro ao carregar destinos."))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.patch(`/destinations/${editingId}/`, form);
            } else {
                await api.post("/destinations/", form);
            }
            setIsModalOpen(false);
            load();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Erro ao salvar destino.");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Deseja remover este destino?")) return;
        try {
            await api.delete(`/destinations/${id}/`);
            load();
        } catch (err) {
            setError("Erro ao remover destino.");
        }
    };

    const openModal = (dest?: Destination) => {
        if (dest) {
            setEditingId(dest.id);
            setForm(dest);
        } else {
            setEditingId(null);
            setForm({ type: "OTHER", active: true, latitude: 0, longitude: 0 });
        }
        setIsModalOpen(true);
    };

    return (
        <div className="data-page">
            <div className="data-header">
                <div>
                    <h1 className="data-title">Destinos</h1>
                    <p className="data-subtitle">Gerencie locais de parada para as viagens.</p>
                </div>
                <Button onClick={() => openModal()}>+ Novo Destino</Button>
            </div>

            {error && <div className="data-error">{error}</div>}

            <div className="data-filters">
                <input
                    placeholder="Buscar por nome..."
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                        load(1, e.target.value, typeFilter);
                    }}
                    className="data-search"
                />
                <select
                    value={typeFilter}
                    onChange={(e) => {
                        setTypeFilter(e.target.value);
                        setPage(1);
                        load(1, search, e.target.value);
                    }}
                    className="data-select"
                >
                    <option value="">Todos os tipos</option>
                    {Object.entries(typeLabels).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="data-loading">Carregando...</div>
            ) : (
                <>
                    <Table
                        columns={[
                            { label: "Nome", key: "name" },
                            { label: "Tipo", key: "type", render: (d) => typeLabels[d.type] || d.type },
                            { label: "Endereço", key: "address" },
                            { label: "Cidade", key: "city" },
                            {
                                label: "Status",
                                key: "active",
                                render: (d) => <StatusBadge status={d.active ? "ACTIVE" : "INACTIVE"} />,
                            },
                            {
                                label: "Ações",
                                key: "actions",
                                render: (d) => (
                                    <div className="data-actions">
                                        <Button variant="ghost" size="sm" onClick={() => openModal(d)}>
                                            Editar
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)}>
                                            Excluir
                                        </Button>
                                    </div>
                                ),
                            },
                        ]}
                        data={destinations}
                    />
                    <Pagination
                        page={page}
                        pageSize={pageSize}
                        total={total}
                        onChange={(p) => {
                            setPage(p);
                            load(p);
                        }}
                    />
                </>
            )}

            <Modal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? "Editar Destino" : "Novo Destino"}
            >
                <form onSubmit={handleSave} className="data-form">
                    <div className="data-form-grid">
                        <label>
                            Nome *
                            <input
                                required
                                value={form.name || ""}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                        </label>
                        <label>
                            Tipo *
                            <select
                                value={form.type}
                                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                            >
                                {Object.entries(typeLabels).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </label>
                        <label className="full-width">
                            Endereço *
                            <input
                                required
                                value={form.address || ""}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                            />
                        </label>
                        <label>
                            Número
                            <input
                                value={form.number || ""}
                                onChange={(e) => setForm({ ...form, number: e.target.value })}
                            />
                        </label>
                        <label>
                            Bairro
                            <input
                                value={form.district || ""}
                                onChange={(e) => setForm({ ...form, district: e.target.value })}
                            />
                        </label>
                        <label>
                            Cidade
                            <input
                                value={form.city || ""}
                                onChange={(e) => setForm({ ...form, city: e.target.value })}
                            />
                        </label>
                        <label>
                            Estado (UF)
                            <input
                                maxLength={2}
                                value={form.state || ""}
                                onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                            />
                        </label>
                        <label>
                            CEP
                            <input
                                value={form.postal_code || ""}
                                onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                            />
                        </label>
                        <label>
                            Latitude
                            <input
                                type="number"
                                step="any"
                                value={form.latitude || 0}
                                onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })}
                            />
                        </label>
                        <label>
                            Longitude
                            <input
                                type="number"
                                step="any"
                                value={form.longitude || 0}
                                onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })}
                            />
                        </label>
                        <label className="full-width">
                            Observações
                            <textarea
                                rows={3}
                                value={form.notes || ""}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            />
                        </label>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={form.active}
                                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                            />
                            Ativo
                        </label>
                    </div>
                    <div className="data-form-actions">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit">Salvar</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
