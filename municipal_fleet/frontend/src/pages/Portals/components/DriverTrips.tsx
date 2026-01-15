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
                <>
                    <div style={{ padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Viagem Ativa</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <span className="dp-trips__live-dot"></span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--dp-success)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ao Vivo</span>
                        </div>
                    </div>

                    <div className="dp-trip-card" style={{ borderColor: 'rgba(34, 197, 94, 0.3)' }}>
                        <div className="dp-trip-card__body">
                            <div className="dp-trip-card__route">
                                <span>{activeTrip.origin}</span>
                                <span className="material-symbols-outlined">trending_flat</span>
                                <span>{activeTrip.destination}</span>
                            </div>
                            <div className="dp-trip-card__meta">
                                <div className="dp-trip-card__meta-item">
                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>local_shipping</span>
                                    <span>{activeTrip.vehicle__license_plate}</span>
                                </div>
                                <div className="dp-trip-card__meta-item">
                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>schedule</span>
                                    <span>{formatDateTime(activeTrip.departure_datetime)}</span>
                                </div>
                            </div>
                            <div className="dp-trip-card__actions">
                                <button
                                    className="dp-btn dp-btn--primary"
                                    onClick={() => handleCompleteTrip(activeTrip.id)}
                                    disabled={completingTripIds.includes(activeTrip.id)}
                                >
                                    <span className="material-symbols-outlined">check_circle</span>
                                    {completingTripIds.includes(activeTrip.id) ? "Finalizando..." : "Finalizar Viagem"}
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
                </>
            )}

            {/* Planned Trips Section */}
            {plannedTrips.length > 0 && (
                <>
                    <div style={{ padding: '1.5rem 1rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Próximas Viagens</h3>
                        <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            background: 'var(--dp-card-dark)',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '9999px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            color: 'var(--dp-text-muted)'
                        }}>
                            {plannedTrips.length} restante{plannedTrips.length > 1 ? 's' : ''}
                        </span>
                    </div>

                    {plannedTrips.map((trip) => (
                        <div key={trip.id} className="dp-trip-card">
                            <div className="dp-trip-card__body">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div>
                                        <div className="dp-trip-card__route" style={{ marginBottom: '0.5rem' }}>
                                            <span>{trip.origin}</span>
                                            <span className="material-symbols-outlined" style={{ color: 'var(--dp-text-muted)' }}>arrow_forward</span>
                                            <span>{trip.destination}</span>
                                        </div>
                                        <div className="dp-trip-card__meta">
                                            <div className="dp-trip-card__meta-item">
                                                <span>{trip.vehicle__license_plate}</span>
                                                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--dp-text-muted)' }}></span>
                                                <span>{formatDateTime(trip.departure_datetime)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ background: 'var(--dp-card-glass)', padding: '0.5rem', borderRadius: 'var(--dp-radius)' }}>
                                        <span className="material-symbols-outlined" style={{ color: 'var(--dp-text-muted)' }}>calendar_month</span>
                                    </div>
                                </div>
                                <button
                                    className="dp-btn dp-btn--success"
                                    onClick={() => handleStartTrip(trip.id)}
                                    disabled={completingTripIds.includes(trip.id)}
                                >
                                    <span className="material-symbols-outlined">play_arrow</span>
                                    {completingTripIds.includes(trip.id) ? "Iniciando..." : "Iniciar Viagem"}
                                </button>
                            </div>
                        </div>
                    ))}
                </>
            )}

            {/* Empty State */}
            {sortedTrips.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--dp-text-muted)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '4rem', marginBottom: '1rem', display: 'block', opacity: 0.5 }}>route</span>
                    <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Nenhuma viagem encontrada</p>
                    <p style={{ fontSize: '0.875rem' }}>Suas viagens aparecerão aqui</p>
                </div>
            )}
        </div>
    );
};
