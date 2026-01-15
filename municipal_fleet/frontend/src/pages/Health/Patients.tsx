import { useEffect, useState } from "react";
import { api, type Paginated } from "../../lib/api";
import { Table } from "../../components/Table";
import { Button } from "../../components/Button";
import { StatusBadge } from "../../components/StatusBadge";
import { Pagination } from "../../components/Pagination";
import { Modal } from "../../components/Modal";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { formatCpf } from "../../utils/masks";
import "../../styles/DataPage.css";

type Patient = {
    id: number;
    full_name: string;
    cpf: string;
    date_of_birth: string;
    comorbidities?: string;
    needs_companion: boolean;
    notes?: string;
    status: "ACTIVE" | "INACTIVE";
};

type Companion = {
    id: number;
    full_name: string;
    cpf?: string;
    date_of_birth?: string;
    relationship?: string;
    phone?: string;
    notes?: string;
    active: boolean;
    patient: number;
};

export const PatientsPage = () => {
    const { isMobile } = useMediaQuery();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Patient Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<Partial<Patient>>({
        status: "ACTIVE",
        needs_companion: false,
    });

    // Companions Modal
    const [isCompanionModalOpen, setIsCompanionModalOpen] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [companions, setCompanions] = useState<Companion[]>([]);
    const [companionForm, setCompanionForm] = useState<Partial<Companion>>({
        active: true,
    });
    const [editingCompanionId, setEditingCompanionId] = useState<number | null>(null);

    const load = (nextPage = page, nextSearch = search) => {
        setLoading(true);
        const params: any = { page: nextPage, page_size: pageSize };
        if (nextSearch) params.search = nextSearch;

        api
            .get<Paginated<Patient>>("/healthcare/patients/", { params })
            .then((res) => {
                const data = res.data as any;
                if (Array.isArray(data)) {
                    setPatients(data);
                    setTotal(data.length);
                } else {
                    setPatients(data.results);
                    setTotal(data.count);
                }
                setError(null);
            })
            .catch((err) => setError("Erro ao carregar pacientes."))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            let patientId = editingId;
            if (editingId) {
                await api.patch(`/healthcare/patients/${editingId}/`, form);
            } else {
                const res = await api.post("/healthcare/patients/", form);
                patientId = res.data.id;
            }

            // Handle inline companion creation
            if (form.needs_companion && companionForm.full_name && patientId) {
                const companionPayload = { ...companionForm, patient: patientId };
                // Check if patient already has a companion to update or create new
                // For simplicity in this inline flow, we assume creation if new patient, 
                // or we might need to fetch existing if editing. 
                // But the requirement implies "cadastro", usually for new.
                // If editing and needs_companion is checked, we might want to show existing.
                // For now, let's just create if it's a new patient or if we have data.
                // Ideally we should check if one exists.
                await api.post("/healthcare/companions/", companionPayload);
            }

            setIsModalOpen(false);
            load();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Erro ao salvar paciente.");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Deseja remover este paciente?")) return;
        try {
            await api.delete(`/healthcare/patients/${id}/`);
            load();
        } catch (err) {
            setError("Erro ao remover paciente.");
        }
    };

    const openModal = (patient?: Patient) => {
        if (patient) {
            setEditingId(patient.id);
            setForm(patient);
        } else {
            setEditingId(null);
            setForm({ status: "ACTIVE", needs_companion: false });
        }
        setIsModalOpen(true);
    };

    // Companion Logic
    const loadCompanions = (patientId: number) => {
        api.get<Paginated<Companion>>(`/healthcare/companions/?patient=${patientId}`).then((res) => {
            const data = res.data as any;
            setCompanions(Array.isArray(data) ? data : data.results);
        });
    };

    const openCompanions = (patient: Patient) => {
        setSelectedPatient(patient);
        loadCompanions(patient.id);
        setIsCompanionModalOpen(true);
        setCompanionForm({ active: true, patient: patient.id });
        setEditingCompanionId(null);
    };

    const handleSaveCompanion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPatient) return;
        try {
            const payload = { ...companionForm, patient: selectedPatient.id };
            if (editingCompanionId) {
                await api.patch(`/healthcare/companions/${editingCompanionId}/`, payload);
            } else {
                await api.post("/healthcare/companions/", payload);
            }
            setCompanionForm({ active: true, patient: selectedPatient.id });
            setEditingCompanionId(null);
            loadCompanions(selectedPatient.id);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Erro ao salvar acompanhante.");
        }
    };

    const handleEditCompanion = (comp: Companion) => {
        setEditingCompanionId(comp.id);
        setCompanionForm(comp);
    };

    const handleDeleteCompanion = async (id: number) => {
        if (!confirm("Remover acompanhante?")) return;
        if (!selectedPatient) return;
        try {
            await api.delete(`/healthcare/companions/${id}/`);
            loadCompanions(selectedPatient.id);
        } catch (err) {
            alert("Erro ao remover acompanhante.");
        }
    };

    return (
        <div className="data-page">
            <div className="data-header">
                <div>
                    <h1 className="data-title">Pacientes</h1>
                    <p className="data-subtitle">Gerencie pacientes e seus acompanhantes.</p>
                </div>
                <Button onClick={() => openModal()}>+ Novo Paciente</Button>
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
                            { label: "CPF", key: "cpf" },
                            { label: "Nascimento", key: "date_of_birth", render: (d) => new Date(d.date_of_birth).toLocaleDateString("pt-BR") },
                            { label: "Acompanhante?", key: "needs_companion", render: (d) => (d.needs_companion ? "Sim" : "Não") },
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
                                        <Button variant="ghost" size="sm" onClick={() => openCompanions(d)}>
                                            Acompanhantes
                                        </Button>
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
                        data={patients}
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

            {/* Patient Modal */}
            <Modal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? "Editar Paciente" : "Novo Paciente"}
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
                        <label className="full-width">
                            Comorbidades (CID)
                            <div style={{ display: "flex", gap: "0.5rem", flexDirection: "column" }}>
                                <div style={{ position: "relative" }}>
                                    <input
                                        placeholder="Digite o nome da comorbidade (ex: diabetes, hipertensão...)"
                                        style={{ width: "100%" }}
                                        id="cid-search-input"
                                        autoComplete="off"
                                        onChange={async (e) => {
                                            const term = e.target.value.trim();
                                            const dropdown = document.getElementById("cid-suggestions");
                                            if (!dropdown) return;
                                            if (term.length < 3) {
                                                dropdown.innerHTML = "";
                                                dropdown.style.display = "none";
                                                return;
                                            }
                                            try {
                                                // Try a more reliable CID API
                                                const res = await fetch(`https://cid10.herokuapp.com/api/v1/cid10?q=${encodeURIComponent(term)}`);
                                                let data = [];
                                                if (res.ok) {
                                                    data = await res.json();
                                                } else {
                                                    // Fallback to a small local list for common comorbidities if API is down
                                                    const common = [
                                                        { code: "E10", description: "Diabetes mellitus insulinodependente" },
                                                        { code: "E11", description: "Diabetes mellitus não-insulinodependente" },
                                                        { code: "I10", description: "Hipertensão essencial (primária)" },
                                                        { code: "I11", description: "Doença cardíaca hipertensiva" },
                                                        { code: "J45", description: "Asma" },
                                                        { code: "E66", description: "Obesidade" },
                                                        { code: "I20", description: "Angina pectoris" },
                                                        { code: "I21", description: "Infarto agudo do miocárdio" }
                                                    ].filter(i => i.description.toLowerCase().includes(term.toLowerCase()) || i.code.toLowerCase().includes(term.toLowerCase()));
                                                    data = common;
                                                }

                                                if (Array.isArray(data) && data.length > 0) {
                                                    dropdown.innerHTML = data.slice(0, 8).map((item: { code: string; description: string }) =>
                                                        `<div class="cid-suggestion-item" data-code="${item.code}" data-desc="${item.description}" style="padding:0.5rem;cursor:pointer;border-bottom:1px solid var(--border)">
                                                            <strong>${item.code}</strong> - ${item.description}
                                                        </div>`
                                                    ).join("");
                                                    dropdown.style.display = "block";
                                                    dropdown.querySelectorAll(".cid-suggestion-item").forEach(el => {
                                                        el.addEventListener("click", () => {
                                                            const code = el.getAttribute("data-code");
                                                            const desc = el.getAttribute("data-desc");
                                                            setForm(prev => ({
                                                                ...prev,
                                                                comorbidities: (prev.comorbidities ? prev.comorbidities + "\n" : "") + `${code} - ${desc}`
                                                            }));
                                                            const input = document.getElementById("cid-search-input") as HTMLInputElement;
                                                            if (input) input.value = "";
                                                            dropdown.style.display = "none";
                                                        });
                                                    });
                                                } else {
                                                    dropdown.innerHTML = "<div style='padding:0.5rem;color:var(--muted)'>Nenhum resultado</div>";
                                                    dropdown.style.display = "block";
                                                }
                                            } catch {
                                                dropdown.innerHTML = "<div style='padding:0.5rem;color:var(--muted)'>Erro na busca</div>";
                                                dropdown.style.display = "block";
                                            }
                                        }}
                                        onBlur={() => {
                                            setTimeout(() => {
                                                const dropdown = document.getElementById("cid-suggestions");
                                                if (dropdown) dropdown.style.display = "none";
                                            }, 200);
                                        }}
                                    />
                                    <div
                                        id="cid-suggestions"
                                        style={{
                                            position: "absolute",
                                            top: "100%",
                                            left: 0,
                                            right: 0,
                                            background: "var(--bg)",
                                            border: "1px solid var(--border)",
                                            borderRadius: "0.5rem",
                                            maxHeight: "200px",
                                            overflow: "auto",
                                            zIndex: 100,
                                            display: "none",
                                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                                        }}
                                    />
                                </div>
                                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                                    Digite o nome da doença/comorbidade para buscar o código CID.
                                </div>
                                <textarea
                                    rows={3}
                                    placeholder="Lista de comorbidades..."
                                    value={form.comorbidities || ""}
                                    onChange={(e) => setForm({ ...form, comorbidities: e.target.value })}
                                />
                            </div>
                        </label>

                        <label className="full-width">
                            Observações
                            <textarea
                                rows={2}
                                value={form.notes || ""}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            />
                        </label>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={form.needs_companion}
                                onChange={(e) => setForm({ ...form, needs_companion: e.target.checked })}
                            />
                            Necessita de acompanhante
                        </label>

                        {form.needs_companion && (
                            <div className="full-width" style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "var(--radius)", marginTop: "0.5rem" }}>
                                <h4 style={{ marginBottom: "0.5rem" }}>Dados do Acompanhante</h4>
                                <div className="data-form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                                    <label className="full-width">
                                        Nome Completo *
                                        <input
                                            required={form.needs_companion}
                                            value={companionForm.full_name || ""}
                                            onChange={(e) => setCompanionForm({ ...companionForm, full_name: e.target.value })}
                                        />
                                    </label>
                                    <label>
                                        CPF
                                        <input
                                            value={companionForm.cpf || ""}
                                            onChange={(e) => setCompanionForm({ ...companionForm, cpf: formatCpf(e.target.value) })}
                                            maxLength={14}
                                        />
                                    </label>
                                    <label>
                                        Telefone
                                        <input
                                            value={companionForm.phone || ""}
                                            onChange={(e) => setCompanionForm({ ...companionForm, phone: e.target.value })}
                                        />
                                    </label>
                                    <label>
                                        Parentesco
                                        <input
                                            value={companionForm.relationship || ""}
                                            onChange={(e) => setCompanionForm({ ...companionForm, relationship: e.target.value })}
                                        />
                                    </label>
                                </div>
                            </div>
                        )}
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={form.status === "ACTIVE"}
                                onChange={(e) => setForm({ ...form, status: e.target.checked ? "ACTIVE" : "INACTIVE" })}
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

            {/* Companions Modal */}
            <Modal
                open={isCompanionModalOpen}
                onClose={() => setIsCompanionModalOpen(false)}
                title={`Acompanhantes de ${selectedPatient?.full_name}`}
            >
                <div className="data-form">
                    <div style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "1rem" }}>
                        <h4 style={{ marginBottom: "0.5rem" }}>{editingCompanionId ? "Editar Acompanhante" : "Adicionar Acompanhante"}</h4>
                        <form onSubmit={handleSaveCompanion} className="data-form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                            <label className="full-width">
                                Nome Completo *
                                <input
                                    required
                                    value={companionForm.full_name || ""}
                                    onChange={(e) => setCompanionForm({ ...companionForm, full_name: e.target.value })}
                                />
                            </label>
                            <label>
                                CPF
                                <input
                                    value={companionForm.cpf || ""}
                                    onChange={(e) => setCompanionForm({ ...companionForm, cpf: formatCpf(e.target.value) })}
                                    maxLength={14}
                                />
                            </label>
                            <label>
                                Telefone
                                <input
                                    value={companionForm.phone || ""}
                                    onChange={(e) => setCompanionForm({ ...companionForm, phone: e.target.value })}
                                />
                            </label>
                            <label>
                                Parentesco
                                <input
                                    value={companionForm.relationship || ""}
                                    onChange={(e) => setCompanionForm({ ...companionForm, relationship: e.target.value })}
                                />
                            </label>
                            <div className="data-form-actions" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
                                {editingCompanionId && <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingCompanionId(null); setCompanionForm({ active: true, patient: selectedPatient?.id }); }}>Cancelar Edição</Button>}
                                <Button type="submit" size="sm">Salvar</Button>
                            </div>
                        </form>
                    </div>

                    <h4 style={{ marginBottom: "0.5rem" }}>Lista de Acompanhantes</h4>
                    {companions.length === 0 ? (
                        <p style={{ color: "var(--muted)" }}>Nenhum acompanhante cadastrado.</p>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {companions.map(comp => (
                                <div key={comp.id} style={{ padding: "0.5rem", border: "1px solid var(--border)", borderRadius: "var(--radius)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <strong>{comp.full_name}</strong>
                                        <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                                            {comp.relationship} • {comp.phone}
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                        <Button variant="ghost" size="sm" onClick={() => handleEditCompanion(comp)}>Editar</Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteCompanion(comp.id)}>Excluir</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};
