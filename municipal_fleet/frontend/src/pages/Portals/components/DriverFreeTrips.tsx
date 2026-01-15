import React from "react";
import { FreeTripListPortal, PortalVehicle } from "../types";
import "./DriverFreeTrips.css";

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

    // Calculate elapsed time if trip is active
    const getElapsedTime = () => {
        if (!freeTrips?.open_trip?.started_at) return "00:00:00";
        const start = new Date(freeTrips.open_trip.started_at).getTime();
        const now = Date.now();
        const diff = now - start;
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // If there's an active trip, show the "in progress" view
    if (freeTrips?.open_trip) {
        return (
            <div className="dp-free-trip fade-in">
                {/* Status Header */}
                <div className="dp-free-trip__status-header">
                    <div className="dp-free-trip__status-indicator">
                        <span className="dp-free-trip__pulse"></span>
                        <span className="dp-free-trip__status-text">Em Andamento</span>
                    </div>
                </div>

                {/* Timer */}
                <div className="dp-timer">
                    <p className="dp-timer__label">Tempo de Viagem</p>
                    <p className="dp-timer__value">{getElapsedTime()}</p>
                </div>

                {freeTripError && <div className="dp-alert dp-alert--error">{freeTripError}</div>}

                {/* Vehicle Info Card */}
                <div className="dp-glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ background: 'rgba(74, 222, 128, 0.1)', padding: '0.75rem', borderRadius: '12px' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--dp-accent)' }}>local_shipping</span>
                            </div>
                            <div>
                                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dp-muted)', textTransform: 'uppercase', margin: 0 }}>Veículo</p>
                                <p style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{freeTrips.open_trip.vehicle_plate}</p>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dp-muted)', textTransform: 'uppercase', margin: 0 }}>KM Inicial</p>
                            <p style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, fontFamily: 'monospace' }}>{freeTrips.open_trip.odometer_start}</p>
                        </div>
                    </div>
                </div>

                {/* Odometer Input */}
                <div className="dp-glass-card">
                    <div className="dp-form-group">
                        <label className="dp-form-label">KM Atual / Final</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="number"
                                className="dp-input"
                                style={{ fontSize: '1.5rem', padding: '1rem' }}
                                placeholder="000.000"
                                value={freeTripClose.odometer_end}
                                onChange={(e) => setFreeTripClose((f) => ({ ...f, odometer_end: e.target.value }))}
                            />
                            <span style={{
                                position: 'absolute',
                                right: '1rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--dp-muted)',
                                fontWeight: 700
                            }}>KM</span>
                        </div>
                    </div>
                </div>

                {/* Report Incident Button */}
                <button
                    className="dp-btn dp-btn--ghost"
                    style={{ width: '100%', color: 'var(--dp-danger)' }}
                    onClick={reportFreeTripIncident}
                >
                    <span className="material-symbols-outlined">report_problem</span>
                    Reportar Incidente
                </button>

                {/* Fixed Bottom Action */}
                <div className="dp-bottom-action">
                    <button
                        className="dp-btn dp-btn--primary"
                        style={{ width: '100%', padding: '1.25rem', fontSize: '1.1rem' }}
                        onClick={closeFreeTrip}
                        disabled={!freeTripClose.odometer_end}
                    >
                        <span className="material-symbols-outlined">check_circle</span>
                        FINALIZAR VIAGEM AVULSA
                    </button>
                </div>
            </div>
        );
    }

    // Start a new trip view
    return (
        <div className="dp-free-trip fade-in">
            {freeTripError && <div className="dp-alert dp-alert--error">{freeTripError}</div>}

            {/* Vehicle Selection Card */}
            <div className="dp-glass-card">
                <div className="dp-form-group">
                    <label className="dp-form-label">Veículo</label>
                    <select
                        className="dp-input"
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
                        <option value="">Selecionar Veículo</option>
                        {freeTripVehicles.map((v) => (
                            <option key={v.id} value={v.id}>
                                {v.license_plate} {v.brand || v.model ? `— ${v.brand || ""} ${v.model || ""}` : ""}
                            </option>
                        ))}
                    </select>
                </div>

                {freeTripStart.vehicle_id && (
                    <div className="dp-form-group" style={{ marginTop: '1rem' }}>
                        <label className="dp-form-label">Odômetro Inicial (Km)</label>
                        <input
                            type="text"
                            className="dp-input"
                            value={freeTripStart.odometer_start}
                            readOnly
                            style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--dp-accent)' }}
                        />
                    </div>
                )}
            </div>

            {/* Photo Upload */}
            <div className="dp-glass-card">
                <label className="dp-form-label">Foto do Painel (opcional)</label>
                <label className="dp-file-upload" style={{ marginTop: '0.5rem' }}>
                    <div className="dp-file-upload__icon">
                        <span className="material-symbols-outlined">add_a_photo</span>
                    </div>
                    <div className="dp-file-upload__text">
                        <p className="dp-file-upload__title">
                            {freeTripStart.photo ? freeTripStart.photo.name : 'Tirar Foto'}
                        </p>
                        <p className="dp-file-upload__hint">
                            {freeTripStart.photo ? 'Toque para trocar' : 'Toque para abrir a câmera'}
                        </p>
                    </div>
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: 'none' }}
                        onChange={(e) => setFreeTripStart((f) => ({ ...f, photo: e.target.files?.[0] || null }))}
                    />
                </label>
            </div>

            {/* Fixed Bottom Action */}
            <div className="dp-bottom-action">
                <button
                    className="dp-btn dp-btn--primary"
                    style={{ width: '100%', padding: '1.25rem', fontSize: '1.1rem' }}
                    onClick={startFreeTrip}
                    disabled={!freeTripStart.vehicle_id || freeTripStart.odometer_start === ""}
                >
                    <span className="material-symbols-outlined">play_arrow</span>
                    INICIAR VIAGEM AVULSA
                </button>
            </div>

            {/* Recent Closed Trips */}
            {freeTrips?.recent_closed?.length ? (
                <div style={{ marginTop: '1rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Últimas Encerradas</h3>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {freeTrips.recent_closed.map((ft) => (
                            <div key={ft.id} className="dp-glass-card" style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ color: 'var(--dp-accent)' }}>
                                            <span className="material-symbols-outlined">check_circle</span>
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: 700, margin: 0 }}>{ft.vehicle_plate}</p>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--dp-muted)', margin: 0 }}>{ft.odometer_start} → {ft.odometer_end ?? "—"} km</p>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontWeight: 700, color: 'var(--dp-accent)', margin: 0 }}>{ft.distance ?? "—"} km</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--dp-muted)', margin: 0 }}>Percorrido</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
};
