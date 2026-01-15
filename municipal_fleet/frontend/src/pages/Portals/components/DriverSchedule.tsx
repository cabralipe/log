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
            <div style={{ padding: '1rem' }}>
                <h3 className="dp-section-title" style={{ padding: '0 0 0.75rem' }}>Escalas do Dia</h3>

                {selectedDayAssignments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--dp-text-muted)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '3rem', display: 'block', marginBottom: '0.5rem', opacity: 0.5 }}>event_available</span>
                        <p>Nenhuma escala para este dia</p>
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
                                    <div className="dp-glass-card" style={{ margin: 0 }}>
                                        <div className="dp-glass-card__body">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                <div>
                                                    <span className={`dp-timeline__status ${assignment.status === 'CONFIRMED' ? 'dp-timeline__status--confirmed' : ''}`}>
                                                        {assignmentStatusLabel(assignment.status)}
                                                    </span>
                                                    <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', margin: '0.25rem 0 0' }}>
                                                        {formatPeriod(assignment)}
                                                    </p>
                                                </div>
                                                <div style={{
                                                    background: 'var(--dp-card-dark)',
                                                    padding: '0.5rem 0.75rem',
                                                    borderRadius: 'var(--dp-radius)',
                                                    fontFamily: 'monospace',
                                                    fontWeight: 700,
                                                    fontSize: '0.875rem',
                                                    border: '1px solid var(--dp-border)'
                                                }}>
                                                    {assignment.vehicle.license_plate}
                                                </div>
                                            </div>
                                            <div style={{ marginBottom: '0.75rem' }}>
                                                <p style={{ fontWeight: 500, color: 'var(--dp-text-muted)' }}>{assignment.route.name}</p>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--dp-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>location_on</span>
                                                    <span>{assignment.route.code}</span>
                                                </div>
                                            </div>
                                            <button className="dp-btn dp-btn--ghost" style={{ height: '40px', fontSize: '0.875rem' }}>
                                                Ver Detalhes
                                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>chevron_right</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Availability Section */}
            <div style={{ padding: '0 1rem', marginTop: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Disponibilidade</h3>
                <p style={{ color: 'var(--dp-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    Gerencie seus dias de folga e plantão.
                </p>

                {sortedBlocks.length > 0 ? (
                    <div className="dp-updates">
                        {sortedBlocks.map((block) => (
                            <div key={block.id} className="dp-update-item">
                                <div className={`dp-update-item__icon ${block.is_current ? 'dp-update-item__icon--success' : 'dp-update-item__icon--primary'}`}>
                                    <span className="material-symbols-outlined">{block.is_current ? 'event_busy' : 'schedule'}</span>
                                </div>
                                <div className="dp-update-item__content">
                                    <p className="dp-update-item__title">{block.type_label}</p>
                                    <p className="dp-update-item__desc">{formatBlockPeriod(block.start_datetime, block.end_datetime)}</p>
                                </div>
                                <span style={{
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '9999px',
                                    background: block.is_current ? 'rgba(34, 197, 94, 0.15)' : 'rgba(40, 122, 246, 0.15)',
                                    color: block.is_current ? 'var(--dp-success)' : 'var(--dp-primary)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    {block.is_current ? 'Ativo' : 'Agendado'}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="dp-glass-card" style={{ margin: 0, marginBottom: '2rem' }}>
                        <div className="dp-glass-card__body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <p style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Sinalizar Folga</p>
                                <p style={{ fontSize: '0.875rem', color: 'var(--dp-text-muted)' }}>Nenhum bloqueio ativo</p>
                            </div>
                            <button
                                type="button"
                                style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: 'var(--dp-radius)',
                                    background: 'var(--dp-primary)',
                                    border: 'none',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    boxShadow: '0 0 15px rgba(40, 122, 246, 0.5)'
                                }}
                            >
                                <span className="material-symbols-outlined">event_busy</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
