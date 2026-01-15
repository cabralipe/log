import { useEffect, useState } from "react";
import { api, type Paginated } from "../../lib/api";
import { Table } from "../../components/Table";
import { Button } from "../../components/Button";
import { StatusBadge } from "../../components/StatusBadge";
import { Pagination } from "../../components/Pagination";
import { Modal } from "../../components/Modal";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../../styles/DataPage.css";

// Fix Leaflet icon issues
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

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

                        <label className="full-width">
                            Buscar Endereço
                            <div style={{ position: "relative" }}>
                                <input
                                    placeholder="Digite o endereço para buscar (ex: Av. Paulista, 1000, São Paulo)"
                                    id="address-search-input"
                                    autoComplete="off"
                                    onChange={async (e) => {
                                        const term = e.target.value.trim();
                                        const dropdown = document.getElementById("address-suggestions");
                                        if (!dropdown) return;
                                        if (term.length < 5) {
                                            dropdown.innerHTML = "";
                                            dropdown.style.display = "none";
                                            return;
                                        }
                                        try {
                                            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(term)}`);
                                            if (!res.ok) {
                                                dropdown.innerHTML = "<div style='padding:0.5rem;color:var(--muted)'>Erro na busca</div>";
                                                dropdown.style.display = "block";
                                                return;
                                            }
                                            const data = await res.json();
                                            if (Array.isArray(data) && data.length > 0) {
                                                dropdown.innerHTML = data.map((item: any, idx: number) =>
                                                    `<div class="address-suggestion-item" data-idx="${idx}" style="padding:0.75rem;cursor:pointer;border-bottom:1px solid var(--border)">
                                                        <strong>${item.display_name.split(",")[0]}</strong><br/>
                                                        <small style="color:var(--muted)">${item.display_name}</small>
                                                    </div>`
                                                ).join("");
                                                dropdown.style.display = "block";
                                                // Store data for click handlers
                                                (window as any).__addressSearchResults = data;
                                                dropdown.querySelectorAll(".address-suggestion-item").forEach(el => {
                                                    el.addEventListener("click", () => {
                                                        const idx = parseInt(el.getAttribute("data-idx") || "0");
                                                        const result = (window as any).__addressSearchResults?.[idx];
                                                        if (result) {
                                                            const addr = result.address || {};
                                                            setForm(prev => ({
                                                                ...prev,
                                                                address: result.display_name.split(",")[0] || prev.address,
                                                                number: addr.house_number || prev.number,
                                                                district: addr.suburb || addr.neighbourhood || addr.district || prev.district,
                                                                city: addr.city || addr.town || addr.municipality || prev.city,
                                                                state: addr.state_code?.toUpperCase() || addr.state?.substring(0, 2)?.toUpperCase() || prev.state,
                                                                postal_code: addr.postcode || prev.postal_code,
                                                                latitude: parseFloat(result.lat),
                                                                longitude: parseFloat(result.lon)
                                                            }));
                                                            const input = document.getElementById("address-search-input") as HTMLInputElement;
                                                            if (input) input.value = "";
                                                            dropdown.style.display = "none";
                                                        }
                                                    });
                                                });
                                            } else {
                                                dropdown.innerHTML = "<div style='padding:0.5rem;color:var(--muted)'>Nenhum resultado encontrado</div>";
                                                dropdown.style.display = "block";
                                            }
                                        } catch {
                                            dropdown.innerHTML = "<div style='padding:0.5rem;color:var(--muted)'>Erro na busca</div>";
                                            dropdown.style.display = "block";
                                        }
                                    }}
                                    onBlur={() => {
                                        setTimeout(() => {
                                            const dropdown = document.getElementById("address-suggestions");
                                            if (dropdown) dropdown.style.display = "none";
                                        }, 300);
                                    }}
                                />
                                <div
                                    id="address-suggestions"
                                    style={{
                                        position: "absolute",
                                        top: "100%",
                                        left: 0,
                                        right: 0,
                                        background: "var(--bg)",
                                        border: "1px solid var(--border)",
                                        borderRadius: "0.5rem",
                                        maxHeight: "250px",
                                        overflow: "auto",
                                        zIndex: 1000,
                                        display: "none",
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                                    }}
                                />
                            </div>
                            <small style={{ color: "var(--muted)", display: "block", marginTop: "0.25rem" }}>
                                Pesquise um endereço para preencher automaticamente os campos e posicionar no mapa.
                            </small>
                        </label>

                        <div className="full-width" style={{ height: "300px", marginBottom: "1rem", border: "1px solid #ccc", borderRadius: "4px" }}>
                            <LocationPicker
                                lat={form.latitude || 0}
                                lng={form.longitude || 0}
                                onChange={(lat, lng) => setForm(prev => ({ ...prev, latitude: lat, longitude: lng }))}
                            />
                        </div>

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

const LocationPicker = ({ lat, lng, onChange }: { lat: number; lng: number; onChange: (lat: number, lng: number) => void }) => {
    const mapContainerRef = useState<HTMLDivElement | null>(null);
    const mapInstanceRef = useState<L.Map | null>(null);
    const markerRef = useState<L.Marker | null>(null);

    // Initial center (Brazil default or specific)
    const defaultCenter: [number, number] = [-15.793889, -47.882778];
    const center: [number, number] = lat && lng ? [lat, lng] : defaultCenter;

    useEffect(() => {
        if (!mapContainerRef[0] || mapInstanceRef[0]) return;

        const map = L.map(mapContainerRef[0]).setView(center, 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        const newMarker = L.marker(center, { draggable: true }).addTo(map);

        newMarker.on("dragend", (e) => {
            const { lat, lng } = e.target.getLatLng();
            onChange(lat, lng);
        });

        map.on("click", (e) => {
            newMarker.setLatLng(e.latlng);
            onChange(e.latlng.lat, e.latlng.lng);
        });

        mapInstanceRef[1](map);
        markerRef[1](newMarker);

        // Force resize after mount to prevent gray tiles
        setTimeout(() => {
            map.invalidateSize();
        }, 100);

        return () => {
            map.remove();
            mapInstanceRef[1](null);
            markerRef[1](null);
        };
    }, [mapContainerRef[0]]); // eslint-disable-line react-hooks/exhaustive-deps

    // Update marker when props change
    useEffect(() => {
        if (markerRef[0] && lat && lng) {
            const current = markerRef[0].getLatLng();
            if (current.lat !== lat || current.lng !== lng) {
                markerRef[0].setLatLng([lat, lng]);
                mapInstanceRef[0]?.setView([lat, lng]);
            }
        }
    }, [lat, lng]);

    return <div ref={mapContainerRef[1]} style={{ width: "100%", height: "100%" }} />;
};
