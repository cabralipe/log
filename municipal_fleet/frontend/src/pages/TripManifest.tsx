import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { Table } from "../components/Table";
import { useMediaQuery } from "../hooks/useMediaQuery";
import "../styles/DataPage.css";

type TripManifest = {
    id: number;
    trip_execution: number;
    total_passengers: number;
    notes?: string;
    passengers: ManifestPassenger[];
};

type ManifestPassenger = {
    id?: number;
    passenger_type: "STUDENT" | "PATIENT" | "COMPANION";
    student?: number;
    student_name?: string;
    patient?: number;
    patient_name?: string;
    companion?: number;
    companion_name?: string;
    linked_patient?: number;
    notes?: string;
};

type Student = { id: number; full_name: string; cpf: string };
type Patient = { id: number; full_name: string; cpf: string };
type Companion = { id: number; full_name: string; patient: number };

export const TripManifestPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isMobile } = useMediaQuery();
    const [manifest, setManifest] = useState<TripManifest | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Selection Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<"STUDENT" | "PATIENT">("STUDENT");
    const [students, setStudents] = useState<Student[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [companions, setCompanions] = useState<Companion[]>([]);
    const [search, setSearch] = useState("");
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
    const [selectedCompanions, setSelectedCompanions] = useState<Set<number>>(new Set());

    const loadManifest = async () => {
        try {
            // First try to get existing manifest
            const res = await api.get<TripManifest[]>(`/trips/manifests/?trip_execution=${id}`);
            if (res.data && res.data.length > 0) {
                setManifest(res.data[0]);
            } else {
                // If not exists, create one
                const newManifest = await api.post<TripManifest>("/trips/manifests/", { trip_execution: Number(id) });
                setManifest(newManifest.data);
            }
        } catch (err) {
            setError("Erro ao carregar manifesto.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) loadManifest();
    }, [id]);

    const loadStudents = async (query = "") => {
        const res = await api.get<{ results: Student[] }>("/students/students/", { params: { search: query, page_size: 50 } });
        setStudents(res.data.results);
    };

    const loadPatients = async (query = "") => {
        const res = await api.get<{ results: Patient[] }>("/health/patients/", { params: { search: query, page_size: 50 } });
        setPatients(res.data.results);
    };

    const loadCompanions = async (patientIds: number[]) => {
        if (patientIds.length === 0) return;
        // This is a simplified approach. Ideally we'd filter by multiple IDs or load per patient.
        // For now, let's load all companions for the selected patients one by one or assume a bulk endpoint if available.
        // We will just load all companions for the first patient for simplicity in this demo or iterate.
        // Better: load companions when a patient is selected in the UI row (if we had a tree view).
        // For this implementation, we will fetch companions for selected patients.
        const promises = patientIds.map(pid => api.get<{ results: Companion[] }>(`/health/companions/?patient=${pid}`));
        const results = await Promise.all(promises);
        const allCompanions = results.flatMap(r => r.data.results);
        setCompanions(allCompanions);
    };

    const openAddModal = (type: "STUDENT" | "PATIENT") => {
        setModalType(type);
        setSearch("");
        setSelectedItems(new Set());
        setSelectedCompanions(new Set());
        if (type === "STUDENT") loadStudents();
        else loadPatients();
        setIsModalOpen(true);
    };

    const handleSearch = (val: string) => {
        setSearch(val);
        if (modalType === "STUDENT") loadStudents(val);
        else loadPatients(val);
    };

    const toggleSelection = (itemId: number) => {
        const next = new Set(selectedItems);
        if (next.has(itemId)) next.delete(itemId);
        else next.add(itemId);
        setSelectedItems(next);

        if (modalType === "PATIENT") {
            // If selecting patient, maybe load companions?
            // For simplicity, we won't auto-load companions here to keep it simple.
        }
    };

    const toggleCompanion = (compId: number) => {
        const next = new Set(selectedCompanions);
        if (next.has(compId)) next.delete(compId);
        else next.add(compId);
        setSelectedCompanions(next);
    };

    const saveSelection = async () => {
        if (!manifest) return;
        try {
            const newPassengers: Partial<ManifestPassenger>[] = [];

            if (modalType === "STUDENT") {
                selectedItems.forEach(sid => {
                    newPassengers.push({ passenger_type: "STUDENT", student: sid });
                });
            } else {
                // Patients
                selectedItems.forEach(pid => {
                    newPassengers.push({ passenger_type: "PATIENT", patient: pid });
                    // Find companions for this patient that are selected?
                    // This logic is tricky without a nested UI.
                    // Let's assume for now we just add patients.
                });
            }

            // We need to append to existing passengers
            const currentPassengers = manifest.passengers.map(p => ({
                passenger_type: p.passenger_type,
                student: p.student,
                patient: p.patient,
                companion: p.companion,
                linked_patient: p.linked_patient
            }));

            const updatedPassengers = [...currentPassengers, ...newPassengers];

            await api.patch(`/trips/manifests/${manifest.id}/`, { passengers: updatedPassengers });
            setIsModalOpen(false);
            loadManifest();
        } catch (err) {
            alert("Erro ao adicionar passageiros.");
        }
    };

    const removePassenger = async (index: number) => {
        if (!manifest) return;
        if (!confirm("Remover passageiro?")) return;
        try {
            const updatedPassengers = [...manifest.passengers];
            updatedPassengers.splice(index, 1);
            // Map back to ID references for the API
            const payload = updatedPassengers.map(p => ({
                passenger_type: p.passenger_type,
                student: p.student,
                patient: p.patient,
                companion: p.companion,
                linked_patient: p.linked_patient
            }));
            await api.patch(`/trips/manifests/${manifest.id}/`, { passengers: payload });
            loadManifest();
        } catch (err) {
            alert("Erro ao remover passageiro.");
        }
    };

    if (loading) return <div className="data-page"><div className="data-loading">Carregando manifesto...</div></div>;

    return (
        <div className="data-page">
            <div className="data-header">
                <div>
                    <Button variant="ghost" onClick={() => navigate("/trips")}>← Voltar</Button>
                    <h1 className="data-title" style={{ marginTop: "0.5rem" }}>Manifesto de Viagem</h1>
                    <p className="data-subtitle">Execução #{id}</p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Button onClick={() => openAddModal("STUDENT")}>+ Alunos</Button>
                    <Button onClick={() => openAddModal("PATIENT")}>+ Pacientes</Button>
                    <Button variant="ghost" onClick={() => window.print()}>Imprimir</Button>
                </div>
            </div>

            {error && <div className="data-error">{error}</div>}

            <div className="data-card">
                <Table
                    columns={[
                        { header: "Tipo", accessor: (d) => d.passenger_type === "STUDENT" ? "Aluno" : d.passenger_type === "PATIENT" ? "Paciente" : "Acompanhante" },
                        { header: "Nome", accessor: (d) => d.student_name || d.patient_name || d.companion_name || "—" },
                        { header: "Observações", accessor: "notes" },
                        {
                            header: "Ações",
                            accessor: (d, idx) => (
                                <Button variant="ghost" size="sm" onClick={() => removePassenger(idx)}>Remover</Button>
                            )
                        }
                    ]}
                    data={manifest?.passengers || []}
                />
                {manifest?.passengers.length === 0 && <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>Nenhum passageiro no manifesto.</div>}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={`Adicionar ${modalType === "STUDENT" ? "Alunos" : "Pacientes"}`}
            >
                <div className="data-form">
                    <input
                        className="data-search"
                        placeholder="Buscar..."
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        autoFocus
                    />
                    <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius)", marginTop: "1rem" }}>
                        {(modalType === "STUDENT" ? students : patients).map(item => (
                            <div
                                key={item.id}
                                style={{
                                    padding: "0.75rem",
                                    borderBottom: "1px solid var(--border)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.75rem",
                                    cursor: "pointer",
                                    backgroundColor: selectedItems.has(item.id) ? "var(--muted)" : "transparent"
                                }}
                                onClick={() => toggleSelection(item.id)}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedItems.has(item.id)}
                                    readOnly
                                />
                                <div>
                                    <div style={{ fontWeight: 500 }}>{item.full_name}</div>
                                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>CPF: {item.cpf}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="data-form-actions">
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={saveSelection}>Adicionar Selecionados</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
