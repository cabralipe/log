import React, { useMemo } from "react";
import "./DriverTrips.css";
import { TripPortal } from "../types";
import { statusLabel, formatDateTime } from "../utils";

type DriverTripsProps = {
    trips: TripPortal[];
    handleStartTrip: (tripId: number) => void;
    handleCompleteTrip: (tripId: number) => void;
    openIncidentModal: (trip: TripPortal) => void;
    setShowPassengersModal: (show: boolean) => void;
    completingTripIds: number[];
};

export const DriverTrips: React.FC<DriverTripsProps> = ({
    trips,
    handleStartTrip,
    handleCompleteTrip,
    openIncidentModal,
    setShowPassengersModal,
    completingTripIds,
}) => {
    const sortedTrips = useMemo(() => {
        return [...trips].sort((a, b) => {
            const aTime = new Date(a.departure_datetime).getTime();
            const bTime = new Date(b.departure_datetime).getTime();
            if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
            return aTime - bTime;
        });
    }, [trips]);

    const activeTrip = sortedTrips.find(t => t.status === "IN_PROGRESS");
    const plannedTrips = sortedTrips.filter(t => t.status === "PLANNED");
    const completedTrips = sortedTrips.filter(t => t.status === "COMPLETED");

    return (
        <div className="dp-trips fade-in">
            {/* Active Trip Section */}
            {activeTrip && (
                <div className="dp-trip-section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Viagem Ativa</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="dp-trips__live-dot"></span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dp-accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ao Vivo</span>
                        </div>
                    </div>

                    <div className="dp-trip-card" style={{ borderLeft: '4px solid var(--dp-accent)' }}>
                        <div className="dp-trip-card__route">
                            <span>{activeTrip.origin}</span>
                            <span className="material-symbols-outlined" style={{ color: 'var(--dp-accent)' }}>trending_flat</span>
                            <span>{activeTrip.destination}</span>
                        </div>
                        <div className="dp-trip-card__meta">
                            <div className="dp-trip-card__meta-item">
                                <span className="material-symbols-outlined">local_shipping</span>
                                <span>{activeTrip.vehicle__license_plate}</span>
                            </div>
                            <div className="dp-trip-card__meta-item">
                                <span className="material-symbols-outlined">schedule</span>
                                <span>{formatDateTime(activeTrip.departure_datetime)}</span>
                            </div>
                        </div>
                        <div className="dp-trip-card__actions">
                            <button
                                className="dp-btn dp-btn--primary"
                                onClick={() => handleCompleteTrip(activeTrip.id)}
                                disabled={completingTripIds.includes(activeTrip.id)}
                                style={{ flex: 1 }}
                            >
                                <span className="material-symbols-outlined">check_circle</span>
                                {completingTripIds.includes(activeTrip.id) ? "Finalizando..." : "Finalizar"}
                            </button>
                            <button
                                className="dp-btn dp-btn--danger"
                                onClick={() => openIncidentModal(activeTrip)}
                            >
                                <span className="material-symbols-outlined">report_problem</span>
                                Incidente
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Planned Trips Section */}
            {plannedTrips.length > 0 && (
                <div className="dp-trip-section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Próximas Viagens</h3>
                        <span className="dp-chip">{plannedTrips.length} restante{plannedTrips.length > 1 ? 's' : ''}</span>
                    </div>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {plannedTrips.map((trip) => (
                            <div key={trip.id} className="dp-trip-card">
                                <div className="dp-trip-card__route">
                                    <span>{trip.origin}</span>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--dp-muted)' }}>arrow_forward</span>
                                    <span>{trip.destination}</span>
                                </div>
                                <div className="dp-trip-card__meta">
                                    <div className="dp-trip-card__meta-item">
                                        <span className="material-symbols-outlined">local_shipping</span>
                                        <span>{trip.vehicle__license_plate}</span>
                                    </div>
                                    <div className="dp-trip-card__meta-item">
                                        <span className="material-symbols-outlined">schedule</span>
                                        <span>{formatDateTime(trip.departure_datetime)}</span>
                                    </div>
                                </div>
                                <button
                                    className="dp-btn dp-btn--ghost"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                    onClick={() => handleStartTrip(trip.id)}
                                    disabled={completingTripIds.includes(trip.id)}
                                >
                                    <span className="material-symbols-outlined">play_arrow</span>
                                    {completingTripIds.includes(trip.id) ? "Iniciando..." : "Iniciar Viagem"}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {sortedTrips.length === 0 && (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--dp-muted)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.3 }}>route</span>
                    <h3 style={{ marginBottom: '0.5rem' }}>Nenhuma viagem encontrada</h3>
                    <p>Suas viagens planejadas aparecerão aqui.</p>
                </div>
            )}
        </div>
    );
};
