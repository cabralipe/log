import React from "react";
import { Button } from "../../../components/Button";
import "./DriverTracking.css";

type DriverTrackingProps = {
    trackingEnabled: boolean;
    setTrackingEnabled: (enabled: boolean) => void;
    trackingError: string | null;
    trackingInfo: string | null;
    trackingLastPing: string | null;
};

export const DriverTracking: React.FC<DriverTrackingProps> = ({
    trackingEnabled,
    setTrackingEnabled,
    trackingError,
    trackingInfo,
    trackingLastPing,
}) => {
    return (
        <div className="driver-section fade-in">
            <h2>Rastreamento em Tempo Real</h2>
            <div className="driver-card tracking-card">
                <div className="tracking-status">
                    <div
                        className={`status-indicator ${trackingEnabled ? "active" : "inactive"
                            }`}
                    />
                    <span>
                        {trackingEnabled ? "Rastreamento Ativo" : "Rastreamento Pausado"}
                    </span>
                </div>

                {trackingError && (
                    <div className="tracking-message error">{trackingError}</div>
                )}

                {trackingInfo && (
                    <div className="tracking-message info">{trackingInfo}</div>
                )}

                {trackingLastPing && (
                    <div className="tracking-last-ping">
                        Última atualização: {trackingLastPing}
                    </div>
                )}

                <div className="tracking-actions">
                    <Button
                        variant={trackingEnabled ? "ghost" : "primary"}
                        onClick={() => setTrackingEnabled(!trackingEnabled)}
                        className="full-width"
                    >
                        {trackingEnabled ? "Parar Rastreamento" : "Iniciar Rastreamento"}
                    </Button>
                </div>

                <p className="tracking-note">
                    Mantenha esta tela aberta ou o navegador em segundo plano para garantir
                    o envio da localização durante suas viagens.
                </p>
            </div>
        </div>
    );
};
