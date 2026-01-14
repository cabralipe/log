import React from "react";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { Table } from "../../../components/Table";
import { Button } from "../../../components/Button";
import "./DriverFreeTrips.css";
import { FreeTripListPortal, PortalVehicle } from "../types";

type DriverFreeTripsProps = {
    freeTrips: FreeTripListPortal | null;
    freeTripVehicles: PortalVehicle[];
    freeTripStart: { vehicle_id: number | ""; odometer_start: string; photo: File | null };
    setFreeTripStart: React.Dispatch<React.SetStateAction<{ vehicle_id: number | ""; odometer_start: string; photo: File | null }>>;
    startFreeTrip: () => void;
    freeTripClose: { odometer_end: string; photo: File | null; incident: string };
    setFreeTripClose: React.Dispatch<React.SetStateAction<{ odometer_end: string; photo: File | null; incident: string }>>;
    closeFreeTrip: () => void;
    reportFreeTripIncident: () => void;
    freeTripError: string | null;
    loadFreeTrips: () => void;
    loadPortalVehicles: () => void;
};

export const DriverFreeTrips: React.FC<DriverFreeTripsProps> = ({
    freeTrips,
    freeTripVehicles,
    freeTripStart,
    setFreeTripStart,
    startFreeTrip,
    freeTripClose,
    setFreeTripClose,
    closeFreeTrip,
    reportFreeTripIncident,
    freeTripError,
    loadFreeTrips,
    loadPortalVehicles,
}) => {
    const { isMobile } = useMediaQuery();

    return (
        <section id="viagem-livre" className="driver-portal__section fade-in">
            <div className="driver-portal__section-header">
                <div>
                    <h3>Viagem livre</h3>
                    <p>Registre qual veículo está usando, quilometragem inicial/final e trocas durante o dia.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { loadFreeTrips(); loadPortalVehicles(); }}>Atualizar</Button>
            </div>

            {freeTripError && <div className="driver-portal__alert driver-portal__alert--error">{freeTripError}</div>}

            {!freeTrips?.open_trip ? (
                <div className="driver-portal__free-trip-form">
                    <select
                        value={freeTripStart.vehicle_id}
                        onChange={(e) => {
                            const value = e.target.value;
                            const vehicleId = value ? Number(value) : "";
                            const selectedVehicle = typeof vehicleId === "number" ? freeTripVehicles.find((v) => v.id === vehicleId) : undefined;
                            const initialOdometer = selectedVehicle
                                ? selectedVehicle.odometer_current ?? selectedVehicle.odometer_initial ?? ""
                                : "";
                            setFreeTripStart((f) => ({
                                ...f,
                                vehicle_id: vehicleId,
                                odometer_start: initialOdometer === "" ? "" : String(initialOdometer),
                            }));
                        }}
                    >
                        <option value="">Selecione o veículo</option>
                        {freeTripVehicles.map((v) => (
                            <option key={v.id} value={v.id}>
                                {v.license_plate} {v.brand || v.model ? `— ${v.brand || ""} ${v.model || ""}` : ""}
                            </option>
                        ))}
                    </select>
                    <label>
                        Odômetro inicial
                        <input type="number" placeholder="Km" value={freeTripStart.odometer_start} readOnly />
                    </label>
                    <label>
                        Foto do painel (opcional)
                        <input type="file" accept="image/*" onChange={(e) => setFreeTripStart((f) => ({ ...f, photo: e.target.files?.[0] || null }))} />
                    </label>
                    <Button onClick={startFreeTrip} disabled={!freeTripStart.vehicle_id || freeTripStart.odometer_start === ""} fullWidth>
                        Iniciar viagem livre
                    </Button>
                </div>
            ) : (
                <>
                    <div className="driver-portal__free-trip-status">
                        <div className="stat-item">
                            <span className="stat-label">Veículo</span>
                            <span className="stat-value">{freeTrips.open_trip.vehicle_plate}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Início</span>
                            <span className="stat-value">{new Date(freeTrips.open_trip.started_at).toLocaleString("pt-BR")}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">KM inicial</span>
                            <span className="stat-value">{freeTrips.open_trip.odometer_start}</span>
                        </div>
                    </div>
                    <div className="driver-portal__free-trip-form">
                        <label>
                            Odômetro final
                            <input
                                type="number"
                                placeholder="Km final"
                                value={freeTripClose.odometer_end}
                                onChange={(e) => setFreeTripClose((f) => ({ ...f, odometer_end: e.target.value }))}
                            />
                        </label>
                        <label>
                            Foto do painel (opcional)
                            <input type="file" accept="image/*" onChange={(e) => setFreeTripClose((f) => ({ ...f, photo: e.target.files?.[0] || null }))} />
                        </label>
                        <label className="full-width">
                            Relatar ocorrência (opcional)
                            <textarea
                                rows={2}
                                placeholder="Descreva o ocorrido..."
                                value={freeTripClose.incident}
                                onChange={(e) => setFreeTripClose((f) => ({ ...f, incident: e.target.value }))}
                            />
                        </label>
                        <div className="driver-portal__free-trip-actions full-width">
                            <Button onClick={closeFreeTrip} disabled={!freeTripClose.odometer_end}>
                                Encerrar viagem
                            </Button>
                            <Button variant="ghost" onClick={reportFreeTripIncident} disabled={!freeTripClose.incident.trim()}>
                                Registrar ocorrência
                            </Button>
                        </div>
                    </div>
                </>
            )}

            {freeTrips?.recent_closed?.length ? (
                <div style={{ marginTop: "1rem" }}>
                    <h4 style={{ margin: "0 0 0.5rem", color: "var(--muted)", fontSize: "0.9rem" }}>Últimas encerradas</h4>
                    {isMobile ? (
                        <div className="driver-portal__fuel-cards">
                            {freeTrips.recent_closed.map((ft) => (
                                <div key={ft.id} className="driver-portal__fuel-card">
                                    <div className="driver-portal__fuel-card-info">
                                        <div className="driver-portal__fuel-card-station">{ft.vehicle_plate}</div>
                                        <div className="driver-portal__fuel-card-details">
                                            {ft.odometer_start} → {ft.odometer_end ?? "—"} km
                                        </div>
                                    </div>
                                    <div className="driver-portal__fuel-card-liters">{ft.distance ?? "—"} km</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <Table
                            columns={[
                                { key: "vehicle_plate", label: "Veículo" },
                                { key: "odometer_start", label: "KM inicial" },
                                { key: "odometer_end", label: "KM final" },
                                { key: "distance", label: "Rodado", render: (row) => row.distance ?? "—" },
                                { key: "ended_at", label: "Fim", render: (row) => new Date(row.ended_at || "").toLocaleString("pt-BR") },
                            ]}
                            data={freeTrips.recent_closed}
                        />
                    )}
                </div>
            ) : null}
        </section>
    );
};
