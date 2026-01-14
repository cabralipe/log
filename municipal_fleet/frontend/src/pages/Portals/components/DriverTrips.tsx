import React, { useMemo } from "react";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { Table } from "../../../components/Table";
import { Button } from "../../../components/Button";
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
    const { isMobile } = useMediaQuery();

    const sortedTrips = useMemo(() => {
        return [...trips].sort((a, b) => {
            const aTime = new Date(a.departure_datetime).getTime();
            const bTime = new Date(b.departure_datetime).getTime();
            if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
            return aTime - bTime;
        });
    }, [trips]);

    const passengerTrips = useMemo(
        () => sortedTrips.filter((t) => (t.passengers_details?.length || 0) > 0),
        [sortedTrips]
    );

    const hasPassengers = passengerTrips.length > 0;

    // Render Trip Cards for Mobile
    const renderTripCards = () => (
        <div className="driver-portal__trips-grid">
            {sortedTrips.map((trip) => (
                <div key={trip.id} className="driver-portal__trip-card">
                    <div className="driver-portal__trip-route">
                        <span>{trip.origin}</span>
                        <span className="driver-portal__trip-route-arrow">→</span>
                        <span>{trip.destination}</span>
                    </div>
                    <div className="driver-portal__trip-meta">
                        <div className="driver-portal__trip-meta-item">
                            <span className="driver-portal__trip-meta-label">Status</span>
                            <span className="driver-portal__trip-meta-value">{statusLabel(trip.status)}</span>
                        </div>
                        <div className="driver-portal__trip-meta-item">
                            <span className="driver-portal__trip-meta-label">Saída</span>
                            <span className="driver-portal__trip-meta-value">{formatDateTime(trip.departure_datetime)}</span>
                        </div>
                        <div className="driver-portal__trip-meta-item">
                            <span className="driver-portal__trip-meta-label">Passageiros</span>
                            <span className="driver-portal__trip-meta-value">{trip.passengers_count}</span>
                        </div>
                        <div className="driver-portal__trip-meta-item">
                            <span className="driver-portal__trip-meta-label">Veículo</span>
                            <span className="driver-portal__trip-meta-value">{trip.vehicle__license_plate}</span>
                        </div>
                    </div>
                    <div className="driver-portal__trip-actions">
                        {trip.status === "PLANNED" && (
                            <Button
                                variant="primary"
                                size="sm"
                                type="button"
                                onClick={() => handleStartTrip(trip.id)}
                                disabled={completingTripIds.includes(trip.id)}
                            >
                                {completingTripIds.includes(trip.id) ? "Enviando..." : "Iniciar"}
                            </Button>
                        )}
                        {trip.status !== "COMPLETED" && (
                            <Button
                                variant="primary"
                                size="sm"
                                type="button"
                                onClick={() => handleCompleteTrip(trip.id)}
                                disabled={completingTripIds.includes(trip.id)}
                            >
                                {completingTripIds.includes(trip.id) ? "Enviando..." : "✓ Concluir"}
                            </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openIncidentModal(trip)}>
                            Relatar ocorrido
                        </Button>
                    </div>
                </div>
            ))}
            {sortedTrips.length === 0 && (
                <div className="driver-portal__empty">Nenhuma viagem encontrada.</div>
            )}
        </div>
    );

    return (
        <section id="viagens" className="driver-portal__section driver-portal__section--wide fade-in">
            <div className="driver-portal__section-header">
                <h3>Minhas viagens</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowPassengersModal(true)} disabled={!hasPassengers}>
                    Ver passageiros
                </Button>
            </div>
            {isMobile ? (
                renderTripCards()
            ) : (
                <Table
                    columns={[
                        { key: "origin", label: "Origem" },
                        { key: "destination", label: "Destino" },
                        { key: "category", label: "Categoria" },
                        { key: "status", label: "Status", render: (row) => statusLabel(row.status) },
                        { key: "departure_datetime", label: "Saída", render: (row) => formatDateTime(row.departure_datetime) },
                        { key: "passengers_count", label: "Pass." },
                        { key: "vehicle__license_plate", label: "Veículo" },
                        {
                            key: "actions",
                            label: "Ações",
                            render: (row) => (
                                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                                    {row.status === "PLANNED" && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            type="button"
                                            onClick={() => handleStartTrip(row.id)}
                                            disabled={completingTripIds.includes(row.id)}
                                        >
                                            {completingTripIds.includes(row.id) ? "..." : "Iniciar"}
                                        </Button>
                                    )}
                                    {row.status !== "COMPLETED" && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            type="button"
                                            onClick={() => handleCompleteTrip(row.id)}
                                            disabled={completingTripIds.includes(row.id)}
                                        >
                                            {completingTripIds.includes(row.id) ? "..." : "Concluir"}
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="sm" onClick={() => openIncidentModal(row)}>
                                        Ocorrência
                                    </Button>
                                </div>
                            ),
                        },
                    ]}
                    data={sortedTrips}
                />
            )}
            {!hasPassengers && <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>Nenhum passageiro cadastrado nas viagens.</p>}
        </section>
    );
};
