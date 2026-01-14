import React, { useMemo } from "react";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { Table } from "../../../components/Table";
import { Button } from "../../../components/Button";
import "./DriverSchedule.css";
import { AssignmentPortal, AvailabilityBlockPortal } from "../types";
import {
    formatDateLabel,
    formatPeriod,
    assignmentStatusLabel,
    parseDateOnly,
    formatBlockPeriod,
} from "../utils";

type DriverScheduleProps = {
    assignments: AssignmentPortal[];
    availabilityBlocks: AvailabilityBlockPortal[];
    loadAvailabilityBlocks: () => void;
};

export const DriverSchedule: React.FC<DriverScheduleProps> = ({
    assignments,
    availabilityBlocks,
    loadAvailabilityBlocks,
}) => {
    const { isMobile } = useMediaQuery();

    const sortedAssignments = useMemo(() => {
        return [...assignments].sort((a, b) => {
            const aDate = parseDateOnly(a.date).getTime();
            const bDate = parseDateOnly(b.date).getTime();
            if (aDate === bDate) {
                const aStart = a.period_start ? new Date(a.period_start).getTime() : 0;
                const bStart = b.period_start ? new Date(b.period_start).getTime() : 0;
                return aStart - bStart;
            }
            return aDate - bDate;
        });
    }, [assignments]);

    const sortedBlocks = useMemo(() => {
        return [...availabilityBlocks].sort(
            (a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
        );
    }, [availabilityBlocks]);

    const thisWeekAssignments = useMemo(() => {
        const now = new Date();
        const start = new Date(now);
        const weekday = start.getDay();
        const diff = weekday === 0 ? -6 : 1 - weekday;
        start.setDate(start.getDate() + diff);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return sortedAssignments.filter((a) => {
            const dateValue = parseDateOnly(a.date);
            return dateValue >= start && dateValue <= end;
        });
    }, [sortedAssignments]);

    const thisMonthAssignments = useMemo(() => {
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();
        const monthData = sortedAssignments.filter((a) => {
            const dateValue = parseDateOnly(a.date);
            return dateValue.getMonth() === month && dateValue.getFullYear() === year;
        });
        return monthData.length ? monthData : sortedAssignments;
    }, [sortedAssignments]);

    return (
        <section id="escala" className="driver-portal__section driver-portal__section--wide fade-in">
            {/* Availability Blocks Section */}
            <div className="driver-portal__section-header">
                <div>
                    <span className="eyebrow">Agenda</span>
                    <h3>Bloqueios e folgas</h3>
                    <p>Se houver uma folga, férias ou afastamento ativo, novas viagens serão bloqueadas automaticamente.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={loadAvailabilityBlocks}>Atualizar</Button>
            </div>
            {sortedBlocks.length > 0 ? (
                <div className="driver-portal__blocks-grid">
                    {sortedBlocks.map((block) => (
                        <div
                            key={block.id}
                            className={`driver-portal__block-card ${block.is_current ? "driver-portal__block-card--active" : ""}`}
                        >
                            <div className="driver-portal__block-header">
                                <strong>{block.type_label}</strong>
                                <span className={`driver-portal__block-badge ${block.is_current ? "driver-portal__block-badge--active" : "driver-portal__block-badge--scheduled"}`}>
                                    {block.is_current ? "Em vigor" : "Agendado"}
                                </span>
                            </div>
                            <div style={{ color: "var(--muted)" }}>{formatBlockPeriod(block.start_datetime, block.end_datetime)}</div>
                            {block.reason && <p style={{ color: "var(--muted)", marginTop: "0.35rem", marginBottom: 0 }}>{block.reason}</p>}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="driver-portal__empty">Nenhum bloqueio ativo ou agendado.</div>
            )}

            {/* Schedule Section */}
            <div className="driver-portal__section-header" style={{ marginTop: "2rem" }}>
                <div>
                    <h3>Escala do planejamento</h3>
                    <p>Integração com o planejador de viagens para que você veja a rotina da semana e do mês.</p>
                </div>
            </div>
            <div className="driver-portal__schedule-grid">
                <div className="driver-portal__week-panel">
                    <h4>Semana atual</h4>
                    {thisWeekAssignments.length === 0 ? (
                        <div className="driver-portal__empty">Nenhuma escala cadastrada para esta semana.</div>
                    ) : (
                        <div className="driver-portal__assignments-list">
                            {thisWeekAssignments.map((assignment) => (
                                <div key={assignment.id} className="driver-portal__assignment-card">
                                    <div className="driver-portal__assignment-card-header">
                                        <div>
                                            <div className="driver-portal__assignment-date">{formatDateLabel(assignment.date)}</div>
                                            <div className="driver-portal__assignment-route">
                                                {assignment.route.code} · {assignment.route.name}
                                            </div>
                                            <div className="driver-portal__assignment-vehicle">
                                                Veículo {assignment.vehicle.license_plate}
                                            </div>
                                            {assignment.route.service_name && (
                                                <div className="driver-portal__assignment-vehicle">{assignment.route.service_name}</div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: isMobile ? "left" : "right" }}>
                                            <div className="driver-portal__assignment-time">{formatPeriod(assignment)}</div>
                                            <span className={`driver-portal__assignment-status ${assignment.status === "CONFIRMED" ? "driver-portal__assignment-status--confirmed" : "driver-portal__assignment-status--draft"}`}>
                                                {assignmentStatusLabel(assignment.status)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="driver-portal__month-panel">
                    <h4>Agenda do mês</h4>
                    {isMobile ? (
                        <div className="driver-portal__assignments-list">
                            {thisMonthAssignments.slice(0, 10).map((assignment) => (
                                <div key={assignment.id} className="driver-portal__assignment-card">
                                    <div className="driver-portal__assignment-date">{formatDateLabel(assignment.date)}</div>
                                    <div className="driver-portal__assignment-route">
                                        {assignment.route.code} — {assignment.route.name}
                                    </div>
                                    <div className="driver-portal__assignment-time">{formatPeriod(assignment)}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <Table
                            columns={[
                                { key: "date", label: "Data", render: (row) => formatDateLabel(row.date) },
                                { key: "period_start", label: "Horário", render: (row) => formatPeriod(row) },
                                { key: "route", label: "Rota", render: (row) => `${row.route.code} — ${row.route.name}` },
                                { key: "service", label: "Serviço", render: (row) => row.route.service_name || "—" },
                                { key: "vehicle", label: "Veículo", render: (row) => row.vehicle.license_plate },
                                { key: "status", label: "Status", render: (row) => assignmentStatusLabel(row.status) },
                            ]}
                            data={thisMonthAssignments}
                        />
                    )}
                </div>
            </div>
        </section>
    );
};
