import { useEffect, useMemo, useState } from "react";
import { api, type Paginated } from "../../lib/api";
import { Table } from "../../components/Table";
import { Button } from "../../components/Button";
import { StatusBadge } from "../../components/StatusBadge";
import { Pagination } from "../../components/Pagination";
import { Modal } from "../../components/Modal";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { formatCpf } from "../../utils/masks";
import "../../styles/DataPage.css";

type School = { id: number; name: string };
type ClassGroup = { id: number; name: string; school: number };

type Student = {
    id: number;
    full_name: string;
    social_name?: string;
    date_of_birth: string;
    cpf: string;
    registration_number?: string;
    grade?: string;
    shift: "MORNING" | "AFTERNOON" | "FULLTIME" | "EVENING";
    address?: string;
    district?: string;
    has_special_needs: boolean;
    special_needs_details?: string;
    status: "ACTIVE" | "TRANSFERRED" | "INACTIVE" | "GRADUATED";
    school: number;
    school_name?: string;
    class_group?: number;
    class_group_name?: string;
};

export const StudentsPage = () => {
    const { isMobile } = useMediaQuery();
    const [students, setStudents] = useState<Student[]>([]);
    const [schools, setSchools] = useState<School[]>([]);
    const [classes, setClasses] = useState<ClassGroup[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<Partial<Student>>({
        shift: "MORNING",
        status: "ACTIVE",
        has_special_needs: false,
    });

    // Filtered classes based on selected school
    const [filteredClasses, setFilteredClasses] = useState<ClassGroup[]>([]);

    const shiftLabels: Record<string, string> = {
        MORNING: "Manhã",
        AFTERNOON: "Tarde",
        FULLTIME: "Integral",
        EVENING: "Noite",
    };

    const statusLabels: Record<string, string> = {
        ACTIVE: "Ativo",
        TRANSFERRED: "Transferido",
        INACTIVE: "Inativo",
        GRADUATED: "Formado",
    };

    const schoolMap = useMemo(() => {
        return new Map(schools.map((school) => [school.id, school.name]));
    }, [schools]);

    const classMap = useMemo(() => {
        return new Map(classes.map((cls) => [cls.id, cls.name]));
    }, [classes]);

    const studentsWithNames = useMemo(() => {
        return students.map((student) => ({
            ...student,
            school_name: schoolMap.get(student.school) || student.school_name,
            class_group_name:
                (student.class_group ? classMap.get(student.class_group) : undefined) || student.class_group_name,
        }));
    }, [students, schoolMap, classMap]);

    const load = (nextPage = page, nextSearch = search) => {
        setLoading(true);
        const params: any = { page: nextPage, page_size: pageSize };
        if (nextSearch) params.search = nextSearch;

        api
            .get<Paginated<Student>>("/students/students/", { params })
            .then((res) => {
                const data = res.data as any;
                if (Array.isArray(data)) {
                    setStudents(data);
                    setTotal(data.length);
                } else {
                    setStudents(data.results);
                    setTotal(data.count);
                }
                setError(null);
            })
            .catch((err) => setError("Erro ao carregar alunos."))
            .finally(() => setLoading(false));

        // Load dependencies
        if (schools.length === 0) {
            api.get<Paginated<School>>("/students/schools/", { params: { page_size: 100 } }).then((res) => {
                const data = res.data as any;
                setSchools(Array.isArray(data) ? data : data.results);
            });
            api.get<Paginated<ClassGroup>>("/students/classes/", { params: { page_size: 100 } }).then((res) => {
                const data = res.data as any;
                setClasses(Array.isArray(data) ? data : data.results);
            });
        }
    };

    useEffect(() => {
        load();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (form.school) {
            setFilteredClasses(classes.filter(c => c.school === form.school));
        } else {
            setFilteredClasses([]);
        }
    }, [form.school, classes]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.patch(`/students/students/${editingId}/`, form);
            } else {
                await api.post("/students/students/", form);
            }
            setIsModalOpen(false);
            load();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Erro ao salvar aluno.");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Deseja remover este aluno?")) return;
        try {
            await api.delete(`/students/students/${id}/`);
            load();
        } catch (err) {
            setError("Erro ao remover aluno.");
        }
    };

    const openModal = (student?: Student) => {
        if (student) {
            setEditingId(student.id);
            setForm(student);
        } else {
            setEditingId(null);
            setForm({ shift: "MORNING", status: "ACTIVE", has_special_needs: false });
        }
        setIsModalOpen(true);
    };

    return (
        <div className="data-page">
            <div className="data-header">
                <div>
                    <h1 className="data-title">Alunos</h1>
                    <p className="data-subtitle">Gerencie o cadastro de alunos.</p>
                </div>
                <Button onClick={() => openModal()}>+ Novo Aluno</Button>
            </div>

            {error && <div className="data-error">{error}</div>}

            <div className="data-filters">
                <input
                    placeholder="Buscar por nome ou CPF..."
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
                            { label: "Nome", key: "full_name" },
                            { label: "Escola", key: "school_name" },
                            { label: "Turma", key: "class_group_name" },
                            { label: "Turno", key: "shift", render: (d) => shiftLabels[d.shift] || d.shift },
                            {
                                label: "Status",
                                key: "status",
                                render: (d) => <StatusBadge status={d.status} />,
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
                        data={studentsWithNames}
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
                title={editingId ? "Editar Aluno" : "Novo Aluno"}
            >
                <form onSubmit={handleSave} className="data-form">
                    <div className="data-form-grid">
                        <label className="full-width">
                            Nome Completo *
                            <input
                                required
                                value={form.full_name || ""}
                                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                            />
                        </label>
                        <label>
                            CPF *
                            <input
                                required
                                value={form.cpf || ""}
                                onChange={(e) => setForm({ ...form, cpf: formatCpf(e.target.value) })}
                                maxLength={14}
                            />
                        </label>
                        <label>
                            Data de Nascimento *
                            <input
                                type="date"
                                required
                                value={form.date_of_birth || ""}
                                onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                            />
                        </label>
                        <label>
                            Escola *
                            <select
                                required
                                value={form.school || ""}
                                onChange={(e) => setForm({ ...form, school: Number(e.target.value), class_group: undefined })}
                            >
                                <option value="">Selecione a escola</option>
                                {schools.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Turma
                            <select
                                value={form.class_group || ""}
                                onChange={(e) => setForm({ ...form, class_group: Number(e.target.value) })}
                                disabled={!form.school}
                            >
                                <option value="">Selecione a turma</option>
                                {filteredClasses.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
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
                        <label>
                            Série/Ano
                            <input
                                value={form.grade || ""}
                                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                            />
                        </label>
                        <label>
                            Matrícula
                            <input
                                value={form.registration_number || ""}
                                onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
                            />
                        </label>
                        <label className="full-width">
                            Endereço
                            <input
                                value={form.address || ""}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
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
                            Status *
                            <select
                                value={form.status}
                                onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                            >
                                {Object.entries(statusLabels).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </label>
                        <label className="checkbox-label full-width">
                            <input
                                type="checkbox"
                                checked={form.has_special_needs}
                                onChange={(e) => setForm({ ...form, has_special_needs: e.target.checked })}
                            />
                            Possui necessidades especiais
                        </label>
                        {form.has_special_needs && (
                            <label className="full-width">
                                Detalhes das necessidades
                                <textarea
                                    rows={2}
                                    value={form.special_needs_details || ""}
                                    onChange={(e) => setForm({ ...form, special_needs_details: e.target.value })}
                                />
                            </label>
                        )}
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
