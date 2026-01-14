import React from "react";
import { Button } from "../../../components/Button";
import "./DriverModals.css";
import { TripPortal } from "../types";

type DriverIncidentModalProps = {
    trip: TripPortal | null;
    text: string;
    onTextChange: (text: string) => void;
    error: string | null;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
};

export const DriverIncidentModal: React.FC<DriverIncidentModalProps> = ({
    trip,
    text,
    onTextChange,
    error,
    onClose,
    onSubmit,
}) => {
    if (!trip) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>Relatar ocorrência</h3>
                <p>
                    Viagem: {trip.origin} → {trip.destination}
                </p>
                <form onSubmit={onSubmit}>
                    <textarea
                        value={text}
                        onChange={(e) => onTextChange(e.target.value)}
                        placeholder="Descreva o problema..."
                        rows={4}
                        required
                    />
                    {error && <div className="error">{error}</div>}
                    <div className="modal-actions">
                        <Button type="button" variant="ghost" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit">Enviar</Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
