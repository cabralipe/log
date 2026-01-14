import React, { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { Table } from "../../../components/Table";
import { Button } from "../../../components/Button";
import "./DriverInspection.css";
import { InspectionPortal, InspectionChecklistItem, PortalVehicle } from "../types";
import { formatDateLabel, inspectionStatusLabel, toInputDate } from "../utils";

type DriverInspectionProps = {
    inspections: InspectionPortal[];
    inspectionForm: {
        vehicle: number | "";
        inspection_date: string;
        odometer: string;
        notes: string;
        signature_name: string;
        damage_photos: File[];
    };
    setInspectionForm: React.Dispatch<React.SetStateAction<{
        vehicle: number | "";
        inspection_date: string;
        odometer: string;
        notes: string;
        signature_name: string;
        damage_photos: File[];
    }>>;
    inspectionChecklist: InspectionChecklistItem[];
    updateChecklistStatus: (key: string, status: "OK" | "ISSUE") => void;
    updateChecklistNote: (key: string, note: string) => void;
    handleInspectionSubmit: (e: React.FormEvent, signatureDataUrl: string) => void;
    availableVehicles: { id: number; plate: string }[];
};

export const DriverInspection: React.FC<DriverInspectionProps> = ({
    inspections,
    inspectionForm,
    setInspectionForm,
    inspectionChecklist,
    updateChecklistStatus,
    updateChecklistNote,
    handleInspectionSubmit,
    availableVehicles,
}) => {
    const { isMobile } = useMediaQuery();
    const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const signatureDrawingRef = useRef(false);
    const signatureLastPosRef = useRef<{ x: number; y: number } | null>(null);
    const [signatureDataUrl, setSignatureDataUrl] = useState<string>("");

    const resizeSignatureCanvas = () => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;
        const ratio = window.devicePixelRatio || 1;
        const { width, height } = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.floor(width * ratio));
        canvas.height = Math.max(1, Math.floor(height * ratio));
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.scale(ratio, ratio);
            ctx.lineWidth = 2.2;
            ctx.lineCap = "round";
            ctx.strokeStyle = "#e2e8f0";
        }
    };

    const clearSignature = () => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureDataUrl("");
    };

    const saveSignature = () => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;
        const dataUrl = canvas.toDataURL("image/png");
        setSignatureDataUrl(dataUrl);
    };

    useEffect(() => {
        resizeSignatureCanvas();
        const handleResize = () => resizeSignatureCanvas();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = event.currentTarget;
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const handleSignaturePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = event.currentTarget;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        signatureDrawingRef.current = true;
        signatureLastPosRef.current = getCanvasPoint(event);
        canvas.setPointerCapture(event.pointerId);
    };

    const handleSignaturePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!signatureDrawingRef.current) return;
        const canvas = event.currentTarget;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const current = getCanvasPoint(event);
        const last = signatureLastPosRef.current || current;
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(current.x, current.y);
        ctx.stroke();
        signatureLastPosRef.current = current;
    };

    const handleSignaturePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!signatureDrawingRef.current) return;
        signatureDrawingRef.current = false;
        signatureLastPosRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        saveSignature();
    };

    const onSubmit = (e: React.FormEvent) => {
        handleInspectionSubmit(e, signatureDataUrl);
        if (signatureDataUrl) {
            clearSignature();
        }
    };

    const renderInspectionCards = () => (
        <div className="driver-portal__inspection-cards">
            {inspections.map((inspection) => (
                <div key={inspection.id} className="driver-portal__inspection-card">
                    <div className="driver-portal__inspection-card-header">
                        <div>
                            <div className="driver-portal__inspection-card-title">{inspection.vehicle_plate || "Veículo"}</div>
                            <div className="driver-portal__inspection-card-meta">
                                {formatDateLabel(inspection.inspection_date)} · {inspectionStatusLabel(inspection.condition_status)}
                            </div>
                        </div>
                        <span className={`driver-portal__inspection-pill ${inspection.condition_status === "ATTENTION" ? "danger" : ""}`}>
                            {inspectionStatusLabel(inspection.condition_status)}
                        </span>
                    </div>
                    {inspection.notes && <div className="driver-portal__inspection-card-notes">{inspection.notes}</div>}
                    <div className="driver-portal__inspection-card-links">
                        {inspection.signature_image && (
                            <a href={inspection.signature_image} target="_blank" rel="noopener noreferrer">Assinatura</a>
                        )}
                        {inspection.damage_photos?.length > 0 && (
                            <span>{inspection.damage_photos.length} avaria(s)</span>
                        )}
                    </div>
                </div>
            ))}
            {inspections.length === 0 && (
                <div className="driver-portal__empty">Nenhum checklist registrado.</div>
            )}
        </div>
    );

    return (
        <section id="inspecao" className="driver-portal__section fade-in">
            <div className="driver-portal__section-header">
                <h3>Checklist diário do veículo</h3>
            </div>
            <form className="driver-portal__inspection-form" onSubmit={onSubmit}>
                <select
                    value={inspectionForm.vehicle}
                    onChange={(e) => setInspectionForm((prev) => ({ ...prev, vehicle: Number(e.target.value) }))}
                    required
                >
                    <option value="">Veículo</option>
                    {availableVehicles.map((v) => (
                        <option key={v.id} value={v.id}>{v.plate}</option>
                    ))}
                </select>
                <label>
                    Data da inspeção
                    <input
                        type="date"
                        value={inspectionForm.inspection_date}
                        onChange={(e) => setInspectionForm((prev) => ({ ...prev, inspection_date: e.target.value }))}
                        required
                    />
                </label>
                <label>
                    Odômetro atual (opcional)
                    <input
                        type="number"
                        placeholder="0"
                        value={inspectionForm.odometer}
                        onChange={(e) => setInspectionForm((prev) => ({ ...prev, odometer: e.target.value }))}
                    />
                </label>
                <div className="driver-portal__inspection-checklist full-width">
                    <h4>Checklist</h4>
                    {inspectionChecklist.map((item) => (
                        <div key={item.key} className="driver-portal__inspection-item">
                            <span>{item.label}</span>
                            <select
                                value={item.status}
                                onChange={(e) => updateChecklistStatus(item.key, e.target.value as "OK" | "ISSUE")}
                            >
                                <option value="OK">Ok</option>
                                <option value="ISSUE">Problema</option>
                            </select>
                            {item.status === "ISSUE" && (
                                <input
                                    type="text"
                                    placeholder="Descreva o problema"
                                    value={item.note || ""}
                                    onChange={(e) => updateChecklistNote(item.key, e.target.value)}
                                />
                            )}
                        </div>
                    ))}
                </div>
                <label className="full-width">
                    Observações gerais
                    <textarea
                        placeholder="Observações adicionais"
                        value={inspectionForm.notes}
                        onChange={(e) => setInspectionForm((prev) => ({ ...prev, notes: e.target.value }))}
                        rows={2}
                    />
                </label>
                <label>
                    Registro fotográfico de avarias
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) =>
                            setInspectionForm((prev) => ({ ...prev, damage_photos: Array.from(e.target.files || []) }))
                        }
                    />
                </label>
                <label>
                    Nome (assinatura)
                    <input
                        type="text"
                        placeholder="Seu nome"
                        value={inspectionForm.signature_name}
                        onChange={(e) => setInspectionForm((prev) => ({ ...prev, signature_name: e.target.value }))}
                        required
                    />
                </label>
                <div className="driver-portal__signature">
                    <div className="driver-portal__signature-header">
                        <span>Assinatura digital</span>
                        <Button type="button" variant="ghost" size="sm" onClick={clearSignature}>
                            Limpar
                        </Button>
                    </div>
                    <div className="driver-portal__signature-pad">
                        <canvas
                            ref={signatureCanvasRef}
                            onPointerDown={handleSignaturePointerDown}
                            onPointerMove={handleSignaturePointerMove}
                            onPointerUp={handleSignaturePointerUp}
                            onPointerLeave={handleSignaturePointerUp}
                        />
                        {!signatureDataUrl && <span className="driver-portal__signature-hint">Assine aqui com o dedo</span>}
                    </div>
                </div>
                <Button type="submit" fullWidth>Registrar checklist</Button>
            </form>

            <div className="driver-portal__inspection-history">
                <h4>Histórico de condições</h4>
                {isMobile ? (
                    renderInspectionCards()
                ) : (
                    <Table
                        columns={[
                            { key: "inspection_date", label: "Data", render: (row) => formatDateLabel(row.inspection_date) },
                            { key: "vehicle_plate", label: "Veículo" },
                            { key: "condition_status", label: "Status", render: (row) => inspectionStatusLabel(row.condition_status) },
                            { key: "odometer", label: "Odômetro", render: (row) => (row.odometer ? `${row.odometer} km` : "—") },
                            { key: "signature_name", label: "Assinatura" },
                            {
                                key: "damage_photos",
                                label: "Avarias",
                                render: (row) => (row.damage_photos?.length ? `${row.damage_photos.length} foto(s)` : "—"),
                            },
                            {
                                key: "signature_image",
                                label: "Arquivo",
                                render: (row) =>
                                    row.signature_image ? (
                                        <a href={row.signature_image} target="_blank" rel="noopener noreferrer">Ver</a>
                                    ) : "—",
                            },
                        ]}
                        data={inspections}
                    />
                )}
            </div>
        </section>
    );
};
