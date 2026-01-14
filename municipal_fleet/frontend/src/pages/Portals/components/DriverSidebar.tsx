import React from "react";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import "./DriverSidebar.css";

type DriverSidebarProps = {
    activeSection: string;
    setActiveSection: (section: string) => void;
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
};

const NAV_ITEMS = [
    { id: "rastreamento", label: "Rastreamento", icon: "📍" },
    { id: "agenda", label: "Agenda", icon: "📅" },
    { id: "viagem-livre", label: "Viagem Livre", icon: "🚗" },
    { id: "escala", label: "Escala", icon: "📋" },
    { id: "viagens", label: "Minhas Viagens", icon: "🛣️" },
    { id: "alertas", label: "Alertas", icon: "🔔" },
    { id: "inspecao", label: "Checklist Diário", icon: "✅" },
    { id: "abastecimento", label: "Abastecimento", icon: "⛽" },
];

export const DriverSidebar: React.FC<DriverSidebarProps> = ({
    activeSection,
    setActiveSection,
    sidebarOpen,
    setSidebarOpen,
}) => {
    const { isMobile } = useMediaQuery();

    return (
        <>
            {/* Overlay for mobile */}
            {isMobile && sidebarOpen && (
                <div
                    className="driver-sidebar-overlay"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside className={`driver-sidebar ${sidebarOpen ? "open" : ""}`}>
                <div className="driver-sidebar-header">
                    <h2>Menu</h2>
                    {isMobile && (
                        <button
                            className="driver-sidebar-close"
                            onClick={() => setSidebarOpen(false)}
                        >
                            ✕
                        </button>
                    )}
                </div>
                <nav className="driver-sidebar-nav">
                    {NAV_ITEMS.map((item) => (
                        <button
                            key={item.id}
                            className={`driver-nav-item ${activeSection === item.id ? "active" : ""
                                }`}
                            onClick={() => {
                                setActiveSection(item.id);
                                if (isMobile) setSidebarOpen(false);
                            }}
                        >
                            <span className="driver-nav-icon">{item.icon}</span>
                            <span className="driver-nav-label">{item.label}</span>
                        </button>
                    ))}
                </nav>
            </aside>
        </>
    );
};
