import React from "react";
import { Button } from "../../../components/Button";

type DriverHeaderProps = {
    driverName: string;
    setSidebarOpen: (open: boolean) => void;
    onLogout: () => void;
};

export const DriverHeader: React.FC<DriverHeaderProps> = ({
    driverName,
    setSidebarOpen,
    onLogout,
}) => {
    return (
        <header className="driver-header">
            <div className="driver-header-left">
                <button
                    className="driver-menu-toggle"
                    onClick={() => setSidebarOpen(true)}
                >
                    ☰
                </button>
                <div className="driver-logo">
                    <h1>Portal do Motorista</h1>
                </div>
            </div>
            <div className="driver-user-info">
                <span className="driver-name">Olá, {driverName}</span>
                <Button variant="ghost" size="sm" onClick={onLogout}>
                    Sair
                </Button>
            </div>
        </header>
    );
};
