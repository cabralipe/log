import React from "react";
import { Button } from "../../../components/Button";
import "./DriverModals.css";
import { TripPortal } from "../types";

type DriverPassengersModalProps = {
    isOpen: boolean;
    onClose: () => void;
    trips: TripPortal[];
};

export const DriverPassengersModal: React.FC<DriverPassengersModalProps> = ({
    isOpen,
    onClose,
    trips,
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: "600px" }}>
                <h3>Lista de Passageiros</h3>
                <div className="driver-portal__passengers-list">
                    {trips
                        .filter((t) => (t.passengers_details?.length || 0) > 0)
                        .map((trip) => (
                            <div key={trip.id} className="driver-portal__passenger-group">
                                <h4>
                                    {trip.origin} → {trip.destination}
                                </h4>
                                <ul>
                                    {trip.passengers_details?.map((p, idx) => (
                                        <li key={idx}>
                                            <strong>{p.name}</strong>
                                            {p.special_need && <span className="tag">{p.special_need}</span>}
                                            {p.observation && <p className="note">{p.observation}</p>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                </div>
                <div className="modal-actions">
                    <Button onClick={onClose}>Fechar</Button>
                </div>
            </div>
        </div>
    );
};
