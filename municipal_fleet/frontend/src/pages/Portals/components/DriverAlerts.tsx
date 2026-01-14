import React from "react";
import "./DriverAlerts.css";
import { DriverNotification } from "../types";
import { notificationTime } from "../utils";

type DriverAlertsProps = {
    notifications: DriverNotification[];
};

export const DriverAlerts: React.FC<DriverAlertsProps> = ({ notifications }) => {
    return (
        <section id="alertas" className="driver-portal__section fade-in">
            <div className="driver-portal__section-header">
                <h3>Alertas e lembretes</h3>
            </div>
            <div className="driver-portal__alerts-list">
                {notifications.map((notice) => (
                    <div key={notice.id} className={`driver-portal__alert-card ${notice.is_read ? "read" : ""}`}>
                        <div>
                            <strong>{notice.title}</strong>
                            <p>{notice.message}</p>
                        </div>
                        <span>{notificationTime(notice.created_at)}</span>
                    </div>
                ))}
                {notifications.length === 0 && (
                    <div className="driver-portal__empty">Nenhum alerta no momento.</div>
                )}
            </div>
        </section>
    );
};
