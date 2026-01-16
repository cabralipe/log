import React, { useEffect, useRef, useState } from "react";
import "./DriverInspection.css";
import { InspectionPortal, InspectionChecklistItem } from "../types";

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
            ctx.lineWidth = 2.5;
            ctx.lineCap = "round";
            ctx.strokeStyle = "#f1f5f9";
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
        setSignatureDataUrl(canvas.toDataURL("image/png"));
    };

    useEffect(() => {
        resizeSignatureCanvas();
        window.addEventListener("resize", resizeSignatureCanvas);
        return () => window.removeEventListener("resize", resizeSignatureCanvas);
    }, []);

    const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        signatureDrawingRef.current = true;
        signatureLastPosRef.current = getCanvasPoint(event);
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!signatureDrawingRef.current) return;
        const ctx = event.currentTarget.getContext("2d");
        if (!ctx) return;
        const current = getCanvasPoint(event);
        const last = signatureLastPosRef.current || current;
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(current.x, current.y);
        ctx.stroke();
        signatureLastPosRef.current = current;
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!signatureDrawingRef.current) return;
        signatureDrawingRef.current = false;
        signatureLastPosRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        saveSignature();
    };

    const onSubmit = (e: React.FormEvent) => {
        handleInspectionSubmit(e, signatureDataUrl);
        if (signatureDataUrl) clearSignature();
    };

    // Group checklist items by category
    const categories = [
        { key: 'exterior', label: 'Exterior', icon: 'directions_car' },
        { key: 'mecanica', label: 'Mecânica', icon: 'engineering' },
        { key: 'seguranca', label: 'Segurança', icon: 'gpp_good' },
    ];

    return (
        <div className="dp-inspection fade-in">
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Vehicle & Odometer Card */}
                <div className="dp-glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dp-muted)', textTransform: 'uppercase', margin: 0 }}>Veículo</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--dp-accent)', margin: 0 }}>
                                {inspectionForm.vehicle ? availableVehicles.find(v => v.id === inspectionForm.vehicle)?.plate || 'Selecione' : 'Selecione'}
                            </h3>
                        </div>
                        <div style={{ background: 'rgba(74, 222, 128, 0.1)', padding: '0.75rem', borderRadius: '12px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '2rem', color: 'var(--dp-accent)' }}>local_shipping</span>
                        </div>
                    </div>

                    <div className="dp-form-group">
                        <select
                            className="dp-input"
                            value={inspectionForm.vehicle}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, vehicle: Number(e.target.value) }))}
                            required
                        >
                            <option value="">Trocar Veículo</option>
                            {availableVehicles.map((v) => (
                                <option key={v.id} value={v.id}>{v.plate}</option>
                            ))}
                        </select>
                    </div>

                    <div className="dp-form-group" style={{ marginTop: '1rem' }}>
                        <label className="dp-form-label">Odômetro Atual (km)</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="number"
                                className="dp-input"
                                style={{ fontSize: '1.25rem' }}
                                placeholder="000.000"
                                value={inspectionForm.odometer}
                                onChange={(e) => setInspectionForm((prev) => ({ ...prev, odometer: e.target.value }))}
                            />
                            <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--dp-muted)', fontWeight: 700 }}>KM</span>
                        </div>
                    </div>
                </div>

                {/* Checklist Sections */}
                {categories.map((category) => {
                    const items = inspectionChecklist.filter(item =>
                        item.key.toLowerCase().includes(category.key) ||
                        (category.key === 'exterior' && ['pneus', 'farois', 'luzes', 'lataria', 'vidros'].some(k => item.key.toLowerCase().includes(k))) ||
                        (category.key === 'mecanica' && ['oleo', 'freios', 'motor', 'arla'].some(k => item.key.toLowerCase().includes(k))) ||
                        (category.key === 'seguranca' && ['extintor', 'epi', 'cinto', 'triangulo'].some(k => item.key.toLowerCase().includes(k)))
                    );

                    const displayItems = items.length > 0 ? items :
                        category.key === 'exterior' ? inspectionChecklist.slice(0, Math.ceil(inspectionChecklist.length / 3)) :
                            category.key === 'mecanica' ? inspectionChecklist.slice(Math.ceil(inspectionChecklist.length / 3), Math.ceil(inspectionChecklist.length * 2 / 3)) :
                                inspectionChecklist.slice(Math.ceil(inspectionChecklist.length * 2 / 3));

                    return (
                        <div key={category.key} className="dp-checklist-section">
                            <div className="dp-checklist-section__header">
                                <span className="material-symbols-outlined" style={{ color: 'var(--dp-accent)' }}>{category.icon}</span>
                                <h4 className="dp-checklist-section__title">{category.label}</h4>
                            </div>

                            {displayItems.map((item) => (
                                <div
                                    key={item.key}
                                    className={`dp-checklist-item ${item.status === 'ISSUE' ? 'dp-checklist-item--issue' : ''}`}
                                >
                                    <div className="dp-checklist-item__header">
                                        <span className="dp-checklist-item__name">{item.label}</span>
                                        {item.status === 'ISSUE' && (
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <span className="material-symbols-outlined" style={{ color: 'var(--dp-danger)', fontSize: '1.25rem' }}>warning</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="dp-checklist-item__buttons">
                                        <button
                                            type="button"
                                            className={`dp-checklist-btn ${item.status === 'OK' ? 'dp-checklist-btn--ok' : 'dp-checklist-btn--ok-inactive'}`}
                                            onClick={() => updateChecklistStatus(item.key, 'OK')}
                                        >
                                            <span className="material-symbols-outlined">check_circle</span>
                                            OK
                                        </button>
                                        <button
                                            type="button"
                                            className={`dp-checklist-btn ${item.status === 'ISSUE' ? 'dp-checklist-btn--issue' : 'dp-checklist-btn--issue-inactive'}`}
                                            onClick={() => updateChecklistStatus(item.key, 'ISSUE')}
                                        >
                                            <span className="material-symbols-outlined">cancel</span>
                                            Problema
                                        </button>
                                    </div>
                                    {item.status === 'ISSUE' && (
                                        <input
                                            type="text"
                                            className="dp-input"
                                            style={{ marginTop: '1rem' }}
                                            placeholder="Descreva o problema..."
                                            value={item.note || ''}
                                            onChange={(e) => updateChecklistNote(item.key, e.target.value)}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    );
                })}

                {/* Signature Section */}
                <div className="dp-glass-card">
                    <div className="dp-form-group">
                        <label className="dp-form-label">Nome Completo</label>
                        <input
                            type="text"
                            className="dp-input"
                            placeholder="Nome do motorista"
                            value={inspectionForm.signature_name}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, signature_name: e.target.value }))}
                            required
                        />
                    </div>

                    <div className="dp-signature-pad">
                        <div className="dp-signature-pad__header">
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Assinatura Digital</span>
                            <button type="button" className="dp-btn dp-btn--ghost" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }} onClick={clearSignature}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>refresh</span>
                                Limpar
                            </button>
                        </div>
                        <div className="dp-signature-pad__canvas-container">
                            <canvas
                                ref={signatureCanvasRef}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                            />
                            {!signatureDataUrl && (
                                <span className="dp-signature-pad__hint">Assine aqui com o dedo</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Submit Button */}
                <div className="dp-bottom-action" style={{ position: 'sticky', bottom: '1rem', zIndex: 10 }}>
                    <button type="submit" className="dp-btn dp-btn--primary" style={{ width: '100%', padding: '1.25rem', fontSize: '1.1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                        <span className="material-symbols-outlined">draw</span>
                        ENVIAR INSPEÇÃO
                    </button>
                </div>
            </form>
        </div>
    );
};
