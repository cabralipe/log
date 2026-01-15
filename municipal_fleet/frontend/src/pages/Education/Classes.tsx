import { useEffect, useMemo, useState } from "react";
import { api, type Paginated } from "../../lib/api";
import { Table } from "../../components/Table";
import { Button } from "../../components/Button";
import { StatusBadge } from "../../components/StatusBadge";
import { Pagination } from "../../components/Pagination";
import { Modal } from "../../components/Modal";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import "../../styles/DataPage.css";

type School = { id: number; name: string };

type ClassGroup = {
    id: number;
    name: string;
    school: number;
    school_name?: string;
    shift: "MORNING" | "AFTERNOON" | "FULLTIME" | "EVENING";
    active: boolean;
};

export const ClassesPage = () => {
    const { isMobile } = useMediaQuery();
    const [classes, setClasses] = useState<ClassGroup[]>([]);
    const [schools, setSchools] = useState<School[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<Partial<ClassGroup>>({
        shift: "MORNING",
        active: true,
    });

    const shiftLabels: Record<string, string> = {
        MORNING: "Manhã",
        AFTERNOON: "Tarde",
        FULLTIME: "Integral",
        EVENING: "Noite",
    };

    const schoolMap = useMemo(() => {
        return new Map(schools.map((school) => [school.id, school.name]));
    }, [schools]);

    const classesWithSchool = useMemo(() => {
        return classes.map((cls) => ({
            ...cls,
            school_name: schoolMap.get(cls.school) || cls.school_name,
        }));
    }, [classes, schoolMap]);

    const load = (nextPage = page, nextSearch = search) => {
        setLoading(true);
        const params: any = { page: nextPage, page_size: pageSize };
        if (nextSearch) params.search = nextSearch;

        api
            .get<Paginated<ClassGroup>>("/students/class-groups/", { params })
            .then((res) => {
                const data = res.data as any;
                if (Array.isArray(data)) {
                    setClasses(data);
                    setTotal(data.length);
                } else {
                    setClasses(data.results);
                    setTotal(data.count);
                }
                setError(null);
            })
            .catch((err) => setError("Erro ao carregar turmas."))
            .finally(() => setLoading(false));

        // Load schools for dropdown
        api.get<Paginated<School>>("/students/schools/", { params: { page_size: 100 } }).then((res) => {
            const data = res.data as any;
            setSchools(Array.isArray(data) ? data : data.results);
        });
    };

    useEffect(() => {
        load();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.patch(`/students/class-groups/${editingId}/`, form);
            } else {
                await api.post("/students/class-groups/", form);
            }
            setIsModalOpen(false);
            load();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Erro ao salvar turma.");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Deseja remover esta turma?")) return;
        try {
            await api.delete(`/students/class-groups/${id}/`);
            load();
        } catch (err) {
            setError("Erro ao remover turma.");
        }
    };

    const openModal = (cls?: ClassGroup) => {
        if (cls) {
            setEditingId(cls.id);
            setForm(cls);
        } else {
            setEditingId(null);
            setForm({ shift: "MORNING", active: true });
        }
        setIsModalOpen(true);
    };

    return (
        <div className="data-page">
            <div className="data-header">
                <div>
                    <h1 className="data-title">Turmas</h1>
                    <p className="data-subtitle">Gerencie as turmas das escolas.</p>
                </div>
                <Button onClick={() => openModal()}>+ Nova Turma</Button>
            </div>

            {error && <div className="data-error">{error}</div>}

            <div className="data-filters">
                <input
                    placeholder="Buscar por nome da turma..."
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                        load(1, e.target.value);
                    }}
                    className="data-search"
                />
            </div>

            {loading ? (
                <div className="data-loading">Carregando...</div>
            ) : (
                <>
                    <Table
                        columns={[
                            { label: "Nome", key: "name" },
                            { label: "Escola", key: "school_name" },
                            { label: "Turno", key: "shift", render: (d) => shiftLabels[d.shift] || d.shift },
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
                        data={classesWithSchool}
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
                title={editingId ? "Editar Turma" : "Nova Turma"}
            >
                <form onSubmit={handleSave} className="data-form">
                    <div className="data-form-grid">
                        <label>
                            Nome da Turma *
                            <input
                                required
                                value={form.name || ""}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                        </label>
                        <label>
                            Escola *
                            <select
                                required
                                value={form.school || ""}
                                onChange={(e) => setForm({ ...form, school: Number(e.target.value) })}
                            >
                                <option value="">Selecione a escola</option>
                                {schools.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Turno *
                            <select
                                value={form.shift}
                                onChange={(e) => setForm({ ...form, shift: e.target.value as any })}
                            >
                                {Object.entries(shiftLabels).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </label>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={form.active}
                                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                            />
                            Ativa
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
