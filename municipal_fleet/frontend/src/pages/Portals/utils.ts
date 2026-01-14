import { AssignmentPortal, InspectionPortal } from "./types";

export const CHECKLIST_ITEMS = [
    { key: "pneus", label: "Pneus e calibragem" },
    { key: "freios", label: "Sistema de freios" },
    { key: "luzes", label: "Faróis, setas e lanternas" },
    { key: "oleo", label: "Nível de óleo" },
    { key: "agua", label: "Água do radiador" },
    { key: "sinalizacao", label: "Sinalização/triângulo" },
    { key: "limpeza", label: "Limpeza geral" },
    { key: "documentos", label: "Documentos obrigatórios" },
];


export const specialNeedLabel = (value?: string) => {
    switch (value) {
        case "TEA": return "TEA";
        case "ELDERLY": return "Idoso";
        case "PCD": return "Pessoa com deficiência";
        case "OTHER": return "Outra";
        default: return "Nenhuma";
    }
};

export const statusLabel = (value: string) => {
    switch (value) {
        case "PLANNED": return "Planejada";
        case "IN_PROGRESS": return "Em andamento";
        case "COMPLETED": return "Concluída";
        case "CANCELLED": return "Cancelada";
        default: return value;
    }
};

export const inspectionStatusLabel = (value: InspectionPortal["condition_status"]) =>
    value === "ATTENTION" ? "Atenção" : "Aprovado";

export const notificationTime = (value: string) => {
    const date = new Date(value);
    return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export const assignmentStatusLabel = (value: AssignmentPortal["status"]) => {
    switch (value) {
        case "DRAFT": return "Rascunho";
        case "CONFIRMED": return "Confirmado";
        case "CANCELLED": return "Cancelado";
        default: return value;
    }
};

export const parseDateOnly = (value: string) => new Date(`${value}T00:00:00`);

export const formatDateLabel = (value: string) =>
    parseDateOnly(value).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });

export const formatBlockPeriod = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const sameDay = startDate.toDateString() === endDate.toDateString();
    const dateLabel = startDate.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
    const startHour = startDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const endHour = endDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return sameDay
        ? `${dateLabel} · ${startHour} - ${endHour}`
        : `${startDate.toLocaleString("pt-BR")} - ${endDate.toLocaleString("pt-BR")}`;
};

export const formatPeriod = (assignment: AssignmentPortal) => {
    const trimTime = (timeValue?: string | null) => (timeValue ? timeValue.slice(0, 5) : "--:--");
    const start = assignment.period_start ? new Date(assignment.period_start) : null;
    const end = assignment.period_end ? new Date(assignment.period_end) : null;
    if (start && end) {
        const startLabel = start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const endLabel = end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        return `${startLabel} - ${endLabel}`;
    }
    if (start) return start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (assignment.route.time_window_start || assignment.route.time_window_end) {
        return `${trimTime(assignment.route.time_window_start)} - ${trimTime(assignment.route.time_window_end)}`;
    }
    return "Horário a definir";
};

export const formatDateTime = (value: string) => {
    const date = new Date(value);
    return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export const toInputDate = (value: Date) => value.toISOString().split("T")[0];
