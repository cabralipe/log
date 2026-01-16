import React, { useMemo } from "react";
import "./DriverSchedule.css";
import { AssignmentPortal, AvailabilityBlockPortal } from "../types";
import { formatDateLabel, formatPeriod, assignmentStatusLabel, parseDateOnly, formatBlockPeriod } from "../utils";

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
    // Get current week days
    const weekDays = useMemo(() => {
        const days = [];
        const now = new Date();
        const start = new Date(now);
        const weekday = start.getDay();
        const diff = weekday === 0 ? -6 : 1 - weekday;
        start.setDate(start.getDate() + diff);

        for (let i = 0; i < 7; i++) {
            const day = new Date(start);
            day.setDate(start.getDate() + i);
            days.push({
                date: day,
                dayName: day.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
                dayNumber: day.getDate(),
                isToday: day.toDateString() === now.toDateString(),
            });
        }
        return days;
    }, []);

    const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());

    const sortedAssignments = useMemo(() => {
        return [...assignments].sort((a, b) => {
            const aDate = parseDateOnly(a.date).getTime();
            const bDate = parseDateOnly(b.date).getTime();
            return aDate - bDate;
        });
    }, [assignments]);

    const sortedBlocks = useMemo(() => {
        return [...availabilityBlocks].sort(
            (a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
        );
    }, [availabilityBlocks]);

    const selectedDayAssignments = useMemo(() => {
        return sortedAssignments.filter(a => {
            const assignDate = parseDateOnly(a.date);
            return assignDate.toDateString() === selectedDate.toDateString();
        });
    }, [sortedAssignments, selectedDate]);

    return (
        <div className="dp-schedule fade-in">
            {/* Calendar Strip */}
            <div className="dp-calendar-strip">
                {weekDays.map((day, idx) => (
                    <button
                        key={idx}
                        className={`dp-calendar-day ${day.isToday ? 'dp-calendar-day--today' : ''} ${day.date.toDateString() === selectedDate.toDateString() ? 'dp-calendar-day--selected' : ''}`}
                        onClick={() => setSelectedDate(day.date)}
                    >
                        <span className="dp-calendar-day__name">{day.dayName}</span>
                        <span className="dp-calendar-day__number">{day.dayNumber}</span>
                        {day.date.toDateString() === selectedDate.toDateString() && (
                            <span className="dp-calendar-day__dot"></span>
                        )}
                    </button>
                ))}
            </div>

            {/* Assignments for selected day */}
            <div style={{ padding: '0 1rem' }}>
                <h3 className="dp-section-title" style={{ padding: '0 0 1rem' }}>Escalas do Dia</h3>

                {selectedDayAssignments.length === 0 ? (
                    <div className="dp-glass-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: 'var(--dp-muted)', marginBottom: '1rem', display: 'block' }}>event_available</span>
                        <p style={{ color: 'var(--dp-muted)', fontWeight: 500 }}>Nenhuma escala para este dia</p>
                    </div>
                ) : (
                    <div className="dp-timeline">
                        {selectedDayAssignments.map((assignment) => (
                            <div key={assignment.id} className="dp-timeline__item">
                                <div className="dp-timeline__marker">
                                    <div className="dp-timeline__icon">
                                        <span className="material-symbols-outlined">local_shipping</span>
                                    </div>
                                </div>
                                <div className="dp-timeline__content">
                                    <div className="dp-glass-card" style={{ padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                            <div>
                                                <span className={`dp-timeline__status ${assignment.status === 'CONFIRMED' ? 'dp-timeline__status--confirmed' : ''}`}>
                                                    {assignmentStatusLabel(assignment.status)}
                                                </span>
                                                <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--dp-text)', margin: '0.5rem 0 0' }}>
                                                    {formatPeriod(assignment)}
                                                </p>
                                            </div>
                                            <div style={{
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                padding: '0.4rem 0.75rem',
                                                borderRadius: '8px',
                                                fontFamily: 'monospace',
                                                fontWeight: 700,
                                                fontSize: '0.9rem',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                color: 'var(--dp-accent)'
                                            }}>
                                                {assignment.vehicle.license_plate}
                                            </div>
                                        </div>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <p style={{ fontWeight: 600, color: 'var(--dp-text)', fontSize: '1rem', margin: 0 }}>{assignment.route.name}</p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--dp-muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>location_on</span>
                                                <span>{assignment.route.code}</span>
                                            </div>
                                        </div>
                                        <button className="dp-btn dp-btn--ghost" style={{ width: '100%', justifyContent: 'center' }}>
                                            Ver Detalhes
                                            <span className="material-symbols-outlined">chevron_right</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Availability Section */}
            <div style={{ padding: '0 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 className="dp-section-title" style={{ padding: 0 }}>Disponibilidade</h3>
                    <button className="dp-btn dp-btn--ghost" style={{ padding: '0.5rem' }}>
                        <span className="material-symbols-outlined" style={{ margin: 0 }}>add</span>
                    </button>
                </div>

                {sortedBlocks.length > 0 ? (
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {sortedBlocks.map((block) => (
                            <div key={block.id} className="dp-glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '12px',
                                    background: block.is_current ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: block.is_current ? 'var(--dp-accent)' : 'var(--dp-muted)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)'
                                }}>
                                    <span className="material-symbols-outlined">{block.is_current ? 'event_busy' : 'schedule'}</span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontWeight: 700, margin: 0, fontSize: '0.95rem' }}>{block.type_label}</p>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--dp-muted)', margin: '0.2rem 0 0' }}>{formatBlockPeriod(block.start_datetime, block.end_datetime)}</p>
                                </div>
                                <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '6px',
                                    background: block.is_current ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                    color: block.is_current ? 'var(--dp-accent)' : 'var(--dp-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    border: '1px solid rgba(255, 255, 255, 0.05)'
                                }}>
                                    {block.is_current ? 'Ativo' : 'Agendado'}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="dp-glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem' }}>
                        <div>
                            <p style={{ fontWeight: 700, margin: 0, fontSize: '1rem' }}>Sinalizar Folga</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--dp-muted)', margin: '0.25rem 0 0' }}>Nenhum bloqueio ativo</p>
                        </div>
                        <button
                            type="button"
                            className="dp-btn dp-btn--primary"
                            style={{ width: '48px', height: '48px', padding: 0, borderRadius: '14px', justifyContent: 'center' }}
                        >
                            <span className="material-symbols-outlined" style={{ margin: 0 }}>event_busy</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
